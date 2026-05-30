package services

import (
	"errors"
	"fmt"
	"regexp"
	"strings"

	"github.com/google/uuid"
	"github.com/notnil/chess"

	"github.com/kumquat/backend/config"
	"github.com/kumquat/backend/internal/models"
	"github.com/kumquat/backend/internal/repository"
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
	ErrCannotExtractRoot  = fmt.Errorf("cannot extract root node")
	ErrNodeNotFound       = fmt.Errorf("node not found")
	ErrLimitReached       = fmt.Errorf("maximum repertoire limit reached (50)")
	ErrNameRequired       = fmt.Errorf("name is required")
	ErrNameTooLong        = fmt.Errorf("name must be 100 characters or less")
	ErrDescriptionTooLong = fmt.Errorf("description must be 500 characters or less")
	ErrMergeMinimumTwo    = fmt.Errorf("at least two repertoires are required to merge")
	ErrMergeColorMismatch = fmt.Errorf("cannot merge repertoires of different colors")
	ErrMergeDuplicateIDs  = fmt.Errorf("duplicate repertoire IDs")
	// ErrConflict wraps an optimistic-lock failure from the repository so handlers
	// can map it to HTTP 409 without importing the repository package.
	ErrConflict = fmt.Errorf("repertoire was modified by another write")

	// Game analysis errors
	ErrColorMismatch = fmt.Errorf("repertoire color does not match user color in game")

	// Lichess errors
	ErrLichessUserNotFound = fmt.Errorf("lichess user not found")
	ErrLichessRateLimited  = fmt.Errorf("lichess API rate limited, try again later")

	// Chess.com errors
	ErrChesscomUserNotFound = fmt.Errorf("chess.com user not found")
	ErrChesscomRateLimited  = fmt.Errorf("chess.com API rate limited, try again later")

	// PGN parsing errors
	ErrCustomStartingPosition = fmt.Errorf("chapter uses a custom starting position and cannot be imported as a repertoire")

	// Lichess study errors
	ErrLichessStudyNotFound  = fmt.Errorf("lichess study not found")
	ErrLichessStudyForbidden = fmt.Errorf("lichess study is private, authentication required")
)

// RepertoireRepository interface for repository operations
type RepertoireRepository interface {
	repository.RepertoireRepository
	CreateWithCategory(userID, name string, color models.Color, categoryID *string) (*models.Repertoire, error)
	CreateWithIsPublic(userID, name string, color models.Color, isPublic bool) (*models.Repertoire, error)
	CreateWithIsPublicAndDescription(userID, name, description string, color models.Color, isPublic bool) (*models.Repertoire, error)
	UpdateCategory(id string, userID string, categoryID *string) (*models.Repertoire, error)
	UpdateVisibility(id string, userID string, isPublic bool) (*models.Repertoire, error)
	UpdateOrigin(id string, origin *models.RepertoireOrigin) error
	GetByCategory(categoryID string) ([]models.Repertoire, error)
	GetUncategorized(userID string, color models.Color) ([]models.Repertoire, error)
	GetAllPublic() ([]models.Repertoire, error)
	GetPublicByID(id string) (*models.Repertoire, error)
	GetOwnerID(id string) (string, error)
}

// RepertoireService handles repertoire business logic
type RepertoireService struct {
	repo  RepertoireRepository
	queue ReanalysisNotifier
}

// NewRepertoireService creates a new repertoire service with the given repository
func NewRepertoireService(repo RepertoireRepository) *RepertoireService {
	return &RepertoireService{repo: repo}
}

// WithReanalysisQueue wires a queue that gets notified after each successful tree
// mutation. Passing nil disables auto-re-analysis (default).
func (s *RepertoireService) WithReanalysisQueue(q ReanalysisNotifier) *RepertoireService {
	s.queue = q
	return s
}

// ReanalysisQueue returns the currently attached re-analysis notifier, or nil if
// auto-re-analysis is disabled. Exposed so wiring can be asserted in tests,
// guarding against a silent mis-wire that would disable auto-re-analysis.
func (s *RepertoireService) ReanalysisQueue() ReanalysisNotifier {
	return s.queue
}

// notifyReanalysis is a no-op when no queue is attached, so unit tests that
// construct RepertoireService directly remain unaffected.
func (s *RepertoireService) notifyReanalysis(userID string) {
	if s.queue != nil {
		s.queue.Notify(userID)
	}
}

// mapSaveError translates repository-layer save errors into service-layer
// sentinels so handlers can branch without importing the repository package.
// An optimistic-lock failure becomes ErrConflict (HTTP 409); a vanished
// repertoire becomes ErrNotFound; everything else passes through unchanged.
func mapSaveError(err error) error {
	switch {
	case err == nil:
		return nil
	case errors.Is(err, repository.ErrRepertoireConflict):
		return fmt.Errorf("%w: %w", ErrConflict, err)
	case errors.Is(err, repository.ErrRepertoireNotFound):
		return fmt.Errorf("%w: %w", ErrNotFound, err)
	default:
		return err
	}
}

