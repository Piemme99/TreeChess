package models

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestColorConstants(t *testing.T) {
	assert.Equal(t, Color("white"), ColorWhite)
	assert.Equal(t, Color("black"), ColorBlack)
}

func TestRepertoireNode_JSON(t *testing.T) {
	move := "e4"
	node := RepertoireNode{
		ID:          "test-id",
		FEN:         "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3",
		Move:        &move,
		MoveNumber:  1,
		ColorToMove: ColorBlack,
		ParentID:    nil,
		Children:    nil,
	}

	data, err := json.Marshal(node)
	require.NoError(t, err)

	var decoded RepertoireNode
	err = json.Unmarshal(data, &decoded)
	require.NoError(t, err)

	assert.Equal(t, node.ID, decoded.ID)
	assert.Equal(t, node.FEN, decoded.FEN)
	assert.Equal(t, *node.Move, *decoded.Move)
	assert.Equal(t, node.MoveNumber, decoded.MoveNumber)
	assert.Equal(t, node.ColorToMove, decoded.ColorToMove)
}

func TestRepertoire_JSON(t *testing.T) {
	root := RepertoireNode{
		ID:          "root-id",
		FEN:         "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -",
		Move:        nil,
		MoveNumber:  0,
		ColorToMove: ColorWhite,
		ParentID:    nil,
		Children:    nil,
	}

	rep := Repertoire{
		ID:        "rep-id",
		Color:     ColorWhite,
		TreeData:  root,
		Metadata:  Metadata{TotalNodes: 1, TotalMoves: 0, DeepestDepth: 0},
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	data, err := json.Marshal(rep)
	require.NoError(t, err)

	var decoded Repertoire
	err = json.Unmarshal(data, &decoded)
	require.NoError(t, err)

	assert.Equal(t, rep.ID, decoded.ID)
	assert.Equal(t, rep.Color, decoded.Color)
	assert.Equal(t, rep.Metadata.TotalNodes, decoded.Metadata.TotalNodes)
}

func TestAddNodeRequest_JSON(t *testing.T) {
	req := AddNodeRequest{
		ParentID:    "parent-id",
		Move:        "Nf3",
		FEN:         "test-fen",
		MoveNumber:  2,
		ColorToMove: ColorBlack,
	}

	data, err := json.Marshal(req)
	require.NoError(t, err)

	var decoded AddNodeRequest
	err = json.Unmarshal(data, &decoded)
	require.NoError(t, err)

	assert.Equal(t, req.ParentID, decoded.ParentID)
	assert.Equal(t, req.Move, decoded.Move)
	assert.Equal(t, req.FEN, decoded.FEN)
	assert.Equal(t, req.MoveNumber, decoded.MoveNumber)
	assert.Equal(t, req.ColorToMove, decoded.ColorToMove)
}

func TestMoveAnalysis_StatusValues(t *testing.T) {
	ma := MoveAnalysis{
		PlyNumber:  0,
		SAN:        "e4",
		FEN:        "starting-fen",
		Status:     "in-repertoire",
		IsUserMove: true,
	}

	assert.Contains(t, []string{"in-repertoire", "out-of-repertoire", "opponent-new"}, ma.Status)
}

func TestGameAnalysis_MultipleMoves(t *testing.T) {
	ga := GameAnalysis{
		GameIndex: 0,
		Headers: PGNHeaders{
			"Event": "Test",
			"White": "Player1",
			"Black": "Player2",
		},
		Moves: []MoveAnalysis{
			{PlyNumber: 0, SAN: "e4", Status: "in-repertoire", IsUserMove: true},
			{PlyNumber: 1, SAN: "c5", Status: "in-repertoire", IsUserMove: false},
		},
	}

	assert.Len(t, ga.Moves, 2)
	assert.Equal(t, "Player1", ga.Headers["White"])
}
