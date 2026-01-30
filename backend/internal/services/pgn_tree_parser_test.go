package services

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/treechess/backend/internal/models"
)

func TestTokenizePGNMovetext(t *testing.T) {
	t.Run("simple main line", func(t *testing.T) {
		tokens := tokenizePGNMovetext("1. e4 e5 2. Nf3 Nc6 1-0")
		var moveTokens []string
		for _, tok := range tokens {
			if tok.typ == tokenMove {
				moveTokens = append(moveTokens, tok.value)
			}
		}
		assert.Equal(t, []string{"e4", "e5", "Nf3", "Nc6"}, moveTokens)
	})

	t.Run("variation tokens", func(t *testing.T) {
		tokens := tokenizePGNMovetext("1. e4 e5 (1... c5) 2. Nf3 *")
		var types []pgnTokenType
		for _, tok := range tokens {
			types = append(types, tok.typ)
		}
		assert.Contains(t, types, tokenVariationStart)
		assert.Contains(t, types, tokenVariationEnd)
	})

	t.Run("comments", func(t *testing.T) {
		tokens := tokenizePGNMovetext("1. e4 {Best move} e5 *")
		var comments []string
		for _, tok := range tokens {
			if tok.typ == tokenComment {
				comments = append(comments, tok.value)
			}
		}
		assert.Equal(t, []string{"Best move"}, comments)
	})

	t.Run("NAGs", func(t *testing.T) {
		tokens := tokenizePGNMovetext("1. e4! e5? 2. Nf3!! $1 *")
		var nags []string
		for _, tok := range tokens {
			if tok.typ == tokenNAG {
				nags = append(nags, tok.value)
			}
		}
		assert.Contains(t, nags, "!")
		assert.Contains(t, nags, "?")
		assert.Contains(t, nags, "!!")
		assert.Contains(t, nags, "$1")
	})

	t.Run("move with trailing annotation", func(t *testing.T) {
		tokens := tokenizePGNMovetext("1. e4! e5?! *")
		var moves []string
		for _, tok := range tokens {
			if tok.typ == tokenMove {
				moves = append(moves, tok.value)
			}
		}
		assert.Equal(t, []string{"e4", "e5"}, moves)
	})
}

func TestParsePGNToTree_SimpleMainLine(t *testing.T) {
	pgn := `[Event "Test"]
[Site "Test"]

1. e4 e5 2. Nf3 Nc6 *`

	root, headers, err := ParsePGNToTree(pgn)
	require.NoError(t, err)

	assert.Equal(t, "Test", headers["Event"])
	assert.Nil(t, root.Move, "root should have no move")
	assert.Len(t, root.Children, 1, "root should have one child (e4)")

	// Walk the main line: e4 -> e5 -> Nf3 -> Nc6
	node := root.Children[0]
	assert.Equal(t, "e4", *node.Move)
	assert.Len(t, node.Children, 1)

	node = node.Children[0]
	assert.Equal(t, "e5", *node.Move)
	assert.Len(t, node.Children, 1)

	node = node.Children[0]
	assert.Equal(t, "Nf3", *node.Move)
	assert.Len(t, node.Children, 1)

	node = node.Children[0]
	assert.Equal(t, "Nc6", *node.Move)
	assert.Len(t, node.Children, 0)
}

func TestParsePGNToTree_SingleVariation(t *testing.T) {
	pgn := `1. e4 e5 (1... c5 2. Nf3) 2. Nf3 *`

	root, _, err := ParsePGNToTree(pgn)
	require.NoError(t, err)

	// Root -> e4
	require.Len(t, root.Children, 1)
	e4 := root.Children[0]
	assert.Equal(t, "e4", *e4.Move)

	// e4 should have two children: e5 (main line) and c5 (variation)
	require.Len(t, e4.Children, 2, "e4 should have two children: e5 and c5")

	for _, child := range e4.Children {
		if *child.Move == "e5" {
			// e5 -> Nf3
			assert.Len(t, child.Children, 1)
		} else if *child.Move == "c5" {
			// c5 -> Nf3
			assert.Len(t, child.Children, 1)
			assert.Equal(t, "Nf3", *child.Children[0].Move)
		} else {
			t.Fatalf("unexpected child move: %s", *child.Move)
		}
	}
}

