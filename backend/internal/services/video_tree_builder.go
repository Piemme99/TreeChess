package services

import (
	"fmt"
	"strings"

	"github.com/google/uuid"
	"github.com/notnil/chess"

	"github.com/treechess/backend/internal/models"
)

// TreeBuilderService builds repertoire trees from sequences of video positions
type TreeBuilderService struct{}

// NewTreeBuilderService creates a new tree builder service
func NewTreeBuilderService() *TreeBuilderService {
	return &TreeBuilderService{}
}

// BuildTreeFromPositions transforms a sequence of FEN positions into a repertoire tree
func (s *TreeBuilderService) BuildTreeFromPositions(positions []models.VideoPosition) (*models.RepertoireNode, models.Color, error) {
	if len(positions) == 0 {
		return nil, "", fmt.Errorf("no positions provided")
	}

	// Step 1: Deduplicate consecutive identical FENs
	deduped := deduplicateConsecutive(positions)
	if len(deduped) == 0 {
		return nil, "", fmt.Errorf("no valid positions after deduplication")
	}

	// Step 2: Build the tree with backtracking detection
	root, err := buildTree(deduped)
	if err != nil {
		return nil, "", err
	}

	// Step 3: Detect color
	color := detectColor(root)

	return root, color, nil
}

// deduplicateConsecutive merges consecutive frames with the same FEN, keeping the first timestamp
func deduplicateConsecutive(positions []models.VideoPosition) []models.VideoPosition {
	if len(positions) == 0 {
		return nil
	}

	var result []models.VideoPosition
	prev := positions[0]

	for i := 1; i < len(positions); i++ {
		currentFEN := normalizeBoardFEN(positions[i].FEN)
		prevFEN := normalizeBoardFEN(prev.FEN)

		if currentFEN != prevFEN {
			result = append(result, prev)
			prev = positions[i]
		}
	}
	result = append(result, prev)

	return result
}

// normalizeBoardFEN extracts just the board part (first field) from a FEN string
// This is used for comparison since the video recognition can't determine side-to-move
func normalizeBoardFEN(fen string) string {
	parts := strings.Fields(fen)
	if len(parts) > 0 {
		return parts[0]
	}
	return fen
}

// buildTree constructs a RepertoireNode tree from deduplicated positions
func buildTree(positions []models.VideoPosition) (*models.RepertoireNode, error) {
	if len(positions) == 0 {
		return nil, fmt.Errorf("no positions to build tree from")
	}

	// Create root node from starting position or first detected position
	startFEN := "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -"
	firstBoard := normalizeBoardFEN(positions[0].FEN)

	// Check if the first position is the starting position
	isStartPos := firstBoard == "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR"
	if !isStartPos {
		// Use the first position as the root
		startFEN = positions[0].FEN
	}

	root := &models.RepertoireNode{
		ID:          uuid.New().String(),
		FEN:         normalizeFEN4(startFEN),
		Move:        nil,
		MoveNumber:  0,
		ColorToMove: getColorFromFEN(startFEN),
		ParentID:    nil,
		Children:    []*models.RepertoireNode{},
	}

	// Track visited FEN -> node mapping for backtracking
	fenToNode := map[string]*models.RepertoireNode{
		normalizeBoardFEN(root.FEN): root,
	}

	// Path stack for tracking current position in the tree
	currentNode := root

	startIdx := 0
	if isStartPos {
		startIdx = 1
	}

	for i := startIdx; i < len(positions); i++ {
		pos := positions[i]
		currentBoard := normalizeBoardFEN(pos.FEN)

		// Check if this position was already seen (backtracking)
		if existingNode, ok := fenToNode[currentBoard]; ok {
			currentNode = existingNode
			continue
		}

		// Try to find the legal move from current position to new position
		move, resultingFEN, err := findLegalMove(currentNode.FEN, pos.FEN)
		if err != nil {
			// Can't find a legal move - might be a jump or bad recognition
			// Try to find a parent node that can reach this position
			found := false
			for fenStr, node := range fenToNode {
				_ = fenStr
				m, rFEN, e := findLegalMove(node.FEN, pos.FEN)
				if e == nil {
					currentNode = node
					move = m
					resultingFEN = rFEN
					found = true
					break
				}
			}
			if !found {
				// Skip this position - can't connect it to the tree
				continue
			}
		}

		// Check if this move already exists as a child
		var existingChild *models.RepertoireNode
		for _, child := range currentNode.Children {
			if child.Move != nil && *child.Move == move {
				existingChild = child
				break
			}
		}

		if existingChild != nil {
			currentNode = existingChild
			fenToNode[currentBoard] = existingChild
			continue
		}

		// Create new node
		moveNumber := calculateMoveNumber(currentNode)
		parentID := currentNode.ID

		newNode := &models.RepertoireNode{
			ID:          uuid.New().String(),
			FEN:         normalizeFEN4(resultingFEN),
			Move:        &move,
			MoveNumber:  moveNumber,
			ColorToMove: getColorFromFEN(resultingFEN),
			ParentID:    &parentID,
			Children:    []*models.RepertoireNode{},
		}

		currentNode.Children = append(currentNode.Children, newNode)
		fenToNode[currentBoard] = newNode
		currentNode = newNode
	}

	return root, nil
}

