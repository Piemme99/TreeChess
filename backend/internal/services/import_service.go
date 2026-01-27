package services

import (
	"fmt"
	"strings"

	"github.com/notnil/chess"

	"github.com/treechess/backend/internal/models"
	"github.com/treechess/backend/internal/repository"
)

type ImportService struct {
	repertoireService *RepertoireService
}

func NewImportService(repertoireSvc *RepertoireService) *ImportService {
	return &ImportService{
		repertoireService: repertoireSvc,
	}
}

func (s *ImportService) ParseAndAnalyze(filename string, username string, pgnData string) (*models.AnalysisSummary, []models.GameAnalysis, error) {
	games, err := s.parsePGN(pgnData)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to parse PGN: %w", err)
	}

	if len(games) == 0 {
		return nil, nil, fmt.Errorf("no games found in PGN")
	}

	// Get all repertoires upfront
	whiteRepertoires, err := s.repertoireService.ListRepertoires(&[]models.Color{models.ColorWhite}[0])
	if err != nil {
		return nil, nil, fmt.Errorf("failed to get white repertoires: %w", err)
	}
	blackRepertoires, err := s.repertoireService.ListRepertoires(&[]models.Color{models.ColorBlack}[0])
	if err != nil {
		return nil, nil, fmt.Errorf("failed to get black repertoires: %w", err)
	}

	var results []models.GameAnalysis
	resultIndex := 0
	for _, game := range games {
		// Determine which color the user played based on username
		userColor := s.determineUserColor(game, username)
		if userColor == "" {
			// User not found in this game, skip it
			continue
		}

		// Select repertoires based on user's color
		var repertoires []models.Repertoire
		if userColor == models.ColorWhite {
			repertoires = whiteRepertoires
		} else {
			repertoires = blackRepertoires
		}

		// Find best matching repertoire
		bestRepertoire, matchScore := s.findBestMatchingRepertoire(game, repertoires, userColor)

		var analysis models.GameAnalysis
		if bestRepertoire == nil {
			// No repertoire available - analyze with empty repertoire tree
			// All user moves will be marked as "out-of-repertoire"
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

	summary, err := repository.SaveAnalysis(username, filename, len(results), results)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to save analysis: %w", err)
	}

	return summary, results, nil
}

// findBestMatchingRepertoire finds the repertoire with the most matching moves
func (s *ImportService) findBestMatchingRepertoire(game *chess.Game, repertoires []models.Repertoire, userColor models.Color) (*models.Repertoire, int) {
	if len(repertoires) == 0 {
		return nil, 0
	}

	var bestRepertoire *models.Repertoire
	bestScore := -1 // Start at -1 so even 0 matches will be selected

	for i := range repertoires {
		score := s.countMatchingMoves(game, repertoires[i].TreeData, userColor)
		if score > bestScore {
			bestScore = score
			bestRepertoire = &repertoires[i]
		}
	}

	// bestScore will be at least 0 (from first repertoire), so bestRepertoire is guaranteed non-nil
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

	// Case-insensitive comparison
	usernameLower := strings.ToLower(username)
	if strings.ToLower(white) == usernameLower {
		return models.ColorWhite
	}
	if strings.ToLower(black) == usernameLower {
		return models.ColorBlack
	}
	return "" // User not found in this game
}

func (s *ImportService) parsePGN(pgnData string) ([]*chess.Game, error) {
	reader := strings.NewReader(pgnData)
	games, err := chess.GamesFromPGN(reader)
	if err != nil {
		return nil, fmt.Errorf("failed to parse PGN: %w", err)
	}

	// Filter out empty games (the notnil/chess library creates phantom games
	// when PGN data ends with trailing newlines)
	var validGames []*chess.Game
	for _, game := range games {
		if len(game.Moves()) > 0 {
			validGames = append(validGames, game)
		}
	}

	return validGames, nil
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
		// Use AlgebraicNotation encoder to get proper SAN (e4) instead of UCI (e2e4)
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

func normalizeFEN(fen string) string {
	parts := strings.Fields(fen)
	if len(parts) >= 4 {
		return strings.Join(parts[:4], " ")
	}
	return fen
}

func (s *ImportService) extractHeaders(game *chess.Game) models.PGNHeaders {
	headers := make(models.PGNHeaders)

	pgnOutput := game.String()
	lines := strings.Split(pgnOutput, "\n")
	for _, line := range lines {
		if strings.HasPrefix(line, "[") && strings.HasSuffix(line, "]") {
			tagContent := strings.Trim(line, "[]")
			parts := strings.SplitN(tagContent, " ", 2)
			if len(parts) == 2 {
				key := strings.Trim(parts[0], `"`)
				value := strings.Trim(parts[1], `"`)
				headers[key] = value
			}
		}
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

func (s *ImportService) ValidatePGN(pgnData string) error {
	_, err := s.parsePGN(pgnData)
	if err != nil {
		return fmt.Errorf("invalid PGN format: %w", err)
	}
	return nil
}

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

// GetAnalyses returns all analyses summaries
func (s *ImportService) GetAnalyses() ([]models.AnalysisSummary, error) {
	analyses, err := repository.GetAnalyses()
	if err != nil {
		return nil, fmt.Errorf("failed to get analyses: %w", err)
	}
	return analyses, nil
}

// GetAnalysisByID returns detailed analysis by ID
func (s *ImportService) GetAnalysisByID(id string) (*models.AnalysisDetail, error) {
	detail, err := repository.GetAnalysisByID(id)
	if err != nil {
		return nil, err // Error already contains "not found" info
	}
	return detail, nil
}

// DeleteAnalysis deletes an analysis by ID
func (s *ImportService) DeleteAnalysis(id string) error {
	err := repository.DeleteAnalysis(id)
	if err != nil {
		return err // Error already contains "not found" info
	}
	return nil
}

// GetAllGames returns all games from all analyses with pagination
func (s *ImportService) GetAllGames(limit, offset int) (*models.GamesResponse, error) {
	response, err := repository.GetAllGames(limit, offset)
	if err != nil {
		return nil, fmt.Errorf("failed to get games: %w", err)
	}
	return response, nil
}

// DeleteGame removes a single game from an analysis
func (s *ImportService) DeleteGame(analysisID string, gameIndex int) error {
	err := repository.DeleteGame(analysisID, gameIndex)
	if err != nil {
		return err // Error already contains context
	}
	return nil
}

// ReanalyzeGame re-analyzes a specific game against a different repertoire
func (s *ImportService) ReanalyzeGame(analysisID string, gameIndex int, repertoireID string) (*models.GameAnalysis, error) {
	// Get the analysis detail
	detail, err := repository.GetAnalysisByID(analysisID)
	if err != nil {
		return nil, err
	}

	// Find the game
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
		return nil, fmt.Errorf("game not found")
	}

	// Get the specified repertoire
	repertoire, err := s.repertoireService.GetRepertoire(repertoireID)
	if err != nil {
		return nil, fmt.Errorf("failed to get repertoire: %w", err)
	}

	// Verify the repertoire color matches the user's color in the game
	if repertoire.Color != targetGame.UserColor {
		return nil, fmt.Errorf("repertoire color (%s) does not match user's color in game (%s)", repertoire.Color, targetGame.UserColor)
	}

	// Re-analyze the game using the stored moves
	reanalyzedGame := s.reanalyzeGameFromMoves(targetGame, repertoire)

	// Update the results in the database
	detail.Results[targetIdx] = reanalyzedGame
	err = repository.UpdateAnalysisResults(analysisID, detail.Results)
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

	// Re-classify each move against the new repertoire
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