func TestParsePGNToTree_NestedVariations(t *testing.T) {
	pgn := `1. e4 e5 (1... c5 (1... d5 2. exd5)) 2. Nf3 *`

	root, _, err := ParsePGNToTree(pgn)
	require.NoError(t, err)

	// Root -> e4
	require.Len(t, root.Children, 1)
	e4 := root.Children[0]
	assert.Equal(t, "e4", *e4.Move)

	// e4 should have three children: e5, c5, d5
	require.Len(t, e4.Children, 3, "e4 should have e5, c5, and d5 as children")

	moveNames := make(map[string]bool)
	for _, child := range e4.Children {
		moveNames[*child.Move] = true
	}
	assert.True(t, moveNames["e5"])
	assert.True(t, moveNames["c5"])
	assert.True(t, moveNames["d5"])

	// d5 should have exd5 as a child
	for _, child := range e4.Children {
		if *child.Move == "d5" {
			require.Len(t, child.Children, 1)
			assert.Equal(t, "exd5", *child.Children[0].Move)
		}
	}
}

func TestParsePGNToTree_SiblingVariations(t *testing.T) {
	pgn := `1. e4 e5 (1... c5) (1... d5) 2. Nf3 *`

	root, _, err := ParsePGNToTree(pgn)
	require.NoError(t, err)

	e4 := root.Children[0]
	assert.Equal(t, "e4", *e4.Move)

	// e4 should have three children: e5, c5, d5
	require.Len(t, e4.Children, 3)

	moveNames := make(map[string]bool)
	for _, child := range e4.Children {
		moveNames[*child.Move] = true
	}
	assert.True(t, moveNames["e5"])
	assert.True(t, moveNames["c5"])
	assert.True(t, moveNames["d5"])
}

func TestParsePGNToTree_CommentsAndNAGs(t *testing.T) {
	pgn := `1. e4 {Best by test} e5! 2. Nf3 $1 Nc6 *`

	root, _, err := ParsePGNToTree(pgn)
	require.NoError(t, err)

	// Should still parse the moves correctly, ignoring comments/NAGs
	require.Len(t, root.Children, 1)
	node := root.Children[0]
	assert.Equal(t, "e4", *node.Move)

	node = node.Children[0]
	assert.Equal(t, "e5", *node.Move)

	node = node.Children[0]
	assert.Equal(t, "Nf3", *node.Move)

	node = node.Children[0]
	assert.Equal(t, "Nc6", *node.Move)
}

func TestParsePGNToTree_InvalidMove(t *testing.T) {
	pgn := `1. e4 Qxd7 *`

	_, _, err := ParsePGNToTree(pgn)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "invalid move")
}

func TestParsePGNToTree_DeduplicateMoves(t *testing.T) {
	// Two variations that start with the same move
	pgn := `1. e4 e5 (1... e5 2. d4) 2. Nf3 *`

	root, _, err := ParsePGNToTree(pgn)
	require.NoError(t, err)

	e4 := root.Children[0]
	// e5 should appear only once (deduplicated), but with two children: Nf3 and d4
	require.Len(t, e4.Children, 1, "e5 should be deduplicated")
	assert.Equal(t, "e5", *e4.Children[0].Move)
	require.Len(t, e4.Children[0].Children, 2, "deduplicated e5 should have both Nf3 and d4")
}

func TestParsePGNToTree_Headers(t *testing.T) {
	pgn := `[Event "Casual Game"]
[Site "lichess.org"]
[White "Player1"]
[Black "Player2"]
[Result "1-0"]
[Orientation "White"]

1. e4 e5 1-0`

	_, headers, err := ParsePGNToTree(pgn)
	require.NoError(t, err)

	assert.Equal(t, "Casual Game", headers["Event"])
	assert.Equal(t, "lichess.org", headers["Site"])
	assert.Equal(t, "Player1", headers["White"])
	assert.Equal(t, "Player2", headers["Black"])
	assert.Equal(t, "1-0", headers["Result"])
	assert.Equal(t, "White", headers["Orientation"])
}

