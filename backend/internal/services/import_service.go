package services

import (
	"crypto/sha256"
	"fmt"
	"log/slog"
	"strings"

	"github.com/notnil/chess"

	"github.com/kumquat/backend/internal/models"
	"github.com/kumquat/backend/internal/repository"
)

// ErrAllGamesDuplicate is returned when all games in an import already exist
var ErrAllGamesDuplicate = fmt.Errorf("all games have already been imported")

// ImportService handles game import and analysis business logic
type ImportService struct {
	repertoireService    *RepertoireService
	analysisRepo         repository.AnalysisRepository
	fingerprintRepo      repository.GameFingerprintRepository
	engineService        *EngineService
	dismissedMistakeRepo repository.DismissedMistakeRepository
	dismissedGapRepo     repository.DismissedGapRepository
}

// NewImportService creates a new import service with the given dependencies
func NewImportService(repertoireSvc *RepertoireService, analysisRepo repository.AnalysisRepository, opts ...ImportServiceOption) *ImportService {
	svc := &ImportService{
		repertoireService: repertoireSvc,
		analysisRepo:      analysisRepo,
	}
	for _, opt := range opts {
		opt(svc)
	}
	return svc
}

// ImportServiceOption is a functional option for ImportService
type ImportServiceOption func(*ImportService)

// WithFingerprintRepo sets the fingerprint repository on the ImportService
func WithFingerprintRepo(repo repository.GameFingerprintRepository) ImportServiceOption {
	return func(s *ImportService) {
		s.fingerprintRepo = repo
	}
}

// WithEngineService sets the engine service on the ImportService
func WithEngineService(svc *EngineService) ImportServiceOption {
	return func(s *ImportService) {
		s.engineService = svc
	}
}

// WithDismissedMistakeRepo sets the dismissed mistake repository on the ImportService
func WithDismissedMistakeRepo(repo repository.DismissedMistakeRepository) ImportServiceOption {
	return func(s *ImportService) {
		s.dismissedMistakeRepo = repo
	}
}

// WithDismissedGapRepo sets the dismissed gap repository on the ImportService
func WithDismissedGapRepo(repo repository.DismissedGapRepository) ImportServiceOption {
	return func(s *ImportService) {
		s.dismissedGapRepo = repo
	}
}

// ParseAndAnalyze parses PGN data and analyzes games against repertoires
func (s *ImportService) ParseAndAnalyze(filename string, username string, userID string, pgnData string) (*models.AnalysisSummary, []models.GameAnalysis, error) {
	games, err := s.parsePGN(pgnData)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to parse PGN: %w", err)
	}

	if len(games) == 0 {
		return nil, nil, fmt.Errorf("no games found in PGN")
	}

	// Get all repertoires upfront
	whiteColor := models.ColorWhite
	blackColor := models.ColorBlack
	whiteRepertoires, err := s.repertoireService.ListRepertoires(userID, &whiteColor)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to get white repertoires: %w", err)
	}
	blackRepertoires, err := s.repertoireService.ListRepertoires(userID, &blackColor)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to get black repertoires: %w", err)
	}

	var results []models.GameAnalysis
	resultIndex := 0
	for _, game := range games {
		userColor := s.determineUserColor(game, username)
		if userColor == "" {
			continue
		}

		var repertoires []models.Repertoire
		if userColor == models.ColorWhite {
			repertoires = whiteRepertoires
		} else {
			repertoires = blackRepertoires
		}

		bestRepertoire, matchScore := s.findBestMatchingRepertoire(game, repertoires, userColor)

		var analysis models.GameAnalysis
		if bestRepertoire == nil {
			emptyTree := models.RepertoireNode{}
			analysis = s.analyzeGame(resultIndex, game, emptyTree, userColor)
			analysis.MatchedRepertoire = nil
			analysis.MatchScore = 0
		} else {
			analysis = s.analyzeGame(resultIndex, game, bestRepertoire.TreeData, userColor)
			analysis.MatchedRepertoire = &models.RepertoireRef{
				ID:   bestRepertoire.ID,
				Name: bestRepertoire.Name,
			}
			analysis.MatchScore = matchScore
		}
		analysis.UserColor = userColor
		results = append(results, analysis)
		resultIndex++
	}

	if len(results) == 0 {
		return nil, nil, fmt.Errorf("no games found where '%s' was a player", username)
	}

	// Deduplicate using fingerprints
	skippedDuplicates := 0
	if s.fingerprintRepo != nil {
		fingerprints := make([]string, len(results))
		for i, r := range results {
			fingerprints[i] = ComputeFingerprint(r.Headers, r.Moves)
		}

		existing, err := s.fingerprintRepo.CheckExisting(userID, fingerprints)
		if err != nil {
			return nil, nil, fmt.Errorf("failed to check fingerprints: %w", err)
		}

		var filtered []models.GameAnalysis
		for i, r := range results {
			if !existing[fingerprints[i]] {
				filtered = append(filtered, r)
			}
		}
		skippedDuplicates = len(results) - len(filtered)

		if len(filtered) == 0 {
			return nil, nil, ErrAllGamesDuplicate
		}

		// Re-index filtered games
		for i := range filtered {
			filtered[i].GameIndex = i
		}
		results = filtered
	}

	summary, err := s.analysisRepo.Save(userID, username, filename, len(results), results)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to save analysis: %w", err)
	}
	summary.SkippedDuplicates = skippedDuplicates

	// Save fingerprints for the newly imported games
	if s.fingerprintRepo != nil {
		entries := make([]repository.FingerprintEntry, len(results))
		for i, r := range results {
			entries[i] = repository.FingerprintEntry{
				Fingerprint: ComputeFingerprint(r.Headers, r.Moves),
				GameIndex:   r.GameIndex,
			}
		}
		if err := s.fingerprintRepo.SaveBatch(userID, summary.ID, entries); err != nil {
			// Log but don't fail the import
			slog.Warn("failed to save fingerprints", "analysis_id", summary.ID, "error", err)
		}
	}

	// Enqueue engine analysis if available
	if s.engineService != nil {
		s.engineService.EnqueueAnalysis(userID, summary.ID, len(results))
	}

	return summary, results, nil
}

// findBestMatchingRepertoire finds the repertoire with the most matching moves.
// Returns nil when no repertoire covers the opponent's first move.
func (s *ImportService) findBestMatchingRepertoire(game *chess.Game, repertoires []models.Repertoire, userColor models.Color) (*models.Repertoire, int) {
	if len(repertoires) == 0 {
		return nil, 0
	}

	var bestRepertoire *models.Repertoire
	bestScore := -1

	for i := range repertoires {
		score := s.countMatchingMoves(game, repertoires[i].TreeData, userColor)
		if score > bestScore {
			bestScore = score
			bestRepertoire = &repertoires[i]
		}
	}

	if bestScore < 0 || bestRepertoire == nil {
		return nil, 0
	}

	return bestRepertoire, bestScore
}

