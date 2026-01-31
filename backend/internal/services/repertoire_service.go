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
	ErrCannotExtractRoot  = fmt.Errorf("cannot extract root node")
	ErrNodeNotFound       = fmt.Errorf("node not found")
	ErrLimitReached       = fmt.Errorf("maximum repertoire limit reached (50)")
	ErrNameRequired       = fmt.Errorf("name is required")
	ErrNameTooLong        = fmt.Errorf("name must be 100 characters or less")
	ErrMergeMinimumTwo    = fmt.Errorf("at least two repertoires are required to merge")
	ErrMergeColorMismatch = fmt.Errorf("cannot merge repertoires of different colors")
	ErrMergeDuplicateIDs  = fmt.Errorf("duplicate repertoire IDs")

	// Game analysis errors
	ErrColorMismatch = fmt.Errorf("repertoire color does not match user color in game")

	// Lichess errors
	ErrLichessUserNotFound = fmt.Errorf("Lichess user not found")
	ErrLichessRateLimited  = fmt.Errorf("Lichess API rate limited, try again later")

	// Chess.com errors
	ErrChesscomUserNotFound = fmt.Errorf("Chess.com user not found")
	ErrChesscomRateLimited  = fmt.Errorf("Chess.com API rate limited, try again later")

	// PGN parsing errors
	ErrCustomStartingPosition = fmt.Errorf("chapter uses a custom starting position and cannot be imported as a repertoire")

	// Lichess study errors
	ErrLichessStudyNotFound  = fmt.Errorf("Lichess study not found")
	ErrLichessStudyForbidden = fmt.Errorf("Lichess study is private, authentication required")
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
	savedNew, err := s.repo.Save(newRep.ID, newTree, newMetadata)
	if err != nil {
		return nil, fmt.Errorf("failed to save extracted repertoire: %w", err)
	}

	// Prune original: remove the target node and its subtree
	prunedTree := deleteNodeRecursive(rep.TreeData, nodeID)
	if prunedTree == nil {
		return nil, fmt.Errorf("%w: %s", ErrNodeNotFound, nodeID)
	}

	prunedMetadata := calculateMetadata(*prunedTree)
	savedOriginal, err := s.repo.Save(repertoireID, *prunedTree, prunedMetadata)
	if err != nil {
		return nil, fmt.Errorf("failed to save pruned repertoire: %w", err)
	}

	return &models.ExtractSubtreeResponse{
		Original:  savedOriginal,
		Extracted: savedNew,
	}, nil
}

// deepCloneSubtree creates a deep copy of a node and all its descendants with fresh UUIDs.
func deepCloneSubtree(node *models.RepertoireNode, parentID *string) *models.RepertoireNode {
	newID := uuid.New().String()
	cloned := &models.RepertoireNode{
		ID:          newID,
		FEN:         node.FEN,
		Move:        node.Move,
		MoveNumber:  node.MoveNumber,
		ColorToMove: node.ColorToMove,
		ParentID:    parentID,
		Comment:     node.Comment,
		Children:    make([]*models.RepertoireNode, 0, len(node.Children)),
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
	saved, err := s.repo.Save(newRep.ID, newRep.TreeData, metadata)
	if err != nil {
		return nil, fmt.Errorf("failed to save merged repertoire: %w", err)
	}

	// Delete all source repertoires
	for _, id := range ids {
		if err := s.repo.Delete(id); err != nil {
			return nil, fmt.Errorf("failed to delete source repertoire %s: %w", id, err)
		}
	}

	return &models.MergeRepertoiresResponse{Merged: saved}, nil
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
func (s *RepertoireService) UpdateNodeComment(repertoireID, nodeID, comment string) (*models.Repertoire, error) {
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
	return s.repo.Save(repertoireID, rep.TreeData, metadata)
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