// CreateRepertoire creates a new repertoire with the given name and color for a user
func (s *RepertoireService) CreateRepertoire(userID string, name string, color models.Color) (*models.Repertoire, error) {
	return s.CreateRepertoireWithVisibility(userID, name, "", color, false)
}

// CreateRepertoireWithVisibility creates a new repertoire with explicit public/private visibility
func (s *RepertoireService) CreateRepertoireWithVisibility(userID string, name string, description string, color models.Color, isPublic bool) (*models.Repertoire, error) {
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

	description = strings.TrimSpace(description)
	if len(description) > config.MaxRepertoireDescriptionLen {
		return nil, ErrDescriptionTooLong
	}

	// Check repertoire limit
	count, err := s.repo.Count(userID)
	if err != nil {
		return nil, fmt.Errorf("failed to check repertoire count: %w", err)
	}
	if count >= config.MaxRepertoires {
		return nil, ErrLimitReached
	}

	return s.repo.CreateWithIsPublicAndDescription(userID, name, description, color, isPublic)
}

// CreateRepertoireWithCategory creates a new repertoire with the given name, color, and optional category
func (s *RepertoireService) CreateRepertoireWithCategory(userID, name string, color models.Color, categoryID *string) (*models.Repertoire, error) {
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

	return s.repo.CreateWithCategory(userID, name, color, categoryID)
}