// countMatchingMoves counts how many of the user's moves are in the repertoire.
// Returns -1 if the opponent's first move is not covered by the repertoire,
// signalling that this repertoire should not be matched to this game.
func (s *ImportService) countMatchingMoves(game *chess.Game, repertoireRoot models.RepertoireNode, userColor models.Color) int {
	moves := game.Moves()
	position := chess.StartingPosition()
	notation := chess.AlgebraicNotation{}
	matchCount := 0

	for ply, move := range moves {
		san := notation.Encode(position, move)
		currentFEN := normalizeFEN(position.String())
		isUserMove := (ply%2 == 0 && userColor == models.ColorWhite) || (ply%2 == 1 && userColor == models.ColorBlack)

		// Reject repertoire if the opponent's very first move is not covered.
		// Black: ply 0 is white's (opponent's) first move.
		// White: ply 1 is black's (opponent's) first move.
		isOpponentFirstMove := (ply == 0 && userColor == models.ColorBlack) || (ply == 1 && userColor == models.ColorWhite)
		if isOpponentFirstMove {
			node := s.findNodeInRepertoire(repertoireRoot, currentFEN)
			if node != nil && len(node.Children) > 0 {
				found := false
				for _, child := range node.Children {
					if child.Move != nil && *child.Move == san {
						found = true
						break
					}
				}
				if !found {
					return -1
				}
			}
		}

		if isUserMove {
			node := s.findNodeInRepertoire(repertoireRoot, currentFEN)
			if node != nil {
				for _, child := range node.Children {
					if child.Move != nil && *child.Move == san {
						matchCount++
						break
					}
				}
			}
		}

		position = position.Update(move)
	}

	return matchCount
}

func (s *ImportService) determineUserColor(game *chess.Game, username string) models.Color {
	headers := s.extractHeaders(game)
	white := headers["White"]
	black := headers["Black"]

	usernameLower := strings.ToLower(username)
	if strings.ToLower(white) == usernameLower {
		return models.ColorWhite
	}
	if strings.ToLower(black) == usernameLower {
		return models.ColorBlack
	}
	return ""
}

func (s *ImportService) parsePGN(pgnData string) ([]*chess.Game, error) {
	// Split multi-game PGN into individual games first, then parse each one
	// separately to work around notnil/chess GamesFromPGN splitting games
	// incorrectly when there are blank lines between headers and moves.
	rawGames := splitRawPGNGames(pgnData)

	var validGames []*chess.Game
	for _, rawGame := range rawGames {
		rawGame = strings.TrimSpace(rawGame)
		if rawGame == "" {
			continue
		}
		reader := strings.NewReader(rawGame)
		parsed, err := chess.GamesFromPGN(reader)
		if err != nil {
			// Skip individual games that fail to parse
			continue
		}
		for _, game := range parsed {
			if len(game.Moves()) > 0 {
				validGames = append(validGames, game)
			}
		}
	}

	return validGames, nil
}

// splitRawPGNGames splits a multi-game PGN string into individual game strings.
// A new game starts when a tag line (starting with '[') appears after a result
// line or blank line following move text.
func splitRawPGNGames(pgn string) []string {
	var games []string
	var current strings.Builder
	seenMoves := false

	lines := strings.Split(pgn, "\n")
	for _, line := range lines {
		trimmed := strings.TrimSpace(line)

		if strings.HasPrefix(trimmed, "[") && seenMoves {
			// Start of a new game: save current and reset
			game := strings.TrimSpace(current.String())
			if game != "" {
				games = append(games, game)
			}
			current.Reset()
			seenMoves = false
		}

		if trimmed != "" && !strings.HasPrefix(trimmed, "[") {
			seenMoves = true
		}

		current.WriteString(line)
		current.WriteString("\n")
	}

	// Don't forget the last game
	game := strings.TrimSpace(current.String())
	if game != "" {
		games = append(games, game)
	}

	return games
}

func (s *ImportService) analyzeGame(gameIndex int, game *chess.Game, repertoireRoot models.RepertoireNode, userColor models.Color) models.GameAnalysis {
	analysis := models.GameAnalysis{
		GameIndex: gameIndex,
		Headers:   s.extractHeaders(game),
		Moves:     []models.MoveAnalysis{},
	}

	moves := game.Moves()
	position := chess.StartingPosition()
	notation := chess.AlgebraicNotation{}

	for ply, move := range moves {
		san := notation.Encode(position, move)
		currentFEN := normalizeFEN(position.String())
		isUserMove := (ply%2 == 0 && userColor == models.ColorWhite) || (ply%2 == 1 && userColor == models.ColorBlack)

		var status string
		var expectedMove string

		node := s.findNodeInRepertoire(repertoireRoot, currentFEN)
		if node == nil || len(node.Children) == 0 {
			// Position not in tree or is a leaf — repertoire has ended
			status = "out-of-book"
		} else {
			// Position has children — check if the played move matches
			found := false
			for _, child := range node.Children {
				if child.Move != nil && *child.Move == san {
					found = true
					break
				}
			}
			switch {
			case found:
				status = "in-repertoire"
			case isUserMove:
				status = "out-of-repertoire"
				// Expected move is the first child's move
				if len(node.Children) > 0 && node.Children[0].Move != nil {
					expectedMove = *node.Children[0].Move
				}
			default:
				status = "opponent-new"
			}
		}

		moveAnalysis := models.MoveAnalysis{
			PlyNumber:    ply,
			SAN:          san,
			FEN:          currentFEN,
			Status:       status,
			ExpectedMove: expectedMove,
			IsUserMove:   isUserMove,
		}

		analysis.Moves = append(analysis.Moves, moveAnalysis)
		position = position.Update(move)
	}

	return analysis
}

// NormalizeFEN strips half-move and full-move counters from a FEN string,
// keeping only board, side to move, castling, and en passant fields.
func NormalizeFEN(fen string) string {
	parts := strings.Fields(fen)
	if len(parts) >= 4 {
		return strings.Join(parts[:4], " ")
	}
	return fen
}

// normalizeFEN is the package-internal alias kept for existing callers.
func normalizeFEN(fen string) string { return NormalizeFEN(fen) }

