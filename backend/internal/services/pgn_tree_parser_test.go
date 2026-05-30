package services

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/kumquat/backend/internal/models"
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
		switch *child.Move {
		case "e5":
			// e5 -> Nf3
			assert.Len(t, child.Children, 1)
		case "c5":
			// c5 -> Nf3
			assert.Len(t, child.Children, 1)
			assert.Equal(t, "Nf3", *child.Children[0].Move)
		default:
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

func TestParsePGNToTree_CustomFENHeader_Rejected(t *testing.T) {
	// Lichess study chapter starting from a non-standard position should be rejected
	pgn := `[Event "My Study: Sicilian Defense"]
[FEN "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1"]
[Orientation "Black"]

1... c5 2. Nf3 d6 *`

	_, _, err := ParsePGNToTree(pgn)
	assert.ErrorIs(t, err, ErrCustomStartingPosition)
}

func TestParseChapterPGNToTree_CustomFENHeader_Accepted(t *testing.T) {
	// A "From Position" chapter is imported rooted at its custom starting FEN.
	pgn := `[Event "My Study: Sicilian Defense"]
[FEN "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1"]
[Orientation "Black"]

1... c5 2. Nf3 d6 *`

	root, headers, err := ParseChapterPGNToTree(pgn)
	require.NoError(t, err)
	// Root is the custom position (normalized, counters stripped), black to move.
	assert.Equal(t, "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq -", root.FEN)
	assert.Equal(t, models.ChessColorBlack, root.ColorToMove)
	assert.Equal(t, "Black", headers["Orientation"])

	// Moves are replayed from the custom position.
	require.Len(t, root.Children, 1)
	assert.Equal(t, "c5", *root.Children[0].Move)
	// After 1...c5 the en-passant square is c6.
	assert.Equal(t, "rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq c6", root.Children[0].FEN)
}

func TestParseChapterPGNToTree_StandardStart_StillWorks(t *testing.T) {
	pgn := `[Event "Test"]

1. e4 e5 *`

	root, _, err := ParseChapterPGNToTree(pgn)
	require.NoError(t, err)
	require.Len(t, root.Children, 1)
	assert.Equal(t, "e4", *root.Children[0].Move)
	assert.Equal(t, models.ChessColorWhite, root.ColorToMove)
}

func TestParsePGNToTree_StandardFENHeader_Accepted(t *testing.T) {
	// A FEN header matching the standard starting position should be accepted
	pgn := `[Event "Test"]
[FEN "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"]

1. e4 e5 *`

	root, _, err := ParsePGNToTree(pgn)
	require.NoError(t, err)
	require.Len(t, root.Children, 1)
	assert.Equal(t, "e4", *root.Children[0].Move)
}

func TestParsePGNToTree_CommentsAttached(t *testing.T) {
	pgn := `1. e4 {Best by test} e5 {Solid reply} 2. Nf3 *`

	root, _, err := ParsePGNToTree(pgn)
	require.NoError(t, err)

	e4 := root.Children[0]
	require.NotNil(t, e4.Comment)
	assert.Equal(t, "Best by test", *e4.Comment)

	e5 := e4.Children[0]
	require.NotNil(t, e5.Comment)
	assert.Equal(t, "Solid reply", *e5.Comment)

	nf3 := e5.Children[0]
	assert.Nil(t, nf3.Comment)
}

// assertWellFormedTree walks the parsed tree and asserts the invariants we rely
// on downstream: no nil child pointers, every node has a non-empty FEN, and every
// non-root node carries a move. It is used by the malformed-input tests to pin the
// parser's "degrade gracefully, never produce a broken tree" behaviour.
func assertWellFormedTree(t *testing.T, node *models.RepertoireNode, isRoot bool) {
	t.Helper()
	require.NotNil(t, node, "tree node must not be nil")
	assert.NotEmpty(t, node.FEN, "every node must have a FEN")
	if isRoot {
		assert.Nil(t, node.Move, "root node must not have a move")
	} else {
		require.NotNil(t, node.Move, "non-root node must have a move")
		assert.NotEmpty(t, *node.Move, "non-root node move must be non-empty")
	}
	for _, child := range node.Children {
		require.NotNil(t, child, "child pointers must not be nil")
		assertWellFormedTree(t, child, false)
	}
}

// TestParsePGNToTree_MalformedInput pins the parser's defensive handling of
// untrusted, structurally broken movetext. None of these inputs may panic; the
// parser must either return an error or a well-formed tree.
func TestParsePGNToTree_MalformedInput(t *testing.T) {
	tests := []struct {
		name string
		pgn  string
	}{
		{"unbalanced open paren", `1. e4 e5 (1... c5 2. Nf3 *`},
		{"unbalanced close paren", `1. e4 e5) 2. Nf3 *`},
		{"extra close parens", `1. e4 e5 (1... c5) ) ) 2. Nf3 *`},
		{"orphan variation at start", `(1. e4 e5) 2. Nf3 *`},
		{"orphan close before any move", `) 1. e4 *`},
		{"only parens", `( ( ) )`},
		{"unterminated comment", `1. e4 {this comment never closes e5 2. Nf3`},
		{"unterminated comment with paren inside", `1. e4 {comment ( with paren e5 *`},
		{"comment closed but paren open", `1. e4 {ok} (1... c5 *`},
		{"empty parens between moves", `1. e4 () e5 *`},
		{"nested unbalanced parens", `1. e4 e5 (1... c5 (2. Nf3 *`},
		{"variation start at very beginning then valid", `( ) 1. e4 e5 *`},
		{"only garbage tokens", `??? !!! $$$ ...`},
		{"dangling NAG and comment", `1. e4 $ { ! ? *`},
		{"unterminated line comment", `1. e4 ; trailing comment with no newline`},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			require.NotPanics(t, func() {
				root, headers, err := ParsePGNToTree(tt.pgn)
				if err != nil {
					// An error is an acceptable outcome for malformed input.
					return
				}
				// On success the tree must be structurally sound.
				assert.NotNil(t, headers)
				assertWellFormedTree(t, &root, true)
			}, "parser must not panic on malformed input")
		})
	}
}

