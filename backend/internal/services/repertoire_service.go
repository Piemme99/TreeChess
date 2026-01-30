package services

import (
	"errors"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"github.com/notnil/chess"

	"github.com/treechess/backend/config"
	"github.com/treechess/backend/internal/models"
	"github.com/treechess/backend/internal/repository"
)

// Custom errors for better error handling
var (
	// Repertoire errors
	ErrInvalidColor       = fmt.Errorf("invalid color")
	ErrRepertoireExists   = fmt.Errorf("repertoire already exists")
	ErrRepertoireNotFound = fmt.Errorf("repertoire not found")
	ErrNotFound           = fmt.Errorf("not found")
	ErrParentNotFound     = fmt.Errorf("parent node not found")
	ErrInvalidMove        = fmt.Errorf("invalid move")
	ErrMoveExists         = fmt.Errorf("move already exists")
	ErrCannotDeleteRoot   = fmt.Errorf("cannot delete root node")
	ErrNodeNotFound       = fmt.Errorf("node not found")
	ErrLimitReached       = fmt.Errorf("maximum repertoire limit reached (50)")
	ErrNameRequired       = fmt.Errorf("name is required")
	ErrNameTooLong        = fmt.Errorf("name must be 100 characters or less")

	// Game analysis errors
	ErrColorMismatch = fmt.Errorf("repertoire color does not match user color in game")

	// Lichess errors
	ErrLichessUserNotFound = fmt.Errorf("Lichess user not found")
	ErrLichessRateLimited  = fmt.Errorf("Lichess API rate limited, try again later")

	// Chess.com errors
	ErrChesscomUserNotFound = fmt.Errorf("Chess.com user not found")
	ErrChesscomRateLimited  = fmt.Errorf("Chess.com API rate limited, try again later")
)

// RepertoireService handles repertoire business logic
type RepertoireService struct {
	repo repository.RepertoireRepository
}

// NewRepertoireService creates a new repertoire service with the given repository
func NewRepertoireService(repo repository.RepertoireRepository) *RepertoireService {
	return &RepertoireService{repo: repo}
}

// CreateRepertoire creates a new repertoire with the given name and color for a user
func (s *RepertoireService) CreateRepertoire(userID string, name string, color models.Color) (*models.Repertoire, error) {
	if color != models.ColorWhite && color != models.ColorBlack {
		return nil, fmt.Errorf("%w: %s", ErrInvalidColor, color)
	}

	name = strings.TrimSpace(name)
	if name == "" {
		return nil, ErrNameRequired
	}
	if len(name) > config.MaxRepertoireNameLen {
		return nil, ErrNameTooLong
	}

	// Check repertoire limit
	count, err := s.repo.Count(userID)
	if err != nil {
		return nil, fmt.Errorf("failed to check repertoire count: %w", err)
	}
	if count >= config.MaxRepertoires {
		return nil, ErrLimitReached
	}

	return s.repo.Create(userID, name, color)
}

// GetRepertoire retrieves a repertoire by its ID
func (s *RepertoireService) GetRepertoire(id string) (*models.Repertoire, error) {
	rep, err := s.repo.GetByID(id)
	if err != nil {
		if errors.Is(err, repository.ErrRepertoireNotFound) {
			return nil, fmt.Errorf("%w: %w", ErrNotFound, err)
		}
		return nil, err
	}

	return rep, nil
}

// ListRepertoires returns all repertoires for a user, optionally filtered by color
func (s *RepertoireService) ListRepertoires(userID string, color *models.Color) ([]models.Repertoire, error) {
	if color != nil {
		if *color != models.ColorWhite && *color != models.ColorBlack {
			return nil, fmt.Errorf("%w: %s", ErrInvalidColor, *color)
		}
		return s.repo.GetByColor(userID, *color)
	}
	return s.repo.GetAll(userID)
}

// CheckOwnership verifies that a repertoire belongs to the given user
func (s *RepertoireService) CheckOwnership(id string, userID string) error {
	belongs, err := s.repo.BelongsToUser(id, userID)
	if err != nil {
		return fmt.Errorf("failed to check ownership: %w", err)
	}
	if !belongs {
		return ErrNotFound
	}
	return nil
}