func (s *ImportService) extractHeaders(game *chess.Game) models.PGNHeaders {
	headers := make(models.PGNHeaders)

	// Use TagPairs() to get all headers including Opening, ECO, etc.
	for _, tp := range game.TagPairs() {
		headers[tp.Key] = tp.Value
	}

	if _, ok := headers["Event"]; !ok {
		headers["Event"] = "Unknown"
	}
	if _, ok := headers["White"]; !ok {
		headers["White"] = "Unknown"
	}
	if _, ok := headers["Black"]; !ok {
		headers["Black"] = "Unknown"
	}
	if _, ok := headers["Result"]; !ok {
		headers["Result"] = "*"
	}

	return headers
}

// findNodeInRepertoire searches the repertoire tree for a node matching the given FEN.
// Returns a pointer to the matching node, or nil if not found.
func (s *ImportService) findNodeInRepertoire(root models.RepertoireNode, currentFEN string) *models.RepertoireNode {
	var search func(node *models.RepertoireNode) *models.RepertoireNode
	search = func(node *models.RepertoireNode) *models.RepertoireNode {
		if node.FEN == currentFEN {
			return node
		}
		for _, child := range node.Children {
			if child != nil {
				if result := search(child); result != nil {
					return result
				}
			}
		}
		return nil
	}
	return search(&root)
}

// buildFENIndex walks a repertoire tree once and returns a map from FEN to the
// matching node. When several nodes share the same FEN (transpositions), the
// first node reached in a pre-order depth-first traversal wins, mirroring the
// match semantics of findNodeInRepertoire. Building the index once and reusing
// it across every game/move avoids the O(repertoires × moves × tree) full-tree
// recursion that findNodeInRepertoire incurs on each lookup.
func buildFENIndex(root *models.RepertoireNode) map[string]*models.RepertoireNode {
	index := make(map[string]*models.RepertoireNode)
	var walk func(node *models.RepertoireNode)
	walk = func(node *models.RepertoireNode) {
		if node == nil {
			return
		}
		if _, exists := index[node.FEN]; !exists {
			index[node.FEN] = node
		}
		for _, child := range node.Children {
			walk(child)
		}
	}
	walk(root)
	return index
}

// ValidatePGN validates PGN format
func (s *ImportService) ValidatePGN(pgnData string) error {
	_, err := s.parsePGN(pgnData)
	if err != nil {
		return fmt.Errorf("invalid PGN format: %w", err)
	}
	return nil
}

// ValidateMove validates a chess move
func (s *ImportService) ValidateMove(fen, san string) error {
	fullFEN := ensureFullFEN(fen)
	fenFn, err := chess.FEN(fullFEN)
	if err != nil {
		return fmt.Errorf("invalid FEN: %w", err)
	}
	game := chess.NewGame(fenFn)
	err = game.MoveStr(san)
	if err != nil {
		return fmt.Errorf("invalid move %s: %w", san, err)
	}
	return nil
}

// GetLegalMoves returns legal moves for a position
func (s *ImportService) GetLegalMoves(fen string) ([]string, error) {
	fullFEN := ensureFullFEN(fen)
	fenFn, err := chess.FEN(fullFEN)
	if err != nil {
		return nil, fmt.Errorf("invalid FEN: %w", err)
	}
	game := chess.NewGame(fenFn)
	moves := game.ValidMoves()
	sanMoves := make([]string, len(moves))
	for i, move := range moves {
		sanMoves[i] = move.String()
	}
	return sanMoves, nil
}

// AnalyzeTrainingMoves takes a sequence of SAN moves from an explorer training session,
// finds the best matching repertoire for the user, and returns per-move analysis.
func (s *ImportService) AnalyzeTrainingMoves(userID string, moves []string, userColor models.Color) (*models.TrainingAnalyzeResponse, error) {
	// Load repertoires for the user's color
	repertoires, err := s.repertoireService.ListRepertoires(userID, &userColor)
	if err != nil {
		return nil, fmt.Errorf("failed to load repertoires: %w", err)
	}

	// Replay the moves to build FENs
	game := chess.NewGame()
	for _, san := range moves {
		if err := game.MoveStr(san); err != nil {
			return nil, fmt.Errorf("invalid move %s: %w", san, err)
		}
	}

	// Find the best matching repertoire using scoring logic
	bestRepertoire, bestScore := s.findBestMatchingRepertoireFromSANs(game, repertoires, userColor)

	// Build per-move analysis
	moveAnalyses := s.analyzeGameFromChess(game, bestRepertoire, userColor)

	resp := &models.TrainingAnalyzeResponse{
		MatchScore: bestScore,
		Moves:      moveAnalyses,
	}
	if bestRepertoire != nil {
		resp.MatchedRepertoire = &models.RepertoireRef{
			ID:   bestRepertoire.ID,
			Name: bestRepertoire.Name,
		}
	}

	return resp, nil
}

// findBestMatchingRepertoireFromSANs scores each repertoire against a chess.Game and returns the best match.
func (s *ImportService) findBestMatchingRepertoireFromSANs(game *chess.Game, repertoires []models.Repertoire, userColor models.Color) (*models.Repertoire, int) {
	if len(repertoires) == 0 {
		return nil, 0
	}

	var bestRepertoire *models.Repertoire
	bestScore := -1

	for i := range repertoires {
		score := s.countMatchingMoves(game, repertoires[i].TreeData, userColor)
		if score > bestScore {
			bestScore = score
			bestRepertoire = &repertoires[i]
		}
	}

	if bestScore < 0 || bestRepertoire == nil {
		return nil, 0
	}

	return bestRepertoire, bestScore
}

// analyzeGameFromChess produces per-move MoveAnalysis from a chess.Game against a repertoire (or nil repertoire).
func (s *ImportService) analyzeGameFromChess(game *chess.Game, repertoire *models.Repertoire, userColor models.Color) []models.MoveAnalysis {
	chessMovs := game.Moves()
	position := chess.StartingPosition()
	notation := chess.AlgebraicNotation{}
	result := make([]models.MoveAnalysis, 0, len(chessMovs))

	for ply, move := range chessMovs {
		san := notation.Encode(position, move)
		currentFEN := normalizeFEN(position.String())
		isUserMove := (ply%2 == 0 && userColor == models.ColorWhite) || (ply%2 == 1 && userColor == models.ColorBlack)

		var status string
		var expectedMove string

		if repertoire == nil {
			status = "out-of-book"
		} else {
			node := s.findNodeInRepertoire(repertoire.TreeData, currentFEN)
			if node == nil || len(node.Children) == 0 {
				status = "out-of-book"
			} else {
				found := false
				for _, child := range node.Children {
					if child.Move != nil && *child.Move == san {
						found = true
						break
					}
				}
				switch {
				case found:
					status = "in-repertoire"
				case isUserMove:
					status = "out-of-repertoire"
					if len(node.Children) > 0 && node.Children[0].Move != nil {
						expectedMove = *node.Children[0].Move
					}
				default:
					status = "opponent-new"
				}
			}
		}

		result = append(result, models.MoveAnalysis{
			PlyNumber:    ply,
			SAN:          san,
			FEN:          currentFEN,
			Status:       status,
			ExpectedMove: expectedMove,
			IsUserMove:   isUserMove,
		})

		position = position.Update(move)
	}

	return result
}

