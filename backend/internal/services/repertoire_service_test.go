package services

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/treechess/backend/internal/models"
)

func TestRepertoireService_CreateRepertoire_InvalidColor(t *testing.T) {
	svc := NewRepertoireService()

	_, err := svc.CreateRepertoire(models.Color("invalid"))

	assert.Error(t, err)
	assert.Contains(t, err.Error(), "invalid color")
}

func TestRepertoireService_GetRepertoire_InvalidColor(t *testing.T) {
	svc := NewRepertoireService()

	_, err := svc.GetRepertoire(models.Color("invalid"))

	assert.Error(t, err)
	assert.Contains(t, err.Error(), "invalid color")
}

func TestFindNode_Found(t *testing.T) {
	move1 := "e4"
	move2 := "c5"
	move3 := "Nf3"

	root := &models.RepertoireNode{
		ID:         "root",
		MoveNumber: 0,
		Children: []*models.RepertoireNode{
			{
				ID:         "child1",
				Move:       &move1,
				MoveNumber: 1,
				Children: []*models.RepertoireNode{
					{
						ID:         "grandchild",
						Move:       &move3,
						MoveNumber: 3,
					},
				},
			},
			{
				ID:         "child2",
				Move:       &move2,
				MoveNumber: 2,
			},
		},
	}

	found := findNode(root, "grandchild")

	require.NotNil(t, found)
	assert.Equal(t, "grandchild", found.ID)
}

func TestFindNode_NotFound(t *testing.T) {
	root := &models.RepertoireNode{
		ID:         "root",
		MoveNumber: 0,
		Children:   nil,
	}

	found := findNode(root, "nonexistent")

	assert.Nil(t, found)
}

func TestIsValidMoveFromNode_Valid(t *testing.T) {
	parent := models.RepertoireNode{
		ID:       "parent",
		Children: []*models.RepertoireNode{},
	}

	result := isValidMoveFromNode(&parent, "Nf3")

	assert.True(t, result)
}

func TestIsValidMoveFromNode_DuplicateMove(t *testing.T) {
	existingMove := "e4"
	parent := models.RepertoireNode{
		ID: "parent",
		Children: []*models.RepertoireNode{
			{Move: &existingMove},
		},
	}

	result := isValidMoveFromNode(&parent, "e4")

	assert.False(t, result)
}

func TestDeleteNodeRecursive_Root(t *testing.T) {
	root := models.RepertoireNode{
		ID: "root",
	}

	result := deleteNodeRecursive(root, "root")

	assert.Nil(t, result, "Should return nil when deleting root")
}

func TestDeleteNodeRecursive_Child(t *testing.T) {
	move1 := "e4"
	move2 := "c5"

	root := models.RepertoireNode{
		ID: "root",
		Children: []*models.RepertoireNode{
			{ID: "child1", Move: &move1},
			{ID: "child2", Move: &move2},
		},
	}

	result := deleteNodeRecursive(root, "child1")

	require.NotNil(t, result)
	assert.Len(t, result.Children, 1)
	assert.Equal(t, "child2", result.Children[0].ID)
}

func TestDeleteNodeRecursive_Grandchild(t *testing.T) {
	move1 := "e4"
	move2 := "c5"
	move3 := "Nf3"

	root := models.RepertoireNode{
		ID: "root",
		Children: []*models.RepertoireNode{
			{
				ID:   "child1",
				Move: &move1,
				Children: []*models.RepertoireNode{
					{ID: "grandchild", Move: &move3, MoveNumber: 3},
				},
			},
			{ID: "child2", Move: &move2},
		},
	}

	result := deleteNodeRecursive(root, "grandchild")

	require.NotNil(t, result)
	assert.Len(t, result.Children[0].Children, 0)
}

func TestCalculateMetadata_SingleNode(t *testing.T) {
	root := models.RepertoireNode{
		ID:         "root",
		Move:       nil,
		MoveNumber: 0,
	}

	metadata := calculateMetadata(root)

	assert.Equal(t, 1, metadata.TotalNodes)
	assert.Equal(t, 0, metadata.TotalMoves)
	assert.Equal(t, 0, metadata.DeepestDepth)
}

func TestCalculateMetadata_WithChildren(t *testing.T) {
	move1 := "e4"
	move2 := "c5"
	move3 := "Nf3"

	root := models.RepertoireNode{
		ID:         "root",
		Move:       nil,
		MoveNumber: 0,
		Children: []*models.RepertoireNode{
			{
				ID:         "child1",
				Move:       &move1,
				MoveNumber: 1,
			},
			{
				ID:         "child2",
				Move:       &move2,
				MoveNumber: 2,
				Children: []*models.RepertoireNode{
					{ID: "grandchild", Move: &move3, MoveNumber: 3},
				},
			},
		},
	}

	metadata := calculateMetadata(root)

	assert.Equal(t, 4, metadata.TotalNodes)
	assert.Equal(t, 3, metadata.TotalMoves)
	assert.Equal(t, 2, metadata.DeepestDepth)
}

func TestOppositeColor(t *testing.T) {
	assert.Equal(t, models.ColorBlack, oppositeColor(models.ColorWhite))
	assert.Equal(t, models.ColorWhite, oppositeColor(models.ColorBlack))
}
