package analysiscore

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/kumquat/backend/internal/models"
)

func strptr(s string) *string { return &s }

func nodeWithChildren(moves ...string) *models.RepertoireNode {
	node := &models.RepertoireNode{FEN: "f"}
	for _, m := range moves {
		node.Children = append(node.Children, &models.RepertoireNode{Move: strptr(m)})
	}
	return node
}

func TestClassifyMove(t *testing.T) {
	node := nodeWithChildren("e4", "d4")

	t.Run("nil node is out of book", func(t *testing.T) {
		c := ClassifyMove(nil, "e4", true)
		assert.Equal(t, StatusOutOfBook, c.Status)
	})

	t.Run("leaf node is out of book", func(t *testing.T) {
		c := ClassifyMove(&models.RepertoireNode{FEN: "f"}, "e4", true)
		assert.Equal(t, StatusOutOfBook, c.Status)
	})

	t.Run("matching move is in repertoire", func(t *testing.T) {
		c := ClassifyMove(node, "e4", true)
		assert.Equal(t, StatusInRepertoire, c.Status)
		assert.Empty(t, c.ExpectedMove)
	})

	t.Run("user deviation is out of repertoire with expected move", func(t *testing.T) {
		c := ClassifyMove(node, "Nf3", true)
		assert.Equal(t, StatusOutOfRepertoire, c.Status)
		assert.Equal(t, "e4", c.ExpectedMove)
	})

	t.Run("opponent deviation is opponent-new", func(t *testing.T) {
		c := ClassifyMove(node, "Nf3", false)
		assert.Equal(t, StatusOpponentNew, c.Status)
		assert.Empty(t, c.ExpectedMove)
	})
}

func TestIsUserMove(t *testing.T) {
	assert.True(t, IsUserMove(0, models.ColorWhite))
	assert.False(t, IsUserMove(1, models.ColorWhite))
	assert.True(t, IsUserMove(1, models.ColorBlack))
	assert.False(t, IsUserMove(0, models.ColorBlack))
}

func TestIsOpponentFirstMove(t *testing.T) {
	assert.True(t, IsOpponentFirstMove(0, models.ColorBlack))
	assert.False(t, IsOpponentFirstMove(1, models.ColorBlack))
	assert.True(t, IsOpponentFirstMove(1, models.ColorWhite))
	assert.False(t, IsOpponentFirstMove(0, models.ColorWhite))
}

func TestBestMatch(t *testing.T) {
	type rep struct {
		name  string
		score int
	}
	reps := []rep{{"a", 1}, {"b", 3}, {"c", 2}}

	best, score := BestMatch(reps, func(r *rep) int { return r.score })
	assert.NotNil(t, best)
	assert.Equal(t, "b", best.name)
	assert.Equal(t, 3, score)
}

func TestBestMatchEmpty(t *testing.T) {
	best, score := BestMatch[int](nil, func(*int) int { return 1 })
	assert.Nil(t, best)
	assert.Equal(t, 0, score)
}

func TestBestMatchAllNegativeIsNoMatch(t *testing.T) {
	vals := []int{0, 0}
	best, score := BestMatch(vals, func(*int) int { return -1 })
	assert.Nil(t, best)
	assert.Equal(t, 0, score)
}

func TestBestMatchTakesFirstOnTie(t *testing.T) {
	vals := []string{"first", "second"}
	best, score := BestMatch(vals, func(*string) int { return 5 })
	assert.Equal(t, "first", *best)
	assert.Equal(t, 5, score)
}
