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

func (s *ImportService) ParseAndAnalyze(filename string, color models.Color, pgnData string) (*models.AnalysisSummary, []models.GameAnalysis, error) {
	games, err := s.parsePGN(pgnData)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to parse PGN: %w", err)
	}

	if len(games) == 0 {
		return nil, nil, fmt.Errorf("no games found in PGN")
	}

	repertoire, err := s.repertoireService.GetRepertoire(color)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to get repertoire: %w", err)
	}

	results := make([]models.GameAnalysis, len(games))
	for i, game := range games {
		results[i] = s.analyzeGame(i, game, repertoire.TreeData, color)
	}

	summary, err := repository.SaveAnalysis(color, filename, len(games), results)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to save analysis: %w", err)
	}

	return summary, results, nil
}

func (s *ImportService) parsePGN(pgnData string) ([]*chess.Game, error) {
	reader := strings.NewReader(pgnData)
	games, err := chess.GamesFromPGN(reader)
	if err != nil {
		return nil, fmt.Errorf("failed to parse PGN: %w", err)
	}
	return games, nil
}

func (s *ImportService) analyzeGame(gameIndex int, game *chess.Game, repertoireRoot models.RepertoireNode, userColor models.Color) models.GameAnalysis {
	analysis := models.GameAnalysis{
		GameIndex: gameIndex,
		Headers:   s.extractHeaders(game),
		Moves:     []models.MoveAnalysis{},
	}

	moves := game.Moves()
	position := chess.StartingPosition()

	for ply, move := range moves {
		san := move.String()
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