func TestParsePGNToTree_RealLichessStudy(t *testing.T) {
	// Simulates a typical Lichess study chapter PGN with variations
	pgn := `[Event "My Repertoire: Chapter 1"]
[Site "https://lichess.org/study/abc123"]
[Result "*"]
[Orientation "White"]
[UTCDate "2024.01.01"]
[UTCTime "00:00:00"]

1. e4 e5 (1... c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4) (1... e6 2. d4 d5 3. Nc3) 2. Nf3 Nc6 3. Bb5 a6 (3... Nf6 4. O-O) 4. Ba4 *`

	root, headers, err := ParsePGNToTree(pgn)
	require.NoError(t, err)

	assert.Equal(t, "White", headers["Orientation"])

	// Root -> e4
	require.Len(t, root.Children, 1)
	e4 := root.Children[0]
	assert.Equal(t, "e4", *e4.Move)

	// e4 has three children: e5, c5, e6
	require.Len(t, e4.Children, 3)

	moveNames := make(map[string]bool)
	for _, child := range e4.Children {
		moveNames[*child.Move] = true
	}
	assert.True(t, moveNames["e5"])
	assert.True(t, moveNames["c5"])
	assert.True(t, moveNames["e6"])

	// Follow main line: e5 -> Nf3 -> Nc6 -> Bb5
	var e5Node *models.RepertoireNode
	for _, child := range e4.Children {
		if *child.Move == "e5" {
			e5Node = child
			break
		}
	}
	require.NotNil(t, e5Node)
	require.Len(t, e5Node.Children, 1)
	nf3 := e5Node.Children[0]
	assert.Equal(t, "Nf3", *nf3.Move)

	require.Len(t, nf3.Children, 1)
	nc6 := nf3.Children[0]
	assert.Equal(t, "Nc6", *nc6.Move)

	require.Len(t, nc6.Children, 1)
	bb5 := nc6.Children[0]
	assert.Equal(t, "Bb5", *bb5.Move)

	// Bb5 has two children: a6 (main) and Nf6 (variation)
	require.Len(t, bb5.Children, 2)
	bbMoves := make(map[string]bool)
	for _, child := range bb5.Children {
		bbMoves[*child.Move] = true
	}
	assert.True(t, bbMoves["a6"])
	assert.True(t, bbMoves["Nf6"])

	// Verify Sicilian variation: c5 -> Nf3 -> d6 -> d4 -> cxd4 -> Nxd4
	var c5Node *models.RepertoireNode
	for _, child := range e4.Children {
		if *child.Move == "c5" {
			c5Node = child
			break
		}
	}
	require.NotNil(t, c5Node)
	require.Len(t, c5Node.Children, 1)
	assert.Equal(t, "Nf3", *c5Node.Children[0].Move)
}

func TestParsePGNToTree_EmptyMovetext(t *testing.T) {
	pgn := `[Event "Empty"]

*`
	root, _, err := ParsePGNToTree(pgn)
	require.NoError(t, err)
	assert.Len(t, root.Children, 0)
}

func TestParsePGNToTree_MoveNumbers(t *testing.T) {
	pgn := `1. e4 e5 2. Nf3 Nc6 *`

	root, _, err := ParsePGNToTree(pgn)
	require.NoError(t, err)

	// Check move numbers are set correctly
	e4 := root.Children[0]
	assert.Equal(t, 1, e4.MoveNumber)

	e5 := e4.Children[0]
	assert.Equal(t, 1, e5.MoveNumber)

	nf3 := e5.Children[0]
	assert.Equal(t, 2, nf3.MoveNumber)

	nc6 := nf3.Children[0]
	assert.Equal(t, 2, nc6.MoveNumber)
}

func TestParsePGNToTree_ColorToMove(t *testing.T) {
	pgn := `1. e4 e5 *`

	root, _, err := ParsePGNToTree(pgn)
	require.NoError(t, err)

	// Root: white to move
	assert.Equal(t, models.ChessColorWhite, root.ColorToMove)

	// After e4: black to move
	e4 := root.Children[0]
	assert.Equal(t, models.ChessColorBlack, e4.ColorToMove)

	// After e5: white to move
	e5 := e4.Children[0]
	assert.Equal(t, models.ChessColorWhite, e5.ColorToMove)
}