// TestTokenizePGNMovetext_MalformedInput ensures the tokenizer itself never
// panics on broken movetext (the first line of defence against untrusted input).
func TestTokenizePGNMovetext_MalformedInput(t *testing.T) {
	inputs := []string{
		`1. e4 {unterminated comment`,
		`1. e4 (`,
		`)`,
		`((((`,
		`))))`,
		`$`,
		`1. e4 ; line comment no newline`,
		``,
		`{`,
		`(((1. e4`,
	}

	for _, in := range inputs {
		t.Run(in, func(t *testing.T) {
			require.NotPanics(t, func() {
				_ = tokenizePGNMovetext(in)
			}, "tokenizer must not panic on malformed movetext")
		})
	}
}

func TestParseAnnotations(t *testing.T) {
	t.Run("single arrow", func(t *testing.T) {
		cleaned, arrows, highlights := parseAnnotations("[%cal Gb4e1]")
		assert.Equal(t, "", cleaned)
		require.Len(t, arrows, 1)
		assert.Equal(t, models.Arrow{From: "b4", To: "e1", Color: "#15781B"}, arrows[0])
		assert.Len(t, highlights, 0)
	})

	t.Run("multiple arrows", func(t *testing.T) {
		cleaned, arrows, highlights := parseAnnotations("[%cal Gb4e1,Ra1h8]")
		assert.Equal(t, "", cleaned)
		require.Len(t, arrows, 2)
		assert.Equal(t, models.Arrow{From: "b4", To: "e1", Color: "#15781B"}, arrows[0])
		assert.Equal(t, models.Arrow{From: "a1", To: "h8", Color: "#882020"}, arrows[1])
		assert.Len(t, highlights, 0)
	})

	t.Run("single highlight", func(t *testing.T) {
		cleaned, arrows, highlights := parseAnnotations("[%csl Rb4]")
		assert.Equal(t, "", cleaned)
		assert.Len(t, arrows, 0)
		require.Len(t, highlights, 1)
		assert.Equal(t, models.SquareHighlight{Square: "b4", Color: "#882020"}, highlights[0])
	})

	t.Run("multiple highlights", func(t *testing.T) {
		cleaned, arrows, highlights := parseAnnotations("[%csl Rb4,Gb2]")
		assert.Equal(t, "", cleaned)
		assert.Len(t, arrows, 0)
		require.Len(t, highlights, 2)
		assert.Equal(t, models.SquareHighlight{Square: "b4", Color: "#882020"}, highlights[0])
		assert.Equal(t, models.SquareHighlight{Square: "b2", Color: "#15781B"}, highlights[1])
	})

	t.Run("mixed cal and csl", func(t *testing.T) {
		cleaned, arrows, highlights := parseAnnotations("Good move [%cal Ge2e4] [%csl Ye4]")
		assert.Equal(t, "Good move", cleaned)
		require.Len(t, arrows, 1)
		assert.Equal(t, models.Arrow{From: "e2", To: "e4", Color: "#15781B"}, arrows[0])
		require.Len(t, highlights, 1)
		assert.Equal(t, models.SquareHighlight{Square: "e4", Color: "#e68f00"}, highlights[0])
	})

	t.Run("no annotations", func(t *testing.T) {
		cleaned, arrows, highlights := parseAnnotations("Just a normal comment")
		assert.Equal(t, "Just a normal comment", cleaned)
		assert.Len(t, arrows, 0)
		assert.Len(t, highlights, 0)
	})

	t.Run("all four colors", func(t *testing.T) {
		cleaned, arrows, _ := parseAnnotations("[%cal Ga1b1,Ra2b2,Ba3b3,Ya4b4]")
		assert.Equal(t, "", cleaned)
		require.Len(t, arrows, 4)
		assert.Equal(t, "#15781B", arrows[0].Color) // Green
		assert.Equal(t, "#882020", arrows[1].Color) // Red
		assert.Equal(t, "#003088", arrows[2].Color) // Blue
		assert.Equal(t, "#e68f00", arrows[3].Color) // Yellow
	})

	t.Run("annotation only comment produces empty cleaned text", func(t *testing.T) {
		cleaned, arrows, highlights := parseAnnotations("[%cal Ge2e4] [%csl Re4]")
		assert.Equal(t, "", cleaned)
		assert.Len(t, arrows, 1)
		assert.Len(t, highlights, 1)
	})
}