// AssignToCategory assigns a repertoire to a category (or removes from category if categoryID is nil)
func (s *RepertoireService) AssignToCategory(userID, repertoireID string, categoryID *string) (*models.Repertoire, error) {
	// Check if repertoire exists
	exists, err := s.repo.Exists(repertoireID)
	if err != nil {
		return nil, fmt.Errorf("failed to check repertoire existence: %w", err)
	}
	if !exists {
		return nil, fmt.Errorf("%w: %s", ErrNotFound, repertoireID)
	}

	return s.repo.UpdateCategory(repertoireID, userID, categoryID)
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

// UpdateDescription updates the description of a repertoire
func (s *RepertoireService) UpdateDescription(userID, id string, description string) (*models.Repertoire, error) {
	description = strings.TrimSpace(description)
	if len(description) > config.MaxRepertoireDescriptionLen {
		return nil, ErrDescriptionTooLong
	}

	// Check if repertoire exists
	exists, err := s.repo.Exists(id)
	if err != nil {
		return nil, fmt.Errorf("failed to check repertoire existence: %w", err)
	}
	if !exists {
		return nil, fmt.Errorf("%w: %s", ErrNotFound, id)
	}

	return s.repo.UpdateDescription(id, userID, description)
}

// RenameRepertoire updates the name of a repertoire
func (s *RepertoireService) RenameRepertoire(userID, id string, name string) (*models.Repertoire, error) {
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

	return s.repo.UpdateName(id, userID, name)
}

// DeleteRepertoire deletes a repertoire by ID
func (s *RepertoireService) DeleteRepertoire(userID, id string) error {
	err := s.repo.Delete(id, userID)
	if err != nil {
		if errors.Is(err, repository.ErrRepertoireNotFound) {
			return fmt.Errorf("%w: %s", ErrNotFound, id)
		}
		return err
	}
	s.notifyReanalysis(userID)
	return nil
}

// AddNode adds a new node to a repertoire
func (s *RepertoireService) AddNode(userID, repertoireID string, req models.AddNodeRequest) (*models.Repertoire, error) {
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

	// Derive MoveNumber server-side from the parent rather than trusting the
	// client-supplied value: a wrong client value would silently corrupt the
	// transposition key (which combines normalized FEN + MoveNumber).
	moveNumber := deriveMoveNumber(parentNode)

	newNode := &models.RepertoireNode{
		ID:          uuid.New().String(),
		FEN:         resultingFEN,
		Move:        &req.Move,
		MoveNumber:  moveNumber,
		ColorToMove: colorToMove,
		ParentID:    &req.ParentID,
		Children:    []*models.RepertoireNode{},
	}

	parentNode.Children = append(parentNode.Children, newNode)

	newMetadata := calculateMetadata(rep.TreeData)

	saved, err := s.repo.Save(repertoireID, userID, rep.TreeData, newMetadata, rep.Version)
	if err != nil {
		return nil, mapSaveError(err)
	}
	s.notifyReanalysis(userID)
	return saved, nil
}

// SaveTree saves a complete tree to a repertoire, replacing the existing tree data
func (s *RepertoireService) SaveTree(userID, repertoireID string, treeData models.RepertoireNode) (*models.Repertoire, error) {
	rep, err := s.repo.GetByID(repertoireID)
	if err != nil {
		if errors.Is(err, repository.ErrRepertoireNotFound) {
			return nil, fmt.Errorf("%w: %w", ErrNotFound, err)
		}
		return nil, err
	}

	metadata := calculateMetadata(treeData)
	saved, err := s.repo.Save(repertoireID, userID, treeData, metadata, rep.Version)
	if err != nil {
		return nil, mapSaveError(err)
	}
	s.notifyReanalysis(userID)
	return saved, nil
}

// DeleteNode removes a node and its children from a repertoire
func (s *RepertoireService) DeleteNode(userID, repertoireID string, nodeID string) (*models.Repertoire, error) {
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

	saved, err := s.repo.Save(repertoireID, userID, *newTreeData, newMetadata, rep.Version)
	if err != nil {
		return nil, mapSaveError(err)
	}
	s.notifyReanalysis(userID)
	return saved, nil
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
		saved, err := s.repo.Save(rep.ID, userID, tree, metadata, rep.Version)
		if err != nil {
			return nil, fmt.Errorf("failed to save template tree %s: %w", tmplID, err)
		}

		created = append(created, *saved)
	}

	if len(created) > 0 {
		s.notifyReanalysis(userID)
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

// deriveMoveNumber computes the full-move number of a move played from parent.
// MoveNumber is the chess full-move counter of the move stored on the node, so:
//   - playing a white move (parent has White to move) starts a new full move:
//     parent.MoveNumber + 1
//   - playing a black move (parent has Black to move) completes the current
//     full move: parent.MoveNumber
//
// The parent's side to move is read from its FEN (always server-validated)
// rather than the ColorToMove field, which may be unset on legacy nodes.
func deriveMoveNumber(parent *models.RepertoireNode) int {
	if parent == nil {
		return 1
	}
	if getColorToMoveFromFEN(parent.FEN) == models.ChessColorWhite {
		return parent.MoveNumber + 1
	}
	return parent.MoveNumber
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

// ExtractSubtree extracts a subtree from a repertoire into a new repertoire.
// The new repertoire contains the "spine" (root to target node) plus the full subtree.
// The subtree is removed from the original.
func (s *RepertoireService) ExtractSubtree(userID, repertoireID, nodeID, name string) (*models.ExtractSubtreeResponse, error) {
	// Fetch repertoire
	rep, err := s.repo.GetByID(repertoireID)
	if err != nil {
		if errors.Is(err, repository.ErrRepertoireNotFound) {
			return nil, fmt.Errorf("%w: %w", ErrNotFound, err)
		}
		return nil, err
	}

	// Cannot extract root
	if rep.TreeData.ID == nodeID {
		return nil, ErrCannotExtractRoot
	}

	// Find path from root to target
	path := findPathToNode(&rep.TreeData, nodeID)
	if path == nil {
		return nil, fmt.Errorf("%w: %s", ErrNodeNotFound, nodeID)
	}

	// Target is the last node in the path
	target := path[len(path)-1]

	// Auto-generate name if empty
	name = strings.TrimSpace(name)
	if name == "" {
		moveName := ""
		if target.Move != nil {
			moveName = *target.Move
		}
		name = fmt.Sprintf("%s - %s", rep.Name, moveName)
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

	// Build new tree: spine + subtree
	newTree := buildSpineWithSubtree(path)

	// Create new repertoire
	newRep, err := s.repo.Create(userID, name, rep.Color)
	if err != nil {
		return nil, fmt.Errorf("failed to create extracted repertoire: %w", err)
	}

	newMetadata := calculateMetadata(newTree)
	savedNew, err := s.repo.Save(newRep.ID, userID, newTree, newMetadata, newRep.Version)
	if err != nil {
		return nil, fmt.Errorf("failed to save extracted repertoire: %w", err)
	}

	// Prune original: remove the target node and its subtree
	prunedTree := deleteNodeRecursive(rep.TreeData, nodeID)
	if prunedTree == nil {
		return nil, fmt.Errorf("%w: %s", ErrNodeNotFound, nodeID)
	}

	prunedMetadata := calculateMetadata(*prunedTree)
	savedOriginal, err := s.repo.Save(repertoireID, userID, *prunedTree, prunedMetadata, rep.Version)
	if err != nil {
		return nil, fmt.Errorf("failed to save pruned repertoire: %w", err)
	}

	s.notifyReanalysis(userID)

	return &models.ExtractSubtreeResponse{
		Original:  savedOriginal,
		Extracted: savedNew,
	}, nil
}

// deepCloneSubtree creates a deep copy of a node and all its descendants with fresh UUIDs.
func deepCloneSubtree(node *models.RepertoireNode, parentID *string) *models.RepertoireNode {
	newID := uuid.New().String()
	cloned := &models.RepertoireNode{
		ID:              newID,
		FEN:             node.FEN,
		Move:            node.Move,
		MoveNumber:      node.MoveNumber,
		ColorToMove:     node.ColorToMove,
		ParentID:        parentID,
		Comment:         node.Comment,
		Arrows:          node.Arrows,
		Highlights:      node.Highlights,
		BranchName:      node.BranchName,
		BranchColor:     node.BranchColor,
		Collapsed:       node.Collapsed,
		IsMainLine:      node.IsMainLine,
		TranspositionOf: node.TranspositionOf,
		Children:        make([]*models.RepertoireNode, 0, len(node.Children)),
	}
	for _, child := range node.Children {
		cloned.Children = append(cloned.Children, deepCloneSubtree(child, &newID))
	}
	return cloned
}

// buildSpineWithSubtree constructs a new tree from the path (spine) with the subtree
// of the last node in the path attached. Each spine node gets a fresh UUID.
// The spine nodes are linear (single child each), and the last spine node gets
// the deep-cloned children of the target.
func buildSpineWithSubtree(path []*models.RepertoireNode) models.RepertoireNode {
	// Clone spine nodes with fresh IDs
	spineNodes := make([]models.RepertoireNode, len(path))
	for i, node := range path {
		newID := uuid.New().String()
		var parentID *string
		if i > 0 {
			pid := spineNodes[i-1].ID
			parentID = &pid
		}
		spineNodes[i] = models.RepertoireNode{
			ID:          newID,
			FEN:         node.FEN,
			Move:        node.Move,
			MoveNumber:  node.MoveNumber,
			ColorToMove: node.ColorToMove,
			ParentID:    parentID,
			Comment:     node.Comment,
			Arrows:      node.Arrows,
			Highlights:  node.Highlights,
			Children:    []*models.RepertoireNode{},
		}
	}

	// Link spine: each node's child is the next node
	for i := 0; i < len(spineNodes)-1; i++ {
		spineNodes[i].Children = []*models.RepertoireNode{&spineNodes[i+1]}
	}

	// Attach deep-cloned children of the target node to the last spine node
	lastIdx := len(spineNodes) - 1
	target := path[lastIdx]
	lastID := spineNodes[lastIdx].ID
	for _, child := range target.Children {
		spineNodes[lastIdx].Children = append(spineNodes[lastIdx].Children, deepCloneSubtree(child, &lastID))
	}

	return spineNodes[0]
}

// MergeRepertoires creates a new repertoire by merging multiple source repertoires.
// All sources must have the same color. All source repertoires are deleted after merging.
func (s *RepertoireService) MergeRepertoires(userID string, ids []string, name string) (*models.MergeRepertoiresResponse, error) {
	if len(ids) < 2 {
		return nil, ErrMergeMinimumTwo
	}

	name = strings.TrimSpace(name)
	if name == "" {
		return nil, ErrNameRequired
	}
	if len(name) > config.MaxRepertoireNameLen {
		return nil, ErrNameTooLong
	}

	// Check for duplicate IDs
	seen := make(map[string]bool, len(ids))
	for _, id := range ids {
		if seen[id] {
			return nil, ErrMergeDuplicateIDs
		}
		seen[id] = true
	}

	// Fetch all repertoires
	repertoires := make([]*models.Repertoire, 0, len(ids))
	for _, id := range ids {
		rep, err := s.repo.GetByID(id)
		if err != nil {
			if errors.Is(err, repository.ErrRepertoireNotFound) {
				return nil, fmt.Errorf("%w: %s", ErrNotFound, id)
			}
			return nil, err
		}
		repertoires = append(repertoires, rep)
	}

	// Verify all have the same color
	color := repertoires[0].Color
	for _, rep := range repertoires[1:] {
		if rep.Color != color {
			return nil, ErrMergeColorMismatch
		}
	}

	// Create new repertoire
	newRep, err := s.repo.Create(userID, name, color)
	if err != nil {
		return nil, fmt.Errorf("failed to create merged repertoire: %w", err)
	}

	// Pairwise merge each source tree into the new repertoire's tree
	for _, rep := range repertoires {
		mergeNodes(&newRep.TreeData, &rep.TreeData)
	}

	// Calculate metadata and save
	metadata := calculateMetadata(newRep.TreeData)
	saved, err := s.repo.Save(newRep.ID, userID, newRep.TreeData, metadata, newRep.Version)
	if err != nil {
		return nil, fmt.Errorf("failed to save merged repertoire: %w", err)
	}

	// Delete all source repertoires
	for _, id := range ids {
		if err := s.repo.Delete(id, userID); err != nil {
			return nil, fmt.Errorf("failed to delete source repertoire %s: %w", id, err)
		}
	}

	s.notifyReanalysis(userID)

	return &models.MergeRepertoiresResponse{Merged: saved}, nil
}

// MergeTranspositions detects positions reached via different move orders
// at the same move number and merges them. The first node encountered (BFS order)
// becomes the canonical node; duplicates become transposition pointers.
func (s *RepertoireService) MergeTranspositions(userID, repertoireID string) (*models.Repertoire, error) {
	rep, err := s.repo.GetByID(repertoireID)
	if err != nil {
		if errors.Is(err, repository.ErrRepertoireNotFound) {
			return nil, fmt.Errorf("%w: %w", ErrNotFound, err)
		}
		return nil, err
	}

	mergeTranspositionsInTree(&rep.TreeData)

	metadata := calculateMetadata(rep.TreeData)
	saved, err := s.repo.Save(repertoireID, userID, rep.TreeData, metadata, rep.Version)
	if err != nil {
		return nil, mapSaveError(err)
	}
	s.notifyReanalysis(userID)
	return saved, nil
}

// positionKey identifies a unique position at a specific move number.
type positionKey struct {
	normalizedFEN string
	moveNumber    int
}

// mergeTranspositionsInTree performs BFS level-by-level, grouping nodes by
// (normalizedFEN, moveNumber). For groups with >1 node, the first is canonical
// and the others become transposition pointers.
func mergeTranspositionsInTree(root *models.RepertoireNode) {
	// BFS queue — we process all nodes at the current depth before moving on.
	queue := []*models.RepertoireNode{root}

	for len(queue) > 0 {
		// Collect all children of the current level.
		var nextLevel []*models.RepertoireNode
		for _, node := range queue {
			// Skip transposition nodes — they have no meaningful children.
			if node.TranspositionOf != nil {
				continue
			}
			nextLevel = append(nextLevel, node.Children...)
		}

		if len(nextLevel) == 0 {
			break
		}

		// Group children by position key.
		type group struct {
			canonical *models.RepertoireNode
			others    []*models.RepertoireNode
		}
		groups := make(map[positionKey]*group)
		// Preserve insertion order for deterministic results.
		var keys []positionKey

		for _, child := range nextLevel {
			// Already a transposition node — skip.
			if child.TranspositionOf != nil {
				continue
			}
			key := positionKey{
				normalizedFEN: NormalizeFEN(child.FEN),
				moveNumber:    child.MoveNumber,
			}
			g, exists := groups[key]
			if !exists {
				g = &group{canonical: child}
				groups[key] = g
				keys = append(keys, key)
			} else {
				g.others = append(g.others, child)
			}
		}

		// Merge duplicates into the canonical node.
		for _, key := range keys {
			g := groups[key]
			if len(g.others) == 0 {
				continue
			}
			canonical := g.canonical
			for _, dup := range g.others {
				// Merge children of dup into canonical (same logic as mergeNodes).
				mergeNodes(canonical, dup)
				// Turn dup into a transposition pointer.
				dup.TranspositionOf = &canonical.ID
				dup.Children = []*models.RepertoireNode{}
				// Preserve comment: fill in if canonical has none.
				if canonical.Comment == nil && dup.Comment != nil {
					canonical.Comment = dup.Comment
				}
				if len(canonical.Arrows) == 0 && len(dup.Arrows) > 0 {
					canonical.Arrows = dup.Arrows
				}
				if len(canonical.Highlights) == 0 && len(dup.Highlights) > 0 {
					canonical.Highlights = dup.Highlights
				}
			}
		}

		// Next BFS level: all children of canonical nodes at the current level.
		queue = nextLevel
	}
}

// mergeNodes recursively merges source children into the target node.
// Matching moves are unified (recurse); non-matching ones are deep-cloned and appended.
func mergeNodes(target, source *models.RepertoireNode) {
	for _, srcChild := range source.Children {
		var matched *models.RepertoireNode
		if srcChild.Move != nil {
			for _, tgtChild := range target.Children {
				if tgtChild.Move != nil && *tgtChild.Move == *srcChild.Move {
					matched = tgtChild
					break
				}
			}
		}
		if matched != nil {
			// Preserve comment: keep target's comment, but fill in from source if target has none
			if matched.Comment == nil && srcChild.Comment != nil {
				matched.Comment = srcChild.Comment
			}
			if len(matched.Arrows) == 0 && len(srcChild.Arrows) > 0 {
				matched.Arrows = srcChild.Arrows
			}
			if len(matched.Highlights) == 0 && len(srcChild.Highlights) > 0 {
				matched.Highlights = srcChild.Highlights
			}
			mergeNodes(matched, srcChild)
		} else {
			target.Children = append(target.Children, deepCloneSubtree(srcChild, &target.ID))
		}
	}
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

// UpdateNodeComment updates the comment on a specific node in a repertoire
func (s *RepertoireService) UpdateNodeComment(userID, repertoireID, nodeID, comment string) (*models.Repertoire, error) {
	rep, err := s.repo.GetByID(repertoireID)
	if err != nil {
		if errors.Is(err, repository.ErrRepertoireNotFound) {
			return nil, fmt.Errorf("%w: %w", ErrNotFound, err)
		}
		return nil, err
	}

	node := findNode(&rep.TreeData, nodeID)
	if node == nil {
		return nil, fmt.Errorf("%w: %s", ErrNodeNotFound, nodeID)
	}

	comment = strings.TrimSpace(comment)
	if comment == "" {
		node.Comment = nil
	} else {
		node.Comment = &comment
	}

	metadata := calculateMetadata(rep.TreeData)
	saved, err := s.repo.Save(repertoireID, userID, rep.TreeData, metadata, rep.Version)
	return saved, mapSaveError(err)
}

// UpdateNodeBranchName updates the branch name on a specific node in a repertoire
func (s *RepertoireService) UpdateNodeBranchName(userID, repertoireID, nodeID, branchName string) (*models.Repertoire, error) {
	rep, err := s.repo.GetByID(repertoireID)
	if err != nil {
		if errors.Is(err, repository.ErrRepertoireNotFound) {
			return nil, fmt.Errorf("%w: %w", ErrNotFound, err)
		}
		return nil, err
	}

	node := findNode(&rep.TreeData, nodeID)
	if node == nil {
		return nil, fmt.Errorf("%w: %s", ErrNodeNotFound, nodeID)
	}

	branchName = strings.TrimSpace(branchName)
	if branchName == "" {
		node.BranchName = nil
	} else {
		node.BranchName = &branchName
	}

	metadata := calculateMetadata(rep.TreeData)
	saved, err := s.repo.Save(repertoireID, userID, rep.TreeData, metadata, rep.Version)
	return saved, mapSaveError(err)
}

// allowedBranchColors is the whitelist of valid branch color hex values
var allowedBranchColors = map[string]bool{
	"#E74C3C": true,
	"#E67E22": true,
	"#F1C40F": true,
	"#27AE60": true,
	"#1ABC9C": true,
	"#3498DB": true,
	"#9B59B6": true,
	"#E91E8F": true,
}

// ErrInvalidBranchColor is returned when an invalid branch color is provided
var ErrInvalidBranchColor = fmt.Errorf("invalid branch color")

// UpdateNodeBranchColor updates the branch color on a specific node in a repertoire
func (s *RepertoireService) UpdateNodeBranchColor(userID, repertoireID, nodeID, branchColor string) (*models.Repertoire, error) {
	branchColor = strings.TrimSpace(branchColor)

	// Validate color if not clearing
	if branchColor != "" && !allowedBranchColors[branchColor] {
		return nil, ErrInvalidBranchColor
	}

	rep, err := s.repo.GetByID(repertoireID)
	if err != nil {
		if errors.Is(err, repository.ErrRepertoireNotFound) {
			return nil, fmt.Errorf("%w: %w", ErrNotFound, err)
		}
		return nil, err
	}

	node := findNode(&rep.TreeData, nodeID)
	if node == nil {
		return nil, fmt.Errorf("%w: %s", ErrNodeNotFound, nodeID)
	}

	if branchColor == "" {
		node.BranchColor = nil
	} else {
		node.BranchColor = &branchColor
	}

	metadata := calculateMetadata(rep.TreeData)
	saved, err := s.repo.Save(repertoireID, userID, rep.TreeData, metadata, rep.Version)
	return saved, mapSaveError(err)
}

// allowedAnnotationColors is the whitelist of valid annotation hex colors,
// matching the Lichess palette produced by the PGN annotation parser.
var allowedAnnotationColors = map[string]bool{
	"#15781B": true, // green
	"#882020": true, // red
	"#003088": true, // blue
	"#e68f00": true, // yellow
}

// annotationSquareRegex matches a valid algebraic board square (a1-h8).
var annotationSquareRegex = regexp.MustCompile(`^[a-h][1-8]$`)

// ErrInvalidAnnotation is returned when an arrow/highlight has an invalid square or color.
var ErrInvalidAnnotation = fmt.Errorf("invalid annotation")

// UpdateNodeAnnotations replaces the arrows and highlights on a specific node.
// Both slices are validated (squares must be a1-h8, colors must be in the allowed
// palette) and stored verbatim; empty slices clear the corresponding annotations.
func (s *RepertoireService) UpdateNodeAnnotations(userID, repertoireID, nodeID string, arrows []models.Arrow, highlights []models.SquareHighlight) (*models.Repertoire, error) {
	for _, a := range arrows {
		if !annotationSquareRegex.MatchString(a.From) || !annotationSquareRegex.MatchString(a.To) || !allowedAnnotationColors[a.Color] {
			return nil, fmt.Errorf("%w: arrow %s%s %s", ErrInvalidAnnotation, a.From, a.To, a.Color)
		}
	}
	for _, h := range highlights {
		if !annotationSquareRegex.MatchString(h.Square) || !allowedAnnotationColors[h.Color] {
			return nil, fmt.Errorf("%w: highlight %s %s", ErrInvalidAnnotation, h.Square, h.Color)
		}
	}

	rep, err := s.repo.GetByID(repertoireID)
	if err != nil {
		if errors.Is(err, repository.ErrRepertoireNotFound) {
			return nil, fmt.Errorf("%w: %w", ErrNotFound, err)
		}
		return nil, err
	}

	node := findNode(&rep.TreeData, nodeID)
	if node == nil {
		return nil, fmt.Errorf("%w: %s", ErrNodeNotFound, nodeID)
	}

	if len(arrows) == 0 {
		node.Arrows = nil
	} else {
		node.Arrows = arrows
	}
	if len(highlights) == 0 {
		node.Highlights = nil
	} else {
		node.Highlights = highlights
	}

	metadata := calculateMetadata(rep.TreeData)
	saved, err := s.repo.Save(repertoireID, userID, rep.TreeData, metadata, rep.Version)
	return saved, mapSaveError(err)
}

// ToggleNodeCollapsed toggles the collapsed state on a specific node in a repertoire
func (s *RepertoireService) ToggleNodeCollapsed(userID, repertoireID, nodeID string) (*models.Repertoire, error) {
	rep, err := s.repo.GetByID(repertoireID)
	if err != nil {
		if errors.Is(err, repository.ErrRepertoireNotFound) {
			return nil, fmt.Errorf("%w: %w", ErrNotFound, err)
		}
		return nil, err
	}

	node := findNode(&rep.TreeData, nodeID)
	if node == nil {
		return nil, fmt.Errorf("%w: %s", ErrNodeNotFound, nodeID)
	}

	node.Collapsed = !node.Collapsed

	metadata := calculateMetadata(rep.TreeData)
	saved, err := s.repo.Save(repertoireID, userID, rep.TreeData, metadata, rep.Version)
	return saved, mapSaveError(err)
}

// ExpandToNode expands all collapsed ancestors of a node so it becomes visible in the tree.
func (s *RepertoireService) ExpandToNode(userID, repertoireID, nodeID string) (*models.Repertoire, error) {
	rep, err := s.repo.GetByID(repertoireID)
	if err != nil {
		if errors.Is(err, repository.ErrRepertoireNotFound) {
			return nil, fmt.Errorf("%w: %w", ErrNotFound, err)
		}
		return nil, err
	}

	path := findPathToNode(&rep.TreeData, nodeID)
	if path == nil {
		return nil, fmt.Errorf("%w: %s", ErrNodeNotFound, nodeID)
	}

	// Uncollapse all ancestors (skip the target node itself)
	changed := false
	for _, node := range path[:len(path)-1] {
		if node.Collapsed {
			node.Collapsed = false
			changed = true
		}
	}

	if !changed {
		return rep, nil
	}

	metadata := calculateMetadata(rep.TreeData)
	saved, err := s.repo.Save(repertoireID, userID, rep.TreeData, metadata, rep.Version)
	return saved, mapSaveError(err)
}

// SetMainLine marks the path from root to the target node as the main line.
func (s *RepertoireService) SetMainLine(userID, repertoireID, nodeID string) (*models.Repertoire, error) {
	rep, err := s.repo.GetByID(repertoireID)
	if err != nil {
		if errors.Is(err, repository.ErrRepertoireNotFound) {
			return nil, fmt.Errorf("%w: %w", ErrNotFound, err)
		}
		return nil, err
	}

	// Find path from root to target node
	path := findPathToNode(&rep.TreeData, nodeID)
	if path == nil {
		return nil, fmt.Errorf("%w: %s", ErrNodeNotFound, nodeID)
	}

	// Build set of node IDs in the path for fast lookup
	pathIDs := make(map[string]bool, len(path))
	for _, n := range path {
		pathIDs[n.ID] = true
	}

	// Walk entire tree: set IsMainLine based on path membership
	clearAndSetMainLine(&rep.TreeData, pathIDs)

	metadata := calculateMetadata(rep.TreeData)
	saved, err := s.repo.Save(repertoireID, userID, rep.TreeData, metadata, rep.Version)
	return saved, mapSaveError(err)
}

// ClearMainLine removes the main line flag from all nodes in a repertoire.
func (s *RepertoireService) ClearMainLine(userID, repertoireID string) (*models.Repertoire, error) {
	rep, err := s.repo.GetByID(repertoireID)
	if err != nil {
		if errors.Is(err, repository.ErrRepertoireNotFound) {
			return nil, fmt.Errorf("%w: %w", ErrNotFound, err)
		}
		return nil, err
	}

	clearAndSetMainLine(&rep.TreeData, nil)

	metadata := calculateMetadata(rep.TreeData)
	saved, err := s.repo.Save(repertoireID, userID, rep.TreeData, metadata, rep.Version)
	return saved, mapSaveError(err)
}

// clearAndSetMainLine walks the entire tree, setting IsMainLine = true for nodes
// whose ID is in pathIDs, and false for all others. If pathIDs is nil, clears all.
func clearAndSetMainLine(node *models.RepertoireNode, pathIDs map[string]bool) {
	node.IsMainLine = pathIDs != nil && pathIDs[node.ID]
	for _, child := range node.Children {
		clearAndSetMainLine(child, pathIDs)
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

// UpdateVisibility changes the public/private visibility of a repertoire
func (s *RepertoireService) UpdateVisibility(userID, repertoireID string, isPublic bool) (*models.Repertoire, error) {
	belongs, err := s.repo.BelongsToUser(repertoireID, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to check ownership: %w", err)
	}
	if !belongs {
		return nil, ErrNotFound
	}

	return s.repo.UpdateVisibility(repertoireID, userID, isPublic)
}

// ListPublicRepertoires returns all public repertoires with author info
func (s *RepertoireService) ListPublicRepertoires() ([]models.Repertoire, error) {
	return s.repo.GetAllPublic()
}

// GetPublicRepertoire retrieves a single public repertoire by ID
func (s *RepertoireService) GetPublicRepertoire(id string) (*models.Repertoire, error) {
	rep, err := s.repo.GetPublicByID(id)
	if err != nil {
		if errors.Is(err, repository.ErrRepertoireNotFound) {
			return nil, fmt.Errorf("%w: %w", ErrNotFound, err)
		}
		return nil, err
	}
	return rep, nil
}

// ImportRepertoire creates a deep clone of a public repertoire for the given user
func (s *RepertoireService) ImportRepertoire(userID, sourceRepertoireID string) (*models.Repertoire, error) {
	// Verify the source repertoire is public
	source, err := s.repo.GetPublicByID(sourceRepertoireID)
	if err != nil {
		if errors.Is(err, repository.ErrRepertoireNotFound) {
			return nil, fmt.Errorf("%w: %w", ErrNotFound, err)
		}
		return nil, err
	}

	// Check the user isn't importing their own repertoire
	ownerID, err := s.repo.GetOwnerID(sourceRepertoireID)
	if err != nil {
		return nil, fmt.Errorf("failed to get owner: %w", err)
	}
	if ownerID == userID {
		return nil, fmt.Errorf("cannot import your own repertoire")
	}

	// Check repertoire limit
	count, err := s.repo.Count(userID)
	if err != nil {
		return nil, fmt.Errorf("failed to check repertoire count: %w", err)
	}
	if count >= config.MaxRepertoires {
		return nil, ErrLimitReached
	}

	// Create a new repertoire for the user (private by default when importing)
	newRep, err := s.repo.CreateWithIsPublicAndDescription(userID, source.Name, source.Description, source.Color, false)
	if err != nil {
		return nil, fmt.Errorf("failed to create imported repertoire: %w", err)
	}

	// Deep clone the source tree
	clonedTree := deepCloneSubtree(&source.TreeData, nil)

	// Save the cloned tree
	metadata := calculateMetadata(*clonedTree)
	saved, err := s.repo.Save(newRep.ID, userID, *clonedTree, metadata, newRep.Version)
	if err != nil {
		return nil, fmt.Errorf("failed to save imported repertoire: %w", err)
	}

	// Carry over origin from the source repertoire
	if source.Origin != nil {
		if err := s.repo.UpdateOrigin(saved.ID, source.Origin); err != nil {
			return nil, fmt.Errorf("failed to set origin on imported repertoire: %w", err)
		}
		saved.Origin = source.Origin
	}

	s.notifyReanalysis(userID)

	return saved, nil
}

// SetOrigin sets the origin on a repertoire
func (s *RepertoireService) SetOrigin(repertoireID string, origin *models.RepertoireOrigin) error {
	return s.repo.UpdateOrigin(repertoireID, origin)
}