// GetAnalyses returns all analyses summaries for a user
func (s *ImportService) GetAnalyses(userID string) ([]models.AnalysisSummary, error) {
	analyses, err := s.analysisRepo.GetAll(userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get analyses: %w", err)
	}
	return analyses, nil
}

// GetAnalysisByID returns detailed analysis by ID
func (s *ImportService) GetAnalysisByID(id string) (*models.AnalysisDetail, error) {
	return s.analysisRepo.GetByID(id)
}

// DeleteAnalysis deletes an analysis by ID
func (s *ImportService) DeleteAnalysis(id string) error {
	return s.analysisRepo.Delete(id)
}

// GetAllGames returns all games from all analyses with pagination for a user
func (s *ImportService) GetAllGames(userID string, limit, offset int, timeClass, repertoire, source string, onlyNew bool) (*models.GamesResponse, error) {
	response, err := s.analysisRepo.GetAllGames(userID, limit, offset, timeClass, repertoire, source, onlyNew)
	if err != nil {
		return nil, fmt.Errorf("failed to get games: %w", err)
	}
	return response, nil
}

// GetDistinctRepertoires returns a sorted list of distinct repertoires for a user
func (s *ImportService) GetDistinctRepertoires(userID string) ([]models.RepertoireFilterOption, error) {
	return s.analysisRepo.GetDistinctRepertoires(userID)
}

// MarkGameViewed marks a specific game as viewed by the user
func (s *ImportService) MarkGameViewed(userID, analysisID string, gameIndex int) error {
	return s.analysisRepo.MarkGameViewed(userID, analysisID, gameIndex)
}

// CheckOwnership verifies that an analysis belongs to the given user
func (s *ImportService) CheckOwnership(id string, userID string) error {
	belongs, err := s.analysisRepo.BelongsToUser(id, userID)
	if err != nil {
		return fmt.Errorf("failed to check ownership: %w", err)
	}
	if !belongs {
		return ErrNotFound
	}
	return nil
}

// ReanalyzeGame re-analyzes a specific game against a different repertoire
func (s *ImportService) ReanalyzeGame(analysisID string, gameIndex int, repertoireID string) (*models.GameAnalysis, error) {
	detail, err := s.analysisRepo.GetByID(analysisID)
	if err != nil {
		return nil, err
	}

	var targetGame *models.GameAnalysis
	var targetIdx int
	for i := range detail.Results {
		if detail.Results[i].GameIndex == gameIndex {
			targetGame = &detail.Results[i]
			targetIdx = i
			break
		}
	}
	if targetGame == nil {
		return nil, repository.ErrGameNotFound
	}

	repertoire, err := s.repertoireService.GetRepertoire(repertoireID)
	if err != nil {
		return nil, fmt.Errorf("%w: %w", ErrRepertoireNotFound, err)
	}

	if repertoire.Color != targetGame.UserColor {
		return nil, ErrColorMismatch
	}

	reanalyzedGame := s.reanalyzeGameFromMoves(targetGame, repertoire)

	detail.Results[targetIdx] = reanalyzedGame
	err = s.analysisRepo.UpdateResults(analysisID, detail.Results)
	if err != nil {
		return nil, fmt.Errorf("failed to save reanalyzed game: %w", err)
	}

	return &reanalyzedGame, nil
}

// reanalyzeGameFromMoves re-analyzes a game using its stored moves against a new repertoire.
// It builds a one-shot FEN index for the repertoire tree; callers that re-analyze many
// games against the same tree should build the index once and call
// reanalyzeGameWithIndex instead.
func (s *ImportService) reanalyzeGameFromMoves(game *models.GameAnalysis, repertoire *models.Repertoire) models.GameAnalysis {
	index := buildFENIndex(&repertoire.TreeData)
	return s.reanalyzeGameWithIndex(game, &models.RepertoireRef{
		ID:   repertoire.ID,
		Name: repertoire.Name,
	}, index)
}

// reanalyzeGameWithIndex re-analyzes a game using its stored moves against a prebuilt
// FEN index of a repertoire tree. Each move is matched via a single map lookup rather
// than a full-tree recursion.
func (s *ImportService) reanalyzeGameWithIndex(game *models.GameAnalysis, reperRef *models.RepertoireRef, index map[string]*models.RepertoireNode) models.GameAnalysis {
	result := models.GameAnalysis{
		GameIndex:         game.GameIndex,
		Headers:           game.Headers,
		Moves:             make([]models.MoveAnalysis, len(game.Moves)),
		UserColor:         game.UserColor,
		MatchedRepertoire: reperRef,
		MatchScore:        0,
	}

	for i, move := range game.Moves {
		var status string
		var expectedMove string

		node := index[move.FEN]
		if node == nil || len(node.Children) == 0 {
			status = "out-of-book"
		} else {
			found := false
			for _, child := range node.Children {
				if child.Move != nil && *child.Move == move.SAN {
					found = true
					break
				}
			}
			switch {
			case found:
				status = "in-repertoire"
				if move.IsUserMove {
					result.MatchScore++
				}
			case move.IsUserMove:
				status = "out-of-repertoire"
				if len(node.Children) > 0 && node.Children[0].Move != nil {
					expectedMove = *node.Children[0].Move
				}
			default:
				status = "opponent-new"
			}
		}

		result.Moves[i] = models.MoveAnalysis{
			PlyNumber:    move.PlyNumber,
			SAN:          move.SAN,
			FEN:          move.FEN,
			Status:       status,
			ExpectedMove: expectedMove,
			IsUserMove:   move.IsUserMove,
		}
	}

	return result
}

