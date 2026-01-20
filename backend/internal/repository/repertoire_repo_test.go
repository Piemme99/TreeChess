package repository

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/treechess/backend/internal/models"
)

func TestRepertoireNode_JSONMarshaling(t *testing.T) {
	move := "e4"
	node := models.RepertoireNode{
		ID:          "test-id",
		FEN:         "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3",
		Move:        &move,
		MoveNumber:  1,
		ColorToMove: models.ColorBlack,
		ParentID:    nil,
		Children:    []*models.RepertoireNode{},
	}

	data, err := json.Marshal(node)
	require.NoError(t, err)

	var decoded models.RepertoireNode
	err = json.Unmarshal(data, &decoded)
	require.NoError(t, err)

	assert.Equal(t, node.ID, decoded.ID)
	assert.Equal(t, *node.Move, *decoded.Move)
	assert.Equal(t, node.MoveNumber, decoded.MoveNumber)
}

func TestMetadata_JSONMarshaling(t *testing.T) {
	metadata := models.Metadata{
		TotalNodes:   5,
		TotalMoves:   4,
		DeepestDepth: 3,
	}

	data, err := json.Marshal(metadata)
	require.NoError(t, err)

	var decoded models.Metadata
	err = json.Unmarshal(data, &decoded)
	require.NoError(t, err)

	assert.Equal(t, metadata.TotalNodes, decoded.TotalNodes)
	assert.Equal(t, metadata.TotalMoves, decoded.TotalMoves)
	assert.Equal(t, metadata.DeepestDepth, decoded.DeepestDepth)
}

func TestRepertoireNode_WithChildren(t *testing.T) {
	childMove := "e5"
	parentMove := "e4"

	parent := models.RepertoireNode{
		ID:          "parent-id",
		FEN:         "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3",
		Move:        &parentMove,
		MoveNumber:  1,
		ColorToMove: models.ColorBlack,
		ParentID:    nil,
		Children: []*models.RepertoireNode{
			{
				ID:          "child-id",
				FEN:         "rnbqkbnr/pppppppp/8/8/3P4/8/PPPP1PPP/RNBQKBNR b KQkq -",
				Move:        &childMove,
				MoveNumber:  2,
				ColorToMove: models.ColorWhite,
				ParentID:    strPtr("parent-id"),
				Children:    nil,
			},
		},
	}

	data, err := json.Marshal(parent)
	require.NoError(t, err)

	var decoded models.RepertoireNode
	err = json.Unmarshal(data, &decoded)
	require.NoError(t, err)

	assert.Len(t, decoded.Children, 1)
	assert.Equal(t, "child-id", decoded.Children[0].ID)
}

func TestRepertoireNode_NilMoveForRoot(t *testing.T) {
	root := models.RepertoireNode{
		ID:          "root-id",
		FEN:         "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -",
		Move:        nil,
		MoveNumber:  0,
		ColorToMove: models.ColorWhite,
		ParentID:    nil,
		Children:    nil,
	}

	data, err := json.Marshal(root)
	require.NoError(t, err)

	var decoded models.RepertoireNode
	err = json.Unmarshal(data, &decoded)
	require.NoError(t, err)

	assert.Nil(t, decoded.Move)
	assert.Equal(t, 0, decoded.MoveNumber)
}

func TestRepertoireNode_NilParentID(t *testing.T) {
	node := models.RepertoireNode{
		ID:       "test-id",
		ParentID: nil,
	}

	data, err := json.Marshal(node)
	require.NoError(t, err)

	var decoded models.RepertoireNode
	err = json.Unmarshal(data, &decoded)
	require.NoError(t, err)

	assert.Nil(t, decoded.ParentID)
}

func strPtr(s string) *string {
	return &s
}
