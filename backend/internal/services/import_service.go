package services

import (
	"context"
	"crypto/sha256"
	"errors"
	"fmt"
	"log/slog"
	"strings"

	"github.com/notnil/chess"

	"github.com/kumquat/backend/config"
	"github.com/kumquat/backend/internal/analysiscore"
	"github.com/kumquat/backend/internal/models"
	"github.com/kumquat/backend/internal/repertoiretree"
	"github.com/kumquat/backend/internal/repository"
)

// ErrAllGamesDuplicate is returned when all games in an import already exist
var ErrAllGamesDuplicate = fmt.Errorf("all games have already been imported")

// ErrTooManyGames is returned when a single import exceeds
// config.MaxGamesPerImport games.
var ErrTooManyGames = fmt.Errorf("import exceeds the maximum of %d games", config.MaxGamesPerImport)

// ImportService handles game import and analysis business logic: parsing PGN,
// matching games to repertoires, classifying each move, deduplicating and
// saving. Dashboard aggregation, opening insights and training analysis live in
// their own focused services (DashboardStatsService, InsightsService,
// TrainingService) so that those features no longer recompile or retest with
// the import path.
type ImportService struct {
	repertoireService *RepertoireService
	analysisRepo      repository.AnalysisRepository
	fingerprintRepo   repository.GameFingerprintRepository
	engineService     *EngineService
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

// ParseAndAnalyze parses PGN data and analyzes games against repertoires
func (s *ImportService) ParseAndAnalyze(ctx context.Context, filename string, username string, userID string, pgnData string) (*models.AnalysisSummary, []models.GameAnalysis, error) {
	games, err := s.parsePGN(pgnData)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to parse PGN: %w", err)
	}

	if len(games) == 0 {
		return nil, nil, fmt.Errorf("no games found in PGN")
	}

	if len(games) > config.MaxGamesPerImport {
		return nil, nil, ErrTooManyGames
	}

	// Get all repertoires upfront
	whiteColor := models.ColorWhite
	blackColor := models.ColorBlack
	whiteRepertoires, err := s.repertoireService.ListRepertoires(ctx, userID, &whiteColor)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to get white repertoires: %w", err)
	}
	blackRepertoires, err := s.repertoireService.ListRepertoires(ctx, userID, &blackColor)
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

		existing, err := s.fingerprintRepo.CheckExisting(ctx, userID, fingerprints)
		if err != nil {
			return nil, nil, fmt.Errorf("failed to check fingerprints: %w", err)
		}

		var filtered []models.GameAnalysis
		seen := make(map[string]bool)
		for i, r := range results {
			fp := fingerprints[i]
			if existing[fp] || seen[fp] {
				continue
			}
			seen[fp] = true
			filtered = append(filtered, r)
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

	summary, err := s.analysisRepo.Save(ctx, userID, username, filename, len(results), results)
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
		if err := s.fingerprintRepo.SaveBatch(ctx, userID, summary.ID, entries); err != nil {
			// Log but don't fail the import
			slog.Warn("failed to save fingerprints", "analysis_id", summary.ID, "error", err)
		}
	}

	// Enqueue engine analysis if available
	if s.engineService != nil {
		s.engineService.EnqueueAnalysis(ctx, userID, summary.ID, len(results))
	}

	return summary, results, nil
}

// findBestMatchingRepertoire finds the repertoire with the most matching moves.
// Returns nil when no repertoire covers the opponent's first move.
func (s *ImportService) findBestMatchingRepertoire(game *chess.Game, repertoires []models.Repertoire, userColor models.Color) (*models.Repertoire, int) {
	return analysiscore.BestMatch(repertoires, func(r *models.Repertoire) int {
		return s.countMatchingMoves(game, r.TreeData, userColor)
	})
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
		isUserMove := analysiscore.IsUserMove(ply, userColor)

		// Reject repertoire if the opponent's very first move is not covered.
		if analysiscore.IsOpponentFirstMove(ply, userColor) {
			node := s.findNodeInRepertoire(repertoireRoot, currentFEN)
			if node != nil && len(node.Children) > 0 && !repertoiretree.HasChildMove(node, san) {
				return -1
			}
		}

		if isUserMove {
			node := s.findNodeInRepertoire(repertoireRoot, currentFEN)
			if repertoiretree.HasChildMove(node, san) {
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
		isUserMove := analysiscore.IsUserMove(ply, userColor)

		node := s.findNodeInRepertoire(repertoireRoot, currentFEN)
		class := analysiscore.ClassifyMove(node, san, isUserMove)

		analysis.Moves = append(analysis.Moves, models.MoveAnalysis{
			PlyNumber:    ply,
			SAN:          san,
			FEN:          currentFEN,
			Status:       class.Status,
			ExpectedMove: class.ExpectedMove,
			IsUserMove:   isUserMove,
		})
		position = position.Update(move)
	}

	return analysis
}

// NormalizeFEN strips half-move and full-move counters from a FEN string,
// keeping only board, side to move, castling, and en passant fields.
func NormalizeFEN(fen string) string {
	return repertoiretree.NormalizeFEN(fen)
}

// normalizeFEN is the package-internal alias kept for existing callers.
func normalizeFEN(fen string) string { return repertoiretree.NormalizeFEN(fen) }

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
	return repertoiretree.FindByFEN(&root, currentFEN)
}