// ReanalyzeAllGames re-analyzes all imported games against the user's current repertoires.
//
// When preserveAnalysed is true (auto re-analysis triggered by repertoire edits), a
// game's stored analysis is left untouched whenever re-analysis would newly flag it as
// an "error". This avoids retroactively tagging historical games against prep that did
// not exist when they were played — for example a game the user reviewed and then
// enriched their repertoire from. Genuine improvements (e.g. error -> in-repertoire) and
// re-tagging of games that were already errors still apply. Manual re-analysis passes
// false to force a full re-tag.
func (s *ImportService) ReanalyzeAllGames(userID string, preserveAnalysed bool) (int, error) {
	analyses, err := s.analysisRepo.GetAllGamesRaw(userID)
	if err != nil {
		return 0, fmt.Errorf("failed to get analyses: %w", err)
	}

	whiteColor := models.ColorWhite
	blackColor := models.ColorBlack
	whiteRepertoires, err := s.repertoireService.ListRepertoires(userID, &whiteColor)
	if err != nil {
		return 0, fmt.Errorf("failed to get white repertoires: %w", err)
	}
	blackRepertoires, err := s.repertoireService.ListRepertoires(userID, &blackColor)
	if err != nil {
		return 0, fmt.Errorf("failed to get black repertoires: %w", err)
	}

	// Precompute a FEN index per repertoire once, then reuse it across every game and
	// move. This replaces the per-move full-tree recursion of findNodeInRepertoire,
	// which made re-analysis O(repertoires × moves × tree) on each repertoire edit.
	whiteIndexed := indexRepertoires(whiteRepertoires)
	blackIndexed := indexRepertoires(blackRepertoires)

	totalGames := 0
	for _, a := range analyses {
		modified := false
		for i := range a.Results {
			game := &a.Results[i]
			totalGames++

			var repertoires []indexedRepertoire
			if game.UserColor == models.ColorWhite {
				repertoires = whiteIndexed
			} else {
				repertoires = blackIndexed
			}

			best, matchScore := s.findBestMatchingRepertoireFromStored(game, repertoires)

			var reperRef *models.RepertoireRef
			var index map[string]*models.RepertoireNode
			if best != nil {
				reperRef = &models.RepertoireRef{
					ID:   best.repertoire.ID,
					Name: best.repertoire.Name,
				}
				index = best.index
			}

			reanalyzed := s.reanalyzeGameWithIndex(game, reperRef, index)
			reanalyzed.MatchScore = matchScore

			// Don't let auto re-analysis retroactively flag a previously non-error game
			// as an opening error against prep that was added after it was played.
			if preserveAnalysed && gameStatusFromGame(reanalyzed) == "error" && gameStatusFromGame(*game) != "error" {
				continue
			}

			a.Results[i] = reanalyzed
			modified = true
		}

		if modified {
			if err := s.analysisRepo.UpdateResults(a.ID, a.Results); err != nil {
				return 0, fmt.Errorf("failed to update analysis %s: %w", a.ID, err)
			}
		}
	}

	return totalGames, nil
}

// indexedRepertoire pairs a repertoire with a prebuilt FEN index of its tree so the
// index can be computed once and shared across many games during re-analysis.
type indexedRepertoire struct {
	repertoire *models.Repertoire
	index      map[string]*models.RepertoireNode
}

// indexRepertoires builds a FEN index for each repertoire exactly once.
func indexRepertoires(repertoires []models.Repertoire) []indexedRepertoire {
	indexed := make([]indexedRepertoire, len(repertoires))
	for i := range repertoires {
		indexed[i] = indexedRepertoire{
			repertoire: &repertoires[i],
			index:      buildFENIndex(&repertoires[i].TreeData),
		}
	}
	return indexed
}

// findBestMatchingRepertoireFromStored finds the best matching repertoire using stored move FENs.
// Returns nil when no repertoire covers the opponent's first move.
func (s *ImportService) findBestMatchingRepertoireFromStored(game *models.GameAnalysis, repertoires []indexedRepertoire) (*indexedRepertoire, int) {
	if len(repertoires) == 0 {
		return nil, 0
	}

	var bestRepertoire *indexedRepertoire
	bestScore := -1

	for i := range repertoires {
		score := s.countMatchingMovesFromStored(game, repertoires[i].index)
		if score > bestScore {
			bestScore = score
			bestRepertoire = &repertoires[i]
		}
	}

	if bestScore < 0 || bestRepertoire == nil {
		return nil, 0
	}

	return bestRepertoire, bestScore
}

// countMatchingMovesFromStored counts matching user moves using stored FENs against a
// prebuilt FEN index instead of replaying the game or recursing the tree per move.
// Returns -1 if the opponent's first move is not covered by the repertoire.
func (s *ImportService) countMatchingMovesFromStored(game *models.GameAnalysis, index map[string]*models.RepertoireNode) int {
	// Check opponent's first move before counting.
	for _, move := range game.Moves {
		isOpponentFirstMove := (move.PlyNumber == 0 && game.UserColor == models.ColorBlack) || (move.PlyNumber == 1 && game.UserColor == models.ColorWhite)
		if !isOpponentFirstMove {
			continue
		}
		node := index[move.FEN]
		if node != nil && len(node.Children) > 0 {
			found := false
			for _, child := range node.Children {
				if child.Move != nil && *child.Move == move.SAN {
					found = true
					break
				}
			}
			if !found {
				return -1
			}
		}
		break
	}

	matchCount := 0
	for _, move := range game.Moves {
		if !move.IsUserMove {
			continue
		}
		node := index[move.FEN]
		if node != nil {
			for _, child := range node.Children {
				if child.Move != nil && *child.Move == move.SAN {
					matchCount++
					break
				}
			}
		}
	}
	return matchCount
}

// ComputeFingerprint generates a unique fingerprint for a game.
// For Lichess games, uses the Site header (game URL).
// For Chess.com games, uses the Link header (game URL).
// For other sources, uses a SHA-256 hash of key headers and the first 10 moves.
func ComputeFingerprint(headers models.PGNHeaders, moves []models.MoveAnalysis) string {
	// Lichess: Site header contains the game URL
	if site, ok := headers["Site"]; ok && strings.Contains(site, "lichess.org/") {
		return site
	}
	// Chess.com: Link header contains the game URL
	if link, ok := headers["Link"]; ok && strings.Contains(link, "chess.com/") {
		return link
	}

	// Fallback: SHA-256 hash of key metadata + first 10 moves
	var b strings.Builder
	b.WriteString(headers["White"])
	b.WriteByte('|')
	b.WriteString(headers["Black"])
	b.WriteByte('|')
	b.WriteString(headers["Date"])
	b.WriteByte('|')
	b.WriteString(headers["Result"])
	b.WriteByte('|')
	b.WriteString(headers["Event"])
	b.WriteByte('|')

	limit := 10
	if len(moves) < limit {
		limit = len(moves)
	}
	for i := 0; i < limit; i++ {
		if i > 0 {
			b.WriteByte(' ')
		}
		b.WriteString(moves[i].SAN)
	}

	hash := sha256.Sum256([]byte(b.String()))
	return fmt.Sprintf("sha256:%x", hash)
}

