package services

import (
	"context"
	"fmt"

	"github.com/notnil/chess"

	"github.com/kumquat/backend/internal/analysiscore"
	"github.com/kumquat/backend/internal/models"
	"github.com/kumquat/backend/internal/repertoiretree"
)

// TrainingService analyzes explorer training sessions against a user's
// repertoires. It was carved out of ImportService so the training feature no
// longer recompiles or retests with the PGN import path.
type TrainingService struct {
	repertoireService *RepertoireService
}

// NewTrainingService creates a new training service.
func NewTrainingService(repertoireSvc *RepertoireService) *TrainingService {
	return &TrainingService{repertoireService: repertoireSvc}
}

// AnalyzeTrainingMoves takes a sequence of SAN moves from an explorer training session,
// finds the best matching repertoire for the user, and returns per-move analysis.
func (s *TrainingService) AnalyzeTrainingMoves(ctx context.Context, userID string, moves []string, userColor models.Color) (*models.TrainingAnalyzeResponse, error) {
	// Load repertoires for the user's color
	repertoires, err := s.repertoireService.ListRepertoires(ctx, userID, &userColor)
	if err != nil {
		return nil, fmt.Errorf("failed to load repertoires: %w", err)
	}

	// Replay the moves to build FENs
	game := chess.NewGame()
	for _, san := range moves {
		if err := game.MoveStr(san); err != nil {
			return nil, fmt.Errorf("%w: %s - %v", ErrInvalidMove, san, err)
		}
	}

	// Find the best matching repertoire using the shared scoring logic.
	bestRepertoire, bestScore := analysiscore.BestMatch(repertoires, func(r *models.Repertoire) int {
		return countMatchingMovesInTree(game, &r.TreeData, userColor)
	})

	// Build per-move analysis
	moveAnalyses := analyzeGameFromChess(game, bestRepertoire, userColor)

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

// countMatchingMovesInTree counts how many of the user's moves are in the
// repertoire tree, returning -1 when the opponent's first move is not covered
// (signalling the repertoire must not be matched). It shares the move-walking
// shape used by the import path but operates on a tree pointer.
func countMatchingMovesInTree(game *chess.Game, root *models.RepertoireNode, userColor models.Color) int {
	index := repertoiretree.BuildFENIndex(root)

	moves := game.Moves()
	position := chess.StartingPosition()
	notation := chess.AlgebraicNotation{}
	matchCount := 0

	for ply, move := range moves {
		san := notation.Encode(position, move)
		currentFEN := normalizeFEN(position.String())

		if analysiscore.IsOpponentFirstMove(ply, userColor) {
			node := index[currentFEN]
			if node != nil && len(node.Children) > 0 && !repertoiretree.HasChildMove(node, san) {
				return -1
			}
		}

		if analysiscore.IsUserMove(ply, userColor) && repertoiretree.HasChildMove(index[currentFEN], san) {
			matchCount++
		}

		position = position.Update(move)
	}

	return matchCount
}

// analyzeGameFromChess produces per-move MoveAnalysis from a chess.Game against
// a repertoire (or nil repertoire).
func analyzeGameFromChess(game *chess.Game, repertoire *models.Repertoire, userColor models.Color) []models.MoveAnalysis {
	chessMovs := game.Moves()
	position := chess.StartingPosition()
	notation := chess.AlgebraicNotation{}
	result := make([]models.MoveAnalysis, 0, len(chessMovs))

	var index map[string]*models.RepertoireNode
	if repertoire != nil {
		index = repertoiretree.BuildFENIndex(&repertoire.TreeData)
	}

	for ply, move := range chessMovs {
		san := notation.Encode(position, move)
		currentFEN := normalizeFEN(position.String())
		isUserMove := analysiscore.IsUserMove(ply, userColor)

		var class analysiscore.Classification
		if index == nil {
			class = analysiscore.Classification{Status: analysiscore.StatusOutOfBook}
		} else {
			class = analysiscore.ClassifyMove(index[currentFEN], san, isUserMove)
		}

		result = append(result, models.MoveAnalysis{
			PlyNumber:    ply,
			SAN:          san,
			FEN:          currentFEN,
			Status:       class.Status,
			ExpectedMove: class.ExpectedMove,
			IsUserMove:   isUserMove,
		})

		position = position.Update(move)
	}

	return result
}
