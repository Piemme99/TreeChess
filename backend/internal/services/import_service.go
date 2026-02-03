package services

import (
	"crypto/sha256"
	"fmt"
	"strings"

	"github.com/notnil/chess"

	"github.com/treechess/backend/internal/models"
	"github.com/treechess/backend/internal/repository"
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
			fmt.Printf("warning: failed to save fingerprints: %v\n", err)
		}
	}

	// Enqueue engine analysis if available
	if s.engineService != nil {
		s.engineService.EnqueueAnalysis(userID, summary.ID, len(results))
	}

	return summary, results, nil
}

// findBestMatchingRepertoire finds the repertoire with the most matching moves
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

	return bestRepertoire, bestScore
}

// countMatchingMoves counts how many of the user's moves are in the repertoire
func (s *ImportService) countMatchingMoves(game *chess.Game, repertoireRoot models.RepertoireNode, userColor models.Color) int {
	moves := game.Moves()
	position := chess.StartingPosition()
	notation := chess.AlgebraicNotation{}
	matchCount := 0

	for ply, move := range moves {
		san := notation.Encode(position, move)
		currentFEN := normalizeFEN(position.String())
		isUserMove := (ply%2 == 0 && userColor == models.ColorWhite) || (ply%2 == 1 && userColor == models.ColorBlack)

		if isUserMove {
			if s.moveExistsInRepertoire(repertoireRoot, currentFEN, san) {
				matchCount++
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

		if isUserMove {
			if s.moveExistsInRepertoire(repertoireRoot, currentFEN, san) {
				status = "in-repertoire"
			} else {
				status = "out-of-repertoire"
				expectedMove = s.findExpectedMove(repertoireRoot, currentFEN)
			}
		} else {
			if s.moveExistsInRepertoire(repertoireRoot, currentFEN, san) {
				status = "in-repertoire"
			} else {
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

func (s *ImportService) moveExistsInRepertoire(root models.RepertoireNode, currentFEN, san string) bool {
	var search func(node models.RepertoireNode) bool
	search = func(node models.RepertoireNode) bool {
		if node.FEN == currentFEN {
			for _, child := range node.Children {
				if child.Move != nil && *child.Move == san {
					return true
				}
			}
			return false
		}
		for _, child := range node.Children {
			if search(*child) {
				return true
			}
		}
		return false
	}
	return search(root)
}

func (s *ImportService) findExpectedMove(root models.RepertoireNode, currentFEN string) string {
	var find func(node models.RepertoireNode) string
	find = func(node models.RepertoireNode) string {
		if node.FEN == currentFEN {
			for _, child := range node.Children {
				if child != nil && child.Move != nil {
					return *child.Move
				}
			}
			return ""
		}
		for _, child := range node.Children {
			if child != nil {
				if result := find(*child); result != "" {
					return result
				}
			}
		}
		return ""
	}
	return find(root)
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
func (s *ImportService) GetAllGames(userID string, limit, offset int, timeClass, repertoire, source string) (*models.GamesResponse, error) {
	response, err := s.analysisRepo.GetAllGames(userID, limit, offset, timeClass, repertoire, source)
	if err != nil {
		return nil, fmt.Errorf("failed to get games: %w", err)
	}
	return response, nil
}

// GetDistinctRepertoires returns a sorted list of distinct repertoire names for a user
func (s *ImportService) GetDistinctRepertoires(userID string) ([]string, error) {
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

// DeleteGame removes a single game from an analysis and its fingerprint
func (s *ImportService) DeleteGame(analysisID string, gameIndex int) error {
	if s.fingerprintRepo != nil {
		if err := s.fingerprintRepo.DeleteByAnalysisAndIndex(analysisID, gameIndex); err != nil {
			fmt.Printf("warning: failed to delete fingerprint: %v\n", err)
		}
	}
	return s.analysisRepo.DeleteGame(analysisID, gameIndex)
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

// reanalyzeGameFromMoves re-analyzes a game using its stored moves against a new repertoire
func (s *ImportService) reanalyzeGameFromMoves(game *models.GameAnalysis, repertoire *models.Repertoire) models.GameAnalysis {
	result := models.GameAnalysis{
		GameIndex: game.GameIndex,
		Headers:   game.Headers,
		Moves:     make([]models.MoveAnalysis, len(game.Moves)),
		UserColor: game.UserColor,
		MatchedRepertoire: &models.RepertoireRef{
			ID:   repertoire.ID,
			Name: repertoire.Name,
		},
		MatchScore: 0,
	}

	for i, move := range game.Moves {
		var status string
		var expectedMove string

		if move.IsUserMove {
			if s.moveExistsInRepertoire(repertoire.TreeData, move.FEN, move.SAN) {
				status = "in-repertoire"
				result.MatchScore++
			} else {
				status = "out-of-repertoire"
				expectedMove = s.findExpectedMove(repertoire.TreeData, move.FEN)
			}
		} else {
			if s.moveExistsInRepertoire(repertoire.TreeData, move.FEN, move.SAN) {
				status = "in-repertoire"
			} else {
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
	// Discard single-occurrence mistakes unless they're early (first 5 moves) and big (>=5% drop)
	for key, data := range mistakeGroups {
		// Skip dismissed mistakes and moves that exist in repertoires
		moveKey := key.FEN + "|" + key.PlayedMove
		if dismissedMistakes[moveKey] || repertoireMoves[moveKey] {
			continue
		}

		freq := len(data.seen)
		if freq == 1 && !(data.earliestPly <= 10 && data.winrateDrop >= 0.05) {
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