// DismissMistake marks a mistake as dismissed for a user
func (s *ImportService) DismissMistake(userID, fen, playedMove string) error {
	if s.dismissedMistakeRepo == nil {
		return fmt.Errorf("dismissed mistake repository not configured")
	}
	return s.dismissedMistakeRepo.Dismiss(userID, fen, playedMove)
}

// DismissGap marks an opponent gap as dismissed for a user
func (s *ImportService) DismissGap(userID, fen, opponentMove, repertoireID string) error {
	if s.dismissedGapRepo == nil {
		return fmt.Errorf("dismissed gap repository not configured")
	}
	return s.dismissedGapRepo.Dismiss(userID, fen, opponentMove, repertoireID)
}

// collectRepertoireMoves extracts all parent FEN + child move combinations from a repertoire tree
// The key format is "parentFEN|childMove" to identify moves that exist in the repertoire
func collectRepertoireMoves(node *models.RepertoireNode, moves map[string]bool) {
	for _, child := range node.Children {
		if child.Move != nil && *child.Move != "" {
			// Use the parent's FEN (node.FEN) and the child's move
			// This represents "at this position, this move is in the repertoire"
			key := node.FEN + "|" + *child.Move
			moves[key] = true
		}
		collectRepertoireMoves(child, moves)
	}
}

// GetInsights computes worst opening mistakes using engine evaluations
func (s *ImportService) GetInsights(userID string) (*models.InsightsResponse, error) {
	response := &models.InsightsResponse{
		WorstMistakes:      []models.OpeningMistake{},
		EngineAnalysisDone: true,
	}

	// If no engine service, return empty (graceful degradation)
	if s.engineService == nil {
		return response, nil
	}

	// Get dismissed mistakes to filter them out
	var dismissedMistakes map[string]bool
	if s.dismissedMistakeRepo != nil {
		var err error
		dismissedMistakes, err = s.dismissedMistakeRepo.GetDismissed(userID)
		if err != nil {
			return nil, fmt.Errorf("failed to get dismissed mistakes: %w", err)
		}
	}

	// Get repertoire moves to filter them out (moves in repertoire are intentional, not mistakes)
	repertoireMoves := make(map[string]bool)
	if s.repertoireService != nil {
		repertoires, err := s.repertoireService.ListRepertoires(userID, nil)
		if err != nil {
			return nil, fmt.Errorf("failed to get repertoires: %w", err)
		}
		for _, rep := range repertoires {
			collectRepertoireMoves(&rep.TreeData, repertoireMoves)
		}
	}

	// Get engine evals and raw game data
	insightsData, err := s.engineService.GetInsightsData(userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get engine evals: %w", err)
	}
	response.EngineAnalysisDone = insightsData.AllDone
	response.EngineAnalysisTotal = insightsData.Total
	response.EngineAnalysisCompleted = insightsData.Completed
	engineEvals := insightsData.Evals

	analyses, err := s.analysisRepo.GetAllGamesRaw(userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get analyses: %w", err)
	}

	// Build lookup: analysisID+gameIndex -> explorer stats
	type evalKey struct {
		AnalysisID string
		GameIndex  int
	}
	evalMap := make(map[evalKey][]models.ExplorerMoveStats)
	for _, ee := range engineEvals {
		if ee.Status == "done" && len(ee.Evals) > 0 {
			evalMap[evalKey{ee.AnalysisID, ee.GameIndex}] = ee.Evals
		}
	}

	// Group mistakes by FEN + played move
	type mistakeKey struct {
		FEN        string
		PlayedMove string
	}
	type mistakeData struct {
		bestMove    string
		winrateDrop float64
		earliestPly int
		games       []models.GameRef
		seen        map[string]bool
	}
	mistakeGroups := make(map[mistakeKey]*mistakeData)

	for _, a := range analyses {
		for _, game := range a.Results {
			stats := evalMap[evalKey{a.ID, game.GameIndex}]
			if len(stats) == 0 {
				continue
			}

			for _, stat := range stats {
				// Skip the very first move (ply 1-2) - opening choice, not a mistake
				if stat.PlyNumber <= 2 {
					continue
				}
				// Only count as mistake if winrate drop >= 2%
				if stat.WinrateDrop < 0.02 {
					continue
				}

				key := mistakeKey{FEN: stat.FEN, PlayedMove: stat.PlayedMove}
				dedup := fmt.Sprintf("%s-%d", a.ID, game.GameIndex)

				data, exists := mistakeGroups[key]
				if !exists {
					data = &mistakeData{
						bestMove:    stat.BestMove,
						winrateDrop: stat.WinrateDrop,
						earliestPly: stat.PlyNumber,
						seen:        make(map[string]bool),
					}
					mistakeGroups[key] = data
				}

				if !data.seen[dedup] {
					data.seen[dedup] = true
					if stat.WinrateDrop > data.winrateDrop {
						data.winrateDrop = stat.WinrateDrop
						data.bestMove = stat.BestMove
					}
					if len(data.games) < 5 {
						data.games = append(data.games, models.GameRef{
							AnalysisID: a.ID,
							GameIndex:  game.GameIndex,
							PlyNumber:  stat.PlyNumber,
							White:      game.Headers["White"],
							Black:      game.Headers["Black"],
							Result:     game.Headers["Result"],
							Date:       game.Headers["Date"],
						})
					}
				}
			}
		}
	}

	// Convert to slice, filter, and score: winrateDrop * frequency²
	// Only keep mistakes that appeared in at least 2 games (recurring patterns)
	for key, data := range mistakeGroups {
		// Skip dismissed mistakes and moves that exist in repertoires
		moveKey := key.FEN + "|" + key.PlayedMove
		if dismissedMistakes[moveKey] || repertoireMoves[moveKey] {
			continue
		}

		freq := len(data.seen)
		if freq < 2 {
			continue
		}
		score := data.winrateDrop * float64(freq) * float64(freq)
		response.WorstMistakes = append(response.WorstMistakes, models.OpeningMistake{
			FEN:         key.FEN,
			PlayedMove:  key.PlayedMove,
			BestMove:    data.bestMove,
			WinrateDrop: data.winrateDrop,
			Frequency:   freq,
			Score:       score,
			Games:       data.games,
		})
	}

	// Sort by score desc, take top 2
	sortMistakes(response.WorstMistakes)
	if len(response.WorstMistakes) > 2 {
		response.WorstMistakes = response.WorstMistakes[:2]
	}

	return response, nil
}

func sortMistakes(mistakes []models.OpeningMistake) {
	for i := 1; i < len(mistakes); i++ {
		for j := i; j > 0 && mistakes[j].Score > mistakes[j-1].Score; j-- {
			mistakes[j], mistakes[j-1] = mistakes[j-1], mistakes[j]
		}
	}
}

