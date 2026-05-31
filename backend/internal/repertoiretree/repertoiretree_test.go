package repertoiretree

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/kumquat/backend/internal/models"
)

func strptr(s string) *string { return &s }

func sampleTree() *models.RepertoireNode {
	return &models.RepertoireNode{
		ID:  "root",
		FEN: "startfen w KQkq -",
		Children: []*models.RepertoireNode{
			{
				ID:   "n1",
				FEN:  "after-e4 b KQkq -",
				Move: strptr("e4"),
				Children: []*models.RepertoireNode{
					{ID: "n2", FEN: "after-e4-e5 w KQkq -", Move: strptr("e5")},
				},
			},
			{
				ID:   "n3",
				FEN:  "after-d4 b KQkq -",
				Move: strptr("d4"),
			},
		},
	}
}

func TestNormalizeFEN(t *testing.T) {
	assert.Equal(t, "board w KQkq -", NormalizeFEN("board w KQkq - 0 1"))
	assert.Equal(t, "board w KQkq -", NormalizeFEN("board w KQkq -"))
	assert.Equal(t, "short fen", NormalizeFEN("short fen"))
}

func TestFindByID(t *testing.T) {
	root := sampleTree()
	assert.Equal(t, "n2", FindByID(root, "n2").ID)
	assert.Equal(t, "root", FindByID(root, "root").ID)
	assert.Nil(t, FindByID(root, "missing"))
	assert.Nil(t, FindByID(nil, "n1"))
}

func TestFindByFEN(t *testing.T) {
	root := sampleTree()
	assert.Equal(t, "n1", FindByFEN(root, "after-e4 b KQkq -").ID)
	assert.Nil(t, FindByFEN(root, "nope"))
	assert.Nil(t, FindByFEN(nil, "x"))
}

func TestBuildFENIndexMatchesFindByFEN(t *testing.T) {
	root := sampleTree()
	index := BuildFENIndex(root)
	for _, fen := range []string{"startfen w KQkq -", "after-e4 b KQkq -", "after-e4-e5 w KQkq -", "after-d4 b KQkq -"} {
		recursive := FindByFEN(root, fen)
		require.NotNil(t, recursive, "FindByFEN should find %s", fen)
		assert.Same(t, recursive, index[fen], "index lookup must match FindByFEN for %s", fen)
	}
	assert.Nil(t, index["unknown fen"])
}

func TestBuildFENIndexTranspositionKeepsFirstPreOrderNode(t *testing.T) {
	shared := "shared-fen w KQkq -"
	root := &models.RepertoireNode{
		ID:  "root",
		FEN: "root-fen w KQkq -",
		Children: []*models.RepertoireNode{
			{ID: "first", FEN: shared, Move: strptr("a")},
			{ID: "second", FEN: shared, Move: strptr("b")},
		},
	}
	index := BuildFENIndex(root)
	assert.Same(t, FindByFEN(root, shared), index[shared])
	assert.Equal(t, "first", index[shared].ID)
}

func TestHasChildMove(t *testing.T) {
	root := sampleTree()
	n1 := FindByID(root, "n1")
	assert.True(t, HasChildMove(n1, "e5"))
	assert.False(t, HasChildMove(n1, "Nf3"))
	assert.False(t, HasChildMove(nil, "e5"))
}

func TestExpectedMovePrefersMainLine(t *testing.T) {
	node := &models.RepertoireNode{
		Children: []*models.RepertoireNode{
			{Move: strptr("a")},
			{Move: strptr("b"), IsMainLine: true},
		},
	}
	assert.Equal(t, "b", ExpectedMove(node))

	fallback := &models.RepertoireNode{
		Children: []*models.RepertoireNode{
			{Move: strptr("a")},
			{Move: strptr("b")},
		},
	}
	assert.Equal(t, "a", ExpectedMove(fallback))

	assert.Equal(t, "", ExpectedMove(nil))
	assert.Equal(t, "", ExpectedMove(&models.RepertoireNode{}))
}

func TestCollectMoves(t *testing.T) {
	root := sampleTree()
	moves := make(map[string]bool)
	CollectMoves(root, moves)
	assert.True(t, moves["startfen w KQkq -|e4"])
	assert.True(t, moves["startfen w KQkq -|d4"])
	assert.True(t, moves["after-e4 b KQkq -|e5"])
	assert.Len(t, moves, 3)
}

func TestFindBranch(t *testing.T) {
	najdorf := "Najdorf"
	sicilian := "Sicilian"
	root := &models.RepertoireNode{
		ID:  "root",
		FEN: "r",
		Children: []*models.RepertoireNode{
			{
				ID: "c1", FEN: "f1", Move: strptr("e4"), BranchName: &sicilian,
				Children: []*models.RepertoireNode{
					{ID: "c2", FEN: "f2", Move: strptr("c5"), BranchName: &najdorf},
				},
			},
		},
	}

	deep := []models.MoveAnalysis{
		{SAN: "e4", Status: "in-repertoire"},
		{SAN: "c5", Status: "in-repertoire"},
	}
	assert.Equal(t, "Najdorf", FindBranch(root, deep))

	shallow := []models.MoveAnalysis{
		{SAN: "e4", Status: "in-repertoire"},
		{SAN: "c5", Status: "opponent-new"},
	}
	assert.Equal(t, "Sicilian", FindBranch(root, shallow))

	assert.Equal(t, "", FindBranch(root, nil))
	assert.Equal(t, "", FindBranch(nil, deep))
}
