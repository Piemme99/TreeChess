package services

import (
	"fmt"

	"github.com/google/uuid"

	"github.com/treechess/backend/internal/models"
	"github.com/treechess/backend/internal/repository"
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
		return nil, fmt.Errorf("invalid color: %s", color)
	}

	exists, err := repository.RepertoireExists(color)
	if err != nil {
		return nil, fmt.Errorf("failed to check repertoire existence: %w", err)
	}
	if exists {
		return nil, fmt.Errorf("repertoire for %s already exists", color)
	}

	return repository.CreateRepertoire(color)
}

func (s *RepertoireService) GetRepertoire(color models.Color) (*models.Repertoire, error) {
	if color != models.ColorWhite && color != models.ColorBlack {
		return nil, fmt.Errorf("invalid color: %s", color)
	}

	rep, err := repository.GetRepertoireByColor(color)
	if err != nil {
		return nil, fmt.Errorf("repertoire not found: %w", err)
	}

	return rep, nil
}

func (s *RepertoireService) AddNode(req models.AddNodeRequest) (*models.Repertoire, error) {
	rep, err := repository.GetRepertoireByColor(req.ColorToMove)
	if err != nil {
		return nil, fmt.Errorf("repertoire not found: %w", err)
	}

	parentNode := findNode(&rep.TreeData, req.ParentID)
	if parentNode == nil {
		return nil, fmt.Errorf("parent node not found: %s", req.ParentID)
	}

	if !isValidMoveFromNode(parentNode, req.Move) {
		return nil, fmt.Errorf("invalid move: %s", req.Move)
	}

	newNode := &models.RepertoireNode{
		ID:          uuid.New().String(),
		FEN:         req.FEN,
		Move:        &req.Move,
		MoveNumber:  req.MoveNumber,
		ColorToMove: oppositeColor(req.ColorToMove),
		ParentID:    &req.ParentID,
		Children:    nil,
	}

	parentNode.Children = append(parentNode.Children, newNode)

	newMetadata := calculateMetadata(rep.TreeData)

	return repository.SaveRepertoire(req.ColorToMove, rep.TreeData, newMetadata)
}

func (s *RepertoireService) DeleteNode(color models.Color, nodeID string) (*models.Repertoire, error) {
	if color != models.ColorWhite && color != models.ColorBlack {
		return nil, fmt.Errorf("invalid color: %s", color)
	}

	rep, err := repository.GetRepertoireByColor(color)
	if err != nil {
		return nil, fmt.Errorf("repertoire not found: %w", err)
	}

	if rep.TreeData.ID == nodeID {
		return nil, fmt.Errorf("cannot delete root node")
	}

	newTreeData := deleteNodeRecursive(rep.TreeData, nodeID)
	if newTreeData == nil {
		return nil, fmt.Errorf("node not found: %s", nodeID)
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

func isValidMoveFromNode(parent *models.RepertoireNode, moveSAN string) bool {
	for _, child := range parent.Children {
		if child.Move != nil && *child.Move == moveSAN {
			return false
		}
	}
	return true
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

func oppositeColor(c models.Color) models.Color {
	if c == models.ColorWhite {
		return models.ColorBlack
	}
	return models.ColorWhite
}