func ensureFullFEN(fen string) string {
	parts := strings.Fields(fen)
	if len(parts) >= 6 {
		return fen
	}
	if len(parts) == 4 {
		return fen + " 0 1"
	}
	return fen + " 0 1"
}

// classifyOutcome returns "win", "loss", or "draw" based on the PGN Result header and user's color.
func classifyOutcome(result string, userColor models.Color) string {
	switch result {
	case "1-0":
		if userColor == models.ColorWhite {
			return "win"
		}
		return "loss"
	case "0-1":
		if userColor == models.ColorBlack {
			return "win"
		}
		return "loss"
	case "1/2-1/2":
		return "draw"
	default:
		return "draw"
	}
}

// gameStatusFromGame replicates the repository.computeGameStatus logic.
func gameStatusFromGame(game models.GameAnalysis) string {
	if game.MatchedRepertoire == nil && len(game.Moves) > 0 {
		return "new-opening"
	}
	for _, move := range game.Moves {
		if move.Status == "out-of-repertoire" {
			return "error"
		}
		if move.Status == "opponent-new" {
			return "new-line"
		}
	}
	return "in-repertoire"
}

// findBranchForGame follows the game's moves through the repertoire tree and returns
// the BranchName of the deepest named ancestor node along the game's path.
// It replays the game path through the tree until the game deviates or the tree ends.
func findBranchForGame(root *models.RepertoireNode, moves []models.MoveAnalysis) string {
	branchName := ""
	currentNode := root

	// Check root node
	if currentNode.BranchName != nil && *currentNode.BranchName != "" {
		branchName = *currentNode.BranchName
	}

	for _, move := range moves {
		if move.Status != "in-repertoire" {
			break
		}

		// Find the child node matching this move
		var nextNode *models.RepertoireNode
		for _, child := range currentNode.Children {
			if child != nil && child.Move != nil && *child.Move == move.SAN {
				nextNode = child
				break
			}
		}

		if nextNode == nil {
			break
		}

		// Check if this node has a branch name
		if nextNode.BranchName != nil && *nextNode.BranchName != "" {
			branchName = *nextNode.BranchName
		}

		// The next move in the game will be played from nextNode's position,
		// so we need to find the child matching the FEN of the next move.
		// But since we match by SAN against children, we just continue
		// from the node we found.
		currentNode = nextNode
	}

	return branchName
}