func TestParsePGNToTree_Annotations(t *testing.T) {
	pgn := `[Event "Test"]

1. e4 {Good first move [%cal Ge2e4] [%csl Ye4]} e5 {[%cal Ra7a5,Gb7b5]} 2. Nf3 *`

	root, _, err := ParsePGNToTree(pgn)
	require.NoError(t, err)

	// e4 node: comment cleaned, arrow + highlight present
	e4 := root.Children[0]
	require.NotNil(t, e4.Comment)
	assert.Equal(t, "Good first move", *e4.Comment)
	require.Len(t, e4.Arrows, 1)
	assert.Equal(t, models.Arrow{From: "e2", To: "e4", Color: "#15781B"}, e4.Arrows[0])
	require.Len(t, e4.Highlights, 1)
	assert.Equal(t, models.SquareHighlight{Square: "e4", Color: "#e68f00"}, e4.Highlights[0])

	// e5 node: annotation-only comment, so Comment should be nil
	e5 := e4.Children[0]
	assert.Nil(t, e5.Comment)
	require.Len(t, e5.Arrows, 2)
	assert.Equal(t, models.Arrow{From: "a7", To: "a5", Color: "#882020"}, e5.Arrows[0])
	assert.Equal(t, models.Arrow{From: "b7", To: "b5", Color: "#15781B"}, e5.Arrows[1])

	// Nf3 node: no annotations
	nf3 := e5.Children[0]
	assert.Nil(t, nf3.Comment)
	assert.Len(t, nf3.Arrows, 0)
	assert.Len(t, nf3.Highlights, 0)
}