// findLegalMove finds the SAN notation of the legal move that transforms fromFEN to toFEN
func findLegalMove(fromFEN, toFEN string) (string, string, error) {
	fullFromFEN := ensureFullFEN6(fromFEN)
	targetBoard := normalizeBoardFEN(toFEN)

	fenFn, err := chess.FEN(fullFromFEN)
	if err != nil {
		return "", "", fmt.Errorf("invalid source FEN: %w", err)
	}

	game := chess.NewGame(fenFn)
	validMoves := game.ValidMoves()

	for _, move := range validMoves {
		// Try each legal move and check if resulting position matches
		testGame := chess.NewGame(fenFn)
		if err := testGame.Move(move); err != nil {
			continue
		}

		resultFEN := testGame.Position().String()
		resultBoard := normalizeBoardFEN(resultFEN)

		if resultBoard == targetBoard {
			// Found the move
			san := chess.AlgebraicNotation{}.Encode(game.Position(), move)
			return san, normalizeFEN4(resultFEN), nil
		}
	}

	return "", "", fmt.Errorf("no legal move found from %s to %s", normalizeBoardFEN(fromFEN), targetBoard)
}

// detectColor determines the repertoire color based on the first move direction
func detectColor(root *models.RepertoireNode) models.Color {
	if len(root.Children) == 0 {
		return models.ColorWhite
	}

	// If the root is the standard starting position and the first move is by white,
	// the user is probably studying white
	if root.ColorToMove == models.ChessColorWhite {
		return models.ColorWhite
	}
	return models.ColorBlack
}

// calculateMoveNumber calculates the move number for a new node
func calculateMoveNumber(parent *models.RepertoireNode) int {
	if parent.ColorToMove == models.ChessColorBlack {
		return parent.MoveNumber + 1
	}
	return parent.MoveNumber
}

// getColorFromFEN extracts the color to move from a FEN string
func getColorFromFEN(fen string) models.ChessColor {
	parts := strings.Fields(fen)
	if len(parts) >= 2 && parts[1] == "b" {
		return models.ChessColorBlack
	}
	return models.ChessColorWhite
}

// normalizeFEN4 normalizes a FEN to 4 fields (board, turn, castling, en passant)
func normalizeFEN4(fen string) string {
	parts := strings.Fields(fen)
	if len(parts) >= 4 {
		return strings.Join(parts[:4], " ")
	}
	return fen
}

// ensureFullFEN6 ensures a FEN has all 6 fields
func ensureFullFEN6(fen string) string {
	parts := strings.Fields(fen)
	if len(parts) >= 6 {
		return fen
	}
	if len(parts) == 4 {
		return fen + " 0 1"
	}
	if len(parts) == 1 {
		return fen + " w KQkq - 0 1"
	}
	return fen + " 0 1"
}
