package services

import (
	"errors"
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
	ErrLimitReached     = fmt.Errorf("maximum repertoire limit reached (50)")
	ErrNameRequired     = fmt.Errorf("name is required")
	ErrNameTooLong      = fmt.Errorf("name must be 100 characters or less")
)

type RepertoireService struct{}

func NewRepertoireService() *RepertoireService {
	return &RepertoireService{}
}

func NewTestRepertoireService() *RepertoireService {
	return NewRepertoireService()
}

// CreateRepertoire creates a new repertoire with the given name and color
func (s *RepertoireService) CreateRepertoire(name string, color models.Color) (*models.Repertoire, error) {
	if color != models.ColorWhite && color != models.ColorBlack {
		return nil, fmt.Errorf("%w: %s", ErrInvalidColor, color)
	}

	name = strings.TrimSpace(name)
	if name == "" {
		return nil, ErrNameRequired
	}
	if len(name) > 100 {
		return nil, ErrNameTooLong
	}

	// Check repertoire limit
	count, err := repository.CountRepertoires()
	if err != nil {
		return nil, fmt.Errorf("failed to check repertoire count: %w", err)
	}
	if count >= 50 {
		return nil, ErrLimitReached
	}

	return repository.CreateRepertoire(name, color)
}

// GetRepertoire retrieves a repertoire by its ID
func (s *RepertoireService) GetRepertoire(id string) (*models.Repertoire, error) {
	rep, err := repository.GetRepertoireByID(id)
	if err != nil {
		return nil, fmt.Errorf("%w: %w", ErrNotFound, err)
	}

	return rep, nil
}

// ListRepertoires returns all repertoires, optionally filtered by color
func (s *RepertoireService) ListRepertoires(color *models.Color) ([]models.Repertoire, error) {
	if color != nil {
		if *color != models.ColorWhite && *color != models.ColorBlack {
			return nil, fmt.Errorf("%w: %s", ErrInvalidColor, *color)
		}
		return repository.GetRepertoiresByColor(*color)
	}
	return repository.GetAllRepertoires()
}

// RenameRepertoire updates the name of a repertoire
func (s *RepertoireService) RenameRepertoire(id string, name string) (*models.Repertoire, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return nil, ErrNameRequired
	}
	if len(name) > 100 {
		return nil, ErrNameTooLong
	}

	// Check if repertoire exists
	exists, err := repository.RepertoireExistsByID(id)
	if err != nil {
		return nil, fmt.Errorf("failed to check repertoire existence: %w", err)
	}
	if !exists {
		return nil, fmt.Errorf("%w: %s", ErrNotFound, id)
	}

	return repository.UpdateRepertoireName(id, name)
}

// DeleteRepertoire deletes a repertoire by ID
func (s *RepertoireService) DeleteRepertoire(id string) error {
	err := repository.DeleteRepertoire(id)
	if err != nil {
		if errors.Is(err, repository.ErrRepertoireNotFound) {
			return fmt.Errorf("%w: %s", ErrNotFound, id)
		}
		return err
	}
	return nil
}

// AddNode adds a new node to a repertoire
func (s *RepertoireService) AddNode(repertoireID string, req models.AddNodeRequest) (*models.Repertoire, error) {
	rep, err := repository.GetRepertoireByID(repertoireID)
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

	return repository.SaveRepertoire(repertoireID, rep.TreeData, newMetadata)
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

// DeleteNode removes a node and its children from a repertoire
func (s *RepertoireService) DeleteNode(repertoireID string, nodeID string) (*models.Repertoire, error) {
	rep, err := repository.GetRepertoireByID(repertoireID)
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

	return repository.SaveRepertoire(repertoireID, *newTreeData, newMetadata)
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

// FindNode is an exported version for use by other services
func FindNode(root *models.RepertoireNode, id string) *models.RepertoireNode {
	return findNode(root, id)
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