// ValidatePGN validates PGN format. parsePGN skips unparsable games rather
// than failing, so the meaningful signal is whether any game survived.
func (s *ImportService) ValidatePGN(pgnData string) error {
	games, err := s.parsePGN(pgnData)
	if err != nil {
		return fmt.Errorf("invalid PGN format: %w", err)
	}
	if len(games) == 0 {
		return fmt.Errorf("invalid PGN format: no parsable games found")
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
	// move.String() is UCI ("e2e4"); the API convention everywhere else
	// (repertoire moves, MoveAnalysis.SAN, validate-move) is SAN.
	notation := chess.AlgebraicNotation{}
	sanMoves := make([]string, len(moves))
	for i, move := range moves {
		sanMoves[i] = notation.Encode(game.Position(), move)
	}
	return sanMoves, nil
}

// GetAnalyses returns all analyses summaries for a user
func (s *ImportService) GetAnalyses(ctx context.Context, userID string) ([]models.AnalysisSummary, error) {
	analyses, err := s.analysisRepo.GetAll(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get analyses: %w", err)
	}
	return analyses, nil
}

// GetAnalysisByID returns detailed analysis by ID, scoped to the owning user
func (s *ImportService) GetAnalysisByID(ctx context.Context, id string, userID string) (*models.AnalysisDetail, error) {
	return s.analysisRepo.GetByID(ctx, id, userID)
}

// DeleteAnalysis deletes an analysis by ID, scoped to the owning user
func (s *ImportService) DeleteAnalysis(ctx context.Context, id string, userID string) error {
	return s.analysisRepo.Delete(ctx, id, userID)
}

// GetAllGames returns all games from all analyses with pagination for a user
func (s *ImportService) GetAllGames(ctx context.Context, userID string, limit, offset int, timeClass, repertoire, source string, onlyNew bool) (*models.GamesResponse, error) {
	response, err := s.analysisRepo.GetAllGames(ctx, userID, limit, offset, timeClass, repertoire, source, onlyNew)
	if err != nil {
		return nil, fmt.Errorf("failed to get games: %w", err)
	}
	return response, nil
}

// GetDistinctRepertoires returns a sorted list of distinct repertoires for a user
func (s *ImportService) GetDistinctRepertoires(ctx context.Context, userID string) ([]models.RepertoireFilterOption, error) {
	return s.analysisRepo.GetDistinctRepertoires(ctx, userID)
}

// MarkGameViewed marks a specific game as viewed by the user
func (s *ImportService) MarkGameViewed(ctx context.Context, userID, analysisID string, gameIndex int) error {
	return s.analysisRepo.MarkGameViewed(ctx, userID, analysisID, gameIndex)
}

// CheckOwnership verifies that an analysis belongs to the given user
func (s *ImportService) CheckOwnership(ctx context.Context, id string, userID string) error {
	belongs, err := s.analysisRepo.BelongsToUser(ctx, id, userID)
	if err != nil {
		return fmt.Errorf("failed to check ownership: %w", err)
	}
	if !belongs {
		return ErrNotFound
	}
	return nil
}

// ReanalyzeGame re-analyzes a specific game against a different repertoire,
// scoped to the owning user.
//
// The read-modify-write of the analysis results runs inside the repository's
// row-locked MutateResults transaction so it cannot clobber (or be clobbered
// by) a concurrent auto re-analysis touching the same analysis. The game is
// located and its color validated against the freshly-locked data, not a stale
// snapshot. Both the repertoire fetch and the results mutation are scoped to
// userID so a cross-tenant analysis or repertoire ID surfaces as not-found.
func (s *ImportService) ReanalyzeGame(ctx context.Context, analysisID string, userID string, gameIndex int, repertoireID string) (*models.GameAnalysis, error) {
	repertoire, err := s.repertoireService.GetRepertoire(ctx, repertoireID, userID)
	if err != nil {
		return nil, fmt.Errorf("%w: %w", ErrRepertoireNotFound, err)
	}

	// Build the FEN index once, outside the transaction, so the locked window
	// stays as short as possible.
	index := repertoiretree.BuildFENIndex(&repertoire.TreeData)
	reperRef := &models.RepertoireRef{ID: repertoire.ID, Name: repertoire.Name}

	var reanalyzedGame models.GameAnalysis
	err = s.analysisRepo.MutateResults(ctx, analysisID, userID, func(current []models.GameAnalysis) ([]models.GameAnalysis, bool, error) {
		targetIdx := -1
		for i := range current {
			if current[i].GameIndex == gameIndex {
				targetIdx = i
				break
			}
		}
		if targetIdx == -1 {
			return nil, false, repository.ErrGameNotFound
		}

		if repertoire.Color != current[targetIdx].UserColor {
			return nil, false, ErrColorMismatch
		}

		reanalyzedGame = s.reanalyzeGameWithIndex(&current[targetIdx], reperRef, index)
		current[targetIdx] = reanalyzedGame
		return current, true, nil
	})
	if err != nil {
		if errors.Is(err, repository.ErrGameNotFound) || errors.Is(err, ErrColorMismatch) || errors.Is(err, repository.ErrAnalysisNotFound) {
			return nil, err
		}
		return nil, fmt.Errorf("failed to save reanalyzed game: %w", err)
	}

	return &reanalyzedGame, nil
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
		node := index[move.FEN]
		class := analysiscore.ClassifyMove(node, move.SAN, move.IsUserMove)
		if class.Status == analysiscore.StatusInRepertoire && move.IsUserMove {
			result.MatchScore++
		}

		result.Moves[i] = models.MoveAnalysis{
			PlyNumber:    move.PlyNumber,
			SAN:          move.SAN,
			FEN:          move.FEN,
			Status:       class.Status,
			ExpectedMove: class.ExpectedMove,
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
func (s *ImportService) ReanalyzeAllGames(ctx context.Context, userID string, preserveAnalysed bool) (int, error) {
	analyses, err := s.analysisRepo.GetAllGamesRaw(ctx, userID)
	if err != nil {
		return 0, fmt.Errorf("failed to get analyses: %w", err)
	}

	whiteColor := models.ColorWhite
	blackColor := models.ColorBlack
	whiteRepertoires, err := s.repertoireService.ListRepertoires(ctx, userID, &whiteColor)
	if err != nil {
		return 0, fmt.Errorf("failed to get white repertoires: %w", err)
	}
	blackRepertoires, err := s.repertoireService.ListRepertoires(ctx, userID, &blackColor)
	if err != nil {
		return 0, fmt.Errorf("failed to get black repertoires: %w", err)
	}

	// Precompute a FEN index per repertoire once, then reuse it across every game and
	// move. This replaces the per-move full-tree recursion of findNodeInRepertoire,
	// which made re-analysis O(repertoires × moves × tree) on each repertoire edit.
	whiteIndexed := indexRepertoires(whiteRepertoires)
	blackIndexed := indexRepertoires(blackRepertoires)

	// Each analysis is re-analyzed under its own row-locked transaction
	// (MutateResults) rather than overwriting the unlocked snapshot read above.
	// This serializes against the manual single-game path and any concurrent
	// auto run, so the two cannot clobber each other's writes. The snapshot is
	// used only to enumerate which analyses to process; the mutation always
	// operates on the freshly-locked results.
	totalGames := 0
	for _, a := range analyses {
		analysisID := a.ID
		err := s.analysisRepo.MutateResults(ctx, analysisID, userID, func(current []models.GameAnalysis) ([]models.GameAnalysis, bool, error) {
			modified := false
			for i := range current {
				game := &current[i]
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

				current[i] = reanalyzed
				modified = true
			}
			return current, modified, nil
		})
		if err != nil {
			// The analysis may have been deleted between the snapshot read and the
			// locked mutation; skip it rather than failing the whole run.
			if errors.Is(err, repository.ErrAnalysisNotFound) {
				continue
			}
			return 0, fmt.Errorf("failed to update analysis %s: %w", analysisID, err)
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
			index:      repertoiretree.BuildFENIndex(&repertoires[i].TreeData),
		}
	}
	return indexed
}

// findBestMatchingRepertoireFromStored finds the best matching repertoire using stored move FENs.
// Returns nil when no repertoire covers the opponent's first move.
func (s *ImportService) findBestMatchingRepertoireFromStored(game *models.GameAnalysis, repertoires []indexedRepertoire) (*indexedRepertoire, int) {
	return analysiscore.BestMatch(repertoires, func(r *indexedRepertoire) int {
		return countMatchingMovesFromStored(game, r.index)
	})
}

// countMatchingMovesFromStored counts matching user moves using stored FENs against a
// prebuilt FEN index instead of replaying the game or recursing the tree per move.
// Returns -1 if the opponent's first move is not covered by the repertoire.
func countMatchingMovesFromStored(game *models.GameAnalysis, index map[string]*models.RepertoireNode) int {
	// Check opponent's first move before counting.
	for _, move := range game.Moves {
		if !analysiscore.IsOpponentFirstMove(move.PlyNumber, game.UserColor) {
			continue
		}
		node := index[move.FEN]
		if node != nil && len(node.Children) > 0 && !repertoiretree.HasChildMove(node, move.SAN) {
			return -1
		}
		break
	}

	matchCount := 0
	for _, move := range game.Moves {
		if !move.IsUserMove {
			continue
		}
		if repertoiretree.HasChildMove(index[move.FEN], move.SAN) {
			matchCount++
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