// GetDashboardStats computes aggregate and per-repertoire stats for the dashboard.
func (s *ImportService) GetDashboardStats(userID string) (*models.DashboardStatsResponse, error) {
	analyses, err := s.analysisRepo.GetAllGamesRaw(userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get analyses: %w", err)
	}

	resp := &models.DashboardStatsResponse{
		Repertoires:  []models.RepertoireStats{},
		OpponentGaps: []models.OpponentGap{},
		BranchStats:  []models.BranchStats{},
	}

	// Per-repertoire accumulators
	type repAccum struct {
		name        string
		color       models.Color
		gameCount   int
		wins        int
		inRepCount  int
		inRepWins   int
		outRepCount int
		outRepWins  int
	}
	repMap := make(map[string]*repAccum)

	// Opponent gap accumulator: keyed by "FEN|SAN|repertoireID"
	type gapAccum struct {
		fen            string
		opponentMove   string
		repertoireID   string
		repertoireName string
		color          models.Color
		moveNumber     int
		contextMove    string // last in-rep move before the gap
		wins           int
		losses         int
		draws          int
	}
	gapMap := make(map[string]*gapAccum)

	// Branch stats accumulator: keyed by "branchName|repertoireID"
	type branchAccum struct {
		branchName     string
		repertoireID   string
		repertoireName string
		color          models.Color
		gameCount      int
		wins           int
		losses         int
		draws          int
		errorCount     int
	}
	branchMap := make(map[string]*branchAccum)

	// Cache loaded repertoire trees for branch lookups
	repTreeCache := make(map[string]*models.RepertoireNode)

	// Global win counts split by in/out of repertoire, accumulated during the single
	// pass below and reused for the overall win-rate computation. This avoids the two
	// extra full re-scans of every game that the rates previously required.
	inRepWins := 0
	outRepWins := 0

	for _, a := range analyses {
		for _, game := range a.Results {
			resp.TotalGames++
			outcome := classifyOutcome(game.Headers["Result"], game.UserColor)

			switch outcome {
			case "win":
				resp.Wins++
			case "loss":
				resp.Losses++
			case "draw":
				resp.Draws++
			}

			status := gameStatusFromGame(game)
			inRep := status == "in-repertoire"

			if inRep {
				resp.InRepCount++
				if outcome == "win" {
					inRepWins++
				}
			} else {
				resp.OutRepCount++
				if outcome == "win" {
					outRepWins++
				}
			}

			// Track matched games for opening error rate
			hasMatchedRep := game.MatchedRepertoire != nil
			if hasMatchedRep {
				resp.MatchedGamesCount++
				if status == "error" {
					resp.OpeningErrorCount++
				}
			}

			// Per-repertoire tracking
			if hasMatchedRep {
				repID := game.MatchedRepertoire.ID
				acc, ok := repMap[repID]
				if !ok {
					acc = &repAccum{
						name:  game.MatchedRepertoire.Name,
						color: game.UserColor,
					}
					repMap[repID] = acc
				}
				acc.gameCount++
				if outcome == "win" {
					acc.wins++
				}
				if inRep {
					acc.inRepCount++
					if outcome == "win" {
						acc.inRepWins++
					}
				} else {
					acc.outRepCount++
					if outcome == "win" {
						acc.outRepWins++
					}
				}
			}

			// --- Opponent Gaps: find the first opponent-new move in each game ---
			if hasMatchedRep {
				lastInRepMove := ""
				for _, move := range game.Moves {
					if move.Status == "in-repertoire" {
						lastInRepMove = move.SAN
					}
					if move.Status == "opponent-new" {
						gapKey := move.FEN + "|" + move.SAN + "|" + game.MatchedRepertoire.ID
						acc, ok := gapMap[gapKey]
						if !ok {
							moveNum := (move.PlyNumber / 2) + 1
							acc = &gapAccum{
								fen:            move.FEN,
								opponentMove:   move.SAN,
								repertoireID:   game.MatchedRepertoire.ID,
								repertoireName: game.MatchedRepertoire.Name,
								color:          game.UserColor,
								moveNumber:     moveNum,
								contextMove:    lastInRepMove,
							}
							gapMap[gapKey] = acc
						}
						switch outcome {
						case "win":
							acc.wins++
						case "loss":
							acc.losses++
						case "draw":
							acc.draws++
						}
						break // Only count the first opponent-new per game
					}
					if move.Status == "out-of-repertoire" {
						break // User deviated first, no opponent gap for this game
					}
				}
			}

			// --- Branch Stats: determine which named branch this game fell into ---
			if hasMatchedRep {
				repID := game.MatchedRepertoire.ID

				// Lazy-load repertoire tree
				if _, cached := repTreeCache[repID]; !cached {
					rep, err := s.repertoireService.GetRepertoire(repID)
					if err != nil {
						// Repertoire may have been deleted; skip branch stats
						repTreeCache[repID] = nil
					} else {
						repTreeCache[repID] = &rep.TreeData
					}
				}

				repTree := repTreeCache[repID]
				if repTree != nil {
					branchName := findBranchForGame(repTree, game.Moves)
					if branchName != "" {
						branchKey := branchName + "|" + repID
						bacc, ok := branchMap[branchKey]
						if !ok {
							bacc = &branchAccum{
								branchName:     branchName,
								repertoireID:   repID,
								repertoireName: game.MatchedRepertoire.Name,
								color:          game.UserColor,
							}
							branchMap[branchKey] = bacc
						}
						bacc.gameCount++
						switch outcome {
						case "win":
							bacc.wins++
						case "loss":
							bacc.losses++
						case "draw":
							bacc.draws++
						}
						if status == "error" {
							bacc.errorCount++
						}
					}
				}
			}
		}
	}

	// --- Compute aggregate rates ---
	if resp.TotalGames > 0 {
		resp.OverallWinRate = float64(resp.Wins) / float64(resp.TotalGames)
	}
	if resp.InRepCount+resp.OutRepCount > 0 {
		resp.OverallCoverage = float64(resp.InRepCount) / float64(resp.InRepCount+resp.OutRepCount)
	}
	if resp.InRepCount > 0 {
		resp.WinRateInRep = float64(inRepWins) / float64(resp.InRepCount)
	}
	if resp.OutRepCount > 0 {
		resp.WinRateOutRep = float64(outRepWins) / float64(resp.OutRepCount)
	}

	// Opening error rate
	if resp.MatchedGamesCount > 0 {
		resp.OpeningErrorRate = float64(resp.OpeningErrorCount) / float64(resp.MatchedGamesCount)
	}

	// --- Build per-repertoire stats sorted by gameCount desc ---
	for repID, acc := range repMap {
		rs := models.RepertoireStats{
			RepertoireID:   repID,
			RepertoireName: acc.name,
			Color:          acc.color,
			GameCount:      acc.gameCount,
			InRepCount:     acc.inRepCount,
			OutRepCount:    acc.outRepCount,
		}
		if acc.gameCount > 0 {
			rs.WinRate = float64(acc.wins) / float64(acc.gameCount)
			rs.CoveragePercent = float64(acc.inRepCount) / float64(acc.gameCount) * 100
		}
		if acc.inRepCount > 0 {
			rs.WinRateInRep = float64(acc.inRepWins) / float64(acc.inRepCount)
		}
		if acc.outRepCount > 0 {
			rs.WinRateOutRep = float64(acc.outRepWins) / float64(acc.outRepCount)
		}
		resp.Repertoires = append(resp.Repertoires, rs)
	}
	for i := 1; i < len(resp.Repertoires); i++ {
		for j := i; j > 0 && resp.Repertoires[j].GameCount > resp.Repertoires[j-1].GameCount; j-- {
			resp.Repertoires[j], resp.Repertoires[j-1] = resp.Repertoires[j-1], resp.Repertoires[j]
		}
	}

	// --- Build opponent gaps sorted by frequency desc, top 10 ---
	// Fetch dismissed gaps to filter them out
	var dismissedGaps map[string]bool
	if s.dismissedGapRepo != nil {
		var err error
		dismissedGaps, err = s.dismissedGapRepo.GetDismissed(userID)
		if err != nil {
			return nil, fmt.Errorf("failed to get dismissed gaps: %w", err)
		}
	}

	// Only include gaps that appeared in at least 2 games
	for _, acc := range gapMap {
		total := acc.wins + acc.losses + acc.draws
		if total < 2 {
			continue
		}
		// Skip dismissed gaps
		gapDismissKey := acc.fen + "|" + acc.opponentMove + "|" + acc.repertoireID
		if dismissedGaps[gapDismissKey] {
			continue
		}
		gap := models.OpponentGap{
			FEN:            acc.fen,
			OpponentMove:   acc.opponentMove,
			Frequency:      total,
			Wins:           acc.wins,
			Losses:         acc.losses,
			Draws:          acc.draws,
			RepertoireID:   acc.repertoireID,
			RepertoireName: acc.repertoireName,
			Color:          acc.color,
			MoveNumber:     acc.moveNumber,
			ContextMove:    acc.contextMove,
		}
		if total > 0 {
			gap.WinRate = float64(acc.wins) / float64(total)
		}
		resp.OpponentGaps = append(resp.OpponentGaps, gap)
	}
	// Sort by frequency desc
	for i := 1; i < len(resp.OpponentGaps); i++ {
		for j := i; j > 0 && resp.OpponentGaps[j].Frequency > resp.OpponentGaps[j-1].Frequency; j-- {
			resp.OpponentGaps[j], resp.OpponentGaps[j-1] = resp.OpponentGaps[j-1], resp.OpponentGaps[j]
		}
	}
	// Keep top 10
	if len(resp.OpponentGaps) > 10 {
		resp.OpponentGaps = resp.OpponentGaps[:10]
	}

	// --- Build branch stats sorted by gameCount desc ---
	for _, acc := range branchMap {
		bs := models.BranchStats{
			BranchName:     acc.branchName,
			RepertoireID:   acc.repertoireID,
			RepertoireName: acc.repertoireName,
			Color:          acc.color,
			GameCount:      acc.gameCount,
			Wins:           acc.wins,
			Losses:         acc.losses,
			Draws:          acc.draws,
			ErrorCount:     acc.errorCount,
		}
		if acc.gameCount > 0 {
			bs.WinRate = float64(acc.wins) / float64(acc.gameCount)
			bs.ErrorRate = float64(acc.errorCount) / float64(acc.gameCount)
		}
		resp.BranchStats = append(resp.BranchStats, bs)
	}
	for i := 1; i < len(resp.BranchStats); i++ {
		for j := i; j > 0 && resp.BranchStats[j].GameCount > resp.BranchStats[j-1].GameCount; j-- {
			resp.BranchStats[j], resp.BranchStats[j-1] = resp.BranchStats[j-1], resp.BranchStats[j]
		}
	}

	return resp, nil
}