// RenameRepertoire updates the name of a repertoire
func (s *RepertoireService) RenameRepertoire(id string, name string) (*models.Repertoire, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return nil, ErrNameRequired
	}
	if len(name) > config.MaxRepertoireNameLen {
		return nil, ErrNameTooLong
	}

	// Check if repertoire exists
	exists, err := s.repo.Exists(id)
	if err != nil {
		return nil, fmt.Errorf("failed to check repertoire existence: %w", err)
	}
	if !exists {
		return nil, fmt.Errorf("%w: %s", ErrNotFound, id)
	}

	return s.repo.UpdateName(id, name)
}

// DeleteRepertoire deletes a repertoire by ID
func (s *RepertoireService) DeleteRepertoire(id string) error {
	err := s.repo.Delete(id)
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
	rep, err := s.repo.GetByID(repertoireID)
	if err != nil {
		if errors.Is(err, repository.ErrRepertoireNotFound) {
			return nil, fmt.Errorf("%w: %w", ErrNotFound, err)
		}
		return nil, err
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
		Children:    []*models.RepertoireNode{},
	}

	parentNode.Children = append(parentNode.Children, newNode)

	newMetadata := calculateMetadata(rep.TreeData)

	return s.repo.Save(repertoireID, rep.TreeData, newMetadata)
}

// SaveTree saves a complete tree to a repertoire, replacing the existing tree data
func (s *RepertoireService) SaveTree(repertoireID string, treeData models.RepertoireNode) (*models.Repertoire, error) {
	_, err := s.repo.GetByID(repertoireID)
	if err != nil {
		if errors.Is(err, repository.ErrRepertoireNotFound) {
			return nil, fmt.Errorf("%w: %w", ErrNotFound, err)
		}
		return nil, err
	}

	metadata := calculateMetadata(treeData)
	return s.repo.Save(repertoireID, treeData, metadata)
}

// DeleteNode removes a node and its children from a repertoire
func (s *RepertoireService) DeleteNode(repertoireID string, nodeID string) (*models.Repertoire, error) {
	rep, err := s.repo.GetByID(repertoireID)
	if err != nil {
		if errors.Is(err, repository.ErrRepertoireNotFound) {
			return nil, fmt.Errorf("%w: %w", ErrNotFound, err)
		}
		return nil, err
	}

	if rep.TreeData.ID == nodeID {
		return nil, ErrCannotDeleteRoot
	}

	newTreeData := deleteNodeRecursive(rep.TreeData, nodeID)
	if newTreeData == nil {
		return nil, fmt.Errorf("%w: %s", ErrNodeNotFound, nodeID)
	}

	newMetadata := calculateMetadata(*newTreeData)

	return s.repo.Save(repertoireID, *newTreeData, newMetadata)
}

// SeedRepertoires creates starter repertoires from templates for the given user
func (s *RepertoireService) SeedRepertoires(userID string, templateIDs []string) ([]models.Repertoire, error) {
	var created []models.Repertoire

	for _, tmplID := range templateIDs {
		tmpl := GetTemplate(tmplID)
		if tmpl == nil {
			return nil, fmt.Errorf("unknown template: %s", tmplID)
		}

		tree, err := BuildTemplateTree(tmpl)
		if err != nil {
			return nil, fmt.Errorf("failed to build template %s: %w", tmplID, err)
		}

		// Check repertoire limit before creating
		count, err := s.repo.Count(userID)
		if err != nil {
			return nil, fmt.Errorf("failed to check repertoire count: %w", err)
		}
		if count >= config.MaxRepertoires {
			return nil, ErrLimitReached
		}

		rep, err := s.repo.Create(userID, tmpl.Name, tmpl.Color)
		if err != nil {
			return nil, fmt.Errorf("failed to create repertoire %s: %w", tmplID, err)
		}

		metadata := calculateMetadata(tree)
		saved, err := s.repo.Save(rep.ID, tree, metadata)
		if err != nil {
			return nil, fmt.Errorf("failed to save template tree %s: %w", tmplID, err)
		}

		created = append(created, *saved)
	}

	return created, nil
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
