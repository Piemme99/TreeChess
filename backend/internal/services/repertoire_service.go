package services

import (
	"fmt"
	"strings"

	"github.com/google/uuid"
	"github.com/notnil/chess"

	"github.com/treechess/backend/internal/models"
	"github.com/treechess/backend/internal/repository"
)

// Custom errors for better error handling
var (
	ErrInvalidColor     = fmt.Errorf("invalid color")
	ErrRepertoireExists = fmt.Errorf("repertoire already exists")
	ErrNotFound         = fmt.Errorf("not found")
	ErrParentNotFound   = fmt.Errorf("parent node not found")
	ErrInvalidMove      = fmt.Errorf("invalid move")
	ErrMoveExists       = fmt.Errorf("move already exists")
	ErrCannotDeleteRoot = fmt.Errorf("cannot delete root node")
	ErrNodeNotFound     = fmt.Errorf("node not found")
)

type RepertoireService struct{}

func NewRepertoireService() *RepertoireService {
	return &RepertoireService{}
}

func NewTestRepertoireService() *RepertoireService {
	return NewRepertoireService()
}

func (s *RepertoireService) CreateRepertoire(color models.Color) (*models.Repertoire, error) {
	if color != models.ColorWhite && color != models.ColorBlack {
		return nil, fmt.Errorf("%w: %s", ErrInvalidColor, color)
	}

	exists, err := repository.RepertoireExists(color)
	if err != nil {
		return nil, fmt.Errorf("failed to check repertoire existence: %w", err)
	}
	if exists {
		return nil, fmt.Errorf("%w: %s", ErrRepertoireExists, color)
	}

	return repository.CreateRepertoire(color)
}

func (s *RepertoireService) GetRepertoire(color models.Color) (*models.Repertoire, error) {
	if color != models.ColorWhite && color != models.ColorBlack {
		return nil, fmt.Errorf("%w: %s", ErrInvalidColor, color)
	}

	rep, err := repository.GetRepertoireByColor(color)
	if err != nil {
		return nil, fmt.Errorf("%w: %w", ErrNotFound, err)
	}

	return rep, nil
}

func (s *RepertoireService) AddNode(color models.Color, req models.AddNodeRequest) (*models.Repertoire, error) {
	rep, err := repository.GetRepertoireByColor(color)
	if err != nil {
		return nil, fmt.Errorf("%w: %w", ErrNotFound, err)
	}

	parentNode := findNode(&rep.TreeData, req.ParentID)
	if parentNode == nil {
		return nil, fmt.Errorf("%w: %s", ErrParentNotFound, req.ParentID)
	}

	// Check if move already exists as child
	if moveExistsAsChild(parentNode, req.Move) {
		return nil, fmt.Errorf("%w: %s", ErrMoveExists, req.Move)
	}

	// Validate move legality using chess library
	resultingFEN, err := validateAndGetResultingFEN(parentNode.FEN, req.Move)
	if err != nil {
		return nil, fmt.Errorf("%w: %s - %v", ErrInvalidMove, req.Move, err)
	}

	// Calculate colorToMove from resulting FEN
	colorToMove := getColorToMoveFromFEN(resultingFEN)

	newNode := &models.RepertoireNode{
		ID:          uuid.New().String(),
		FEN:         resultingFEN,
		Move:        &req.Move,
		MoveNumber:  req.MoveNumber,
		ColorToMove: colorToMove,
		ParentID:    &req.ParentID,
		Children:    []*models.RepertoireNode{}, // Empty slice, not nil
	}

	parentNode.Children = append(parentNode.Children, newNode)

	newMetadata := calculateMetadata(rep.TreeData)

	return repository.SaveRepertoire(color, rep.TreeData, newMetadata)
}

// validateAndGetResultingFEN validates a move and returns the resulting FEN
func validateAndGetResultingFEN(fen, san string) (string, error) {
	fullFEN := ensureFullFEN(fen)
	fenFn, err := chess.FEN(fullFEN)
	if err != nil {
		return "", fmt.Errorf("invalid FEN: %w", err)
	}

	game := chess.NewGame(fenFn)
	err = game.MoveStr(san)
	if err != nil {
		return "", fmt.Errorf("illegal move: %w", err)
	}

	// Return normalized FEN (4 components)
	return normalizeFEN(game.Position().String()), nil
}

// getColorToMoveFromFEN extracts the color to move from a FEN string
func getColorToMoveFromFEN(fen string) models.ChessColor {
	parts := strings.Fields(fen)
	if len(parts) >= 2 && parts[1] == "b" {
		return models.ChessColorBlack
	}
	return models.ChessColorWhite
}

// ensureFullFEN and normalizeFEN are defined in import_service.go

func (s *RepertoireService) DeleteNode(color models.Color, nodeID string) (*models.Repertoire, error) {
	if color != models.ColorWhite && color != models.ColorBlack {
		return nil, fmt.Errorf("%w: %s", ErrInvalidColor, color)
	}

	rep, err := repository.GetRepertoireByColor(color)
	if err != nil {
		return nil, fmt.Errorf("%w: %w", ErrNotFound, err)
	}

	if rep.TreeData.ID == nodeID {
		return nil, ErrCannotDeleteRoot
	}

	newTreeData := deleteNodeRecursive(rep.TreeData, nodeID)
	if newTreeData == nil {
		return nil, fmt.Errorf("%w: %s", ErrNodeNotFound, nodeID)
	}

	newMetadata := calculateMetadata(*newTreeData)

	return repository.SaveRepertoire(color, *newTreeData, newMetadata)
}

func findNode(root *models.RepertoireNode, id string) *models.RepertoireNode {
	if root.ID == id {
		return root
	}

	for i := range root.Children {
		if found := findNode(root.Children[i], id); found != nil {
			return found
		}
	}

	return nil
}

// moveExistsAsChild checks if a move already exists as a child of the parent node
func moveExistsAsChild(parent *models.RepertoireNode, moveSAN string) bool {
	for _, child := range parent.Children {
		if child.Move != nil && *child.Move == moveSAN {
			return true
		}
	}
	return false
}

func deleteNodeRecursive(root models.RepertoireNode, idToDelete string) *models.RepertoireNode {
	for i := range root.Children {
		if root.Children[i].ID == idToDelete {
			root.Children = append(root.Children[:i], root.Children[i+1:]...)
			return &root
		}
		if childResult := deleteNodeRecursive(*root.Children[i], idToDelete); childResult != nil {
			root.Children[i] = childResult
			return &root
		}
	}
	return nil
}

func calculateMetadata(root models.RepertoireNode) models.Metadata {
	var totalNodes, totalMoves, maxDepth int

	walkTree(&root, 0, &totalNodes, &totalMoves, &maxDepth)

	return models.Metadata{
		TotalNodes:   totalNodes,
		TotalMoves:   totalMoves,
		DeepestDepth: maxDepth,
	}
}

func walkTree(node *models.RepertoireNode, currentDepth int, totalNodes, totalMoves, maxDepth *int) {
	*totalNodes++
	if node.Move != nil {
		*totalMoves++
	}
	if currentDepth > *maxDepth {
		*maxDepth = currentDepth
	}

	for _, child := range node.Children {
		walkTree(child, currentDepth+1, totalNodes, totalMoves, maxDepth)
	}
}

