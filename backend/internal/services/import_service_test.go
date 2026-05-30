package services

import (
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/kumquat/backend/config"
	"github.com/kumquat/backend/internal/models"
	"github.com/kumquat/backend/internal/repository"
	"github.com/kumquat/backend/internal/repository/mocks"
	"github.com/notnil/chess"
)

func TestImportService_ParsePGN(t *testing.T) {
	svc := NewImportService(nil, nil)

	pgnData := `[Event "Test"]
[White "Player1"]
[Black "Player2"]
[Result "1-0"]

1. e4 e5 2. Nf3 Nc6 1-0`

	games, err := svc.parsePGN(pgnData)

	require.NoError(t, err)
	assert.Len(t, games, 1)
}

func TestImportService_ParseMultiplePGN(t *testing.T) {
	svc := NewImportService(nil, nil)

	pgnData := `[Event "Game 1"]
[White "A"]
[Black "B"]
1. e4 1-0

[Event "Game 2"]
[White "C"]
[Black "D"]
1. d4 1-0`

	games, err := svc.parsePGN(pgnData)

	require.NoError(t, err)
	assert.GreaterOrEqual(t, len(games), 1)
}

func TestImportService_ValidatePGN_Valid(t *testing.T) {
	svc := NewImportService(nil, nil)

	pgnData := `[Event "Test"]
[White "A"]
[Black "B"]
1. e4 e5 1-0`

	err := svc.ValidatePGN(pgnData)

	assert.NoError(t, err)
}

func TestImportService_ValidateMove_Valid(t *testing.T) {
	svc := NewImportService(nil, nil)

	fen := "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -"
	san := "e4"

	err := svc.ValidateMove(fen, san)

	assert.NoError(t, err)
}

func TestImportService_ValidateMove_Invalid(t *testing.T) {
	svc := NewImportService(nil, nil)

	fen := "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -"
	san := "e5"

	err := svc.ValidateMove(fen, san)

	assert.Error(t, err)
}

func TestImportService_GetLegalMoves(t *testing.T) {
	svc := NewImportService(nil, nil)

	fen := "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -"
	moves, err := svc.GetLegalMoves(fen)

	require.NoError(t, err)
	assert.NotEmpty(t, moves)
}

func TestExtractHeaders(t *testing.T) {
	svc := NewImportService(nil, nil)

	pgnData := `[Event "World Championship"]
[Site "London"]
[Date "2024.01.01"]
[White "Carlsen"]
[Black "Niemann"]
[Result "1-0"]

1. e4 e5 1-0`

	games, err := svc.parsePGN(pgnData)
	require.NoError(t, err)
	require.Len(t, games, 1)

	headers := svc.extractHeaders(games[0])

	assert.Equal(t, "World Championship", headers["Event"])
	assert.Equal(t, "London", headers["Site"])
	assert.Equal(t, "2024.01.01", headers["Date"])
	assert.Equal(t, "Carlsen", headers["White"])
	assert.Equal(t, "Niemann", headers["Black"])
	assert.Equal(t, "1-0", headers["Result"])
}

func TestExtractHeaders_Defaults(t *testing.T) {
	svc := NewImportService(nil, nil)

	pgnData := `1. e4 e5 1-0`

	games, err := svc.parsePGN(pgnData)
	require.NoError(t, err)
	require.Len(t, games, 1)

	headers := svc.extractHeaders(games[0])

	assert.Equal(t, "Unknown", headers["Event"])
	assert.Equal(t, "Unknown", headers["White"])
	assert.Equal(t, "Unknown", headers["Black"])
	assert.Equal(t, "*", headers["Result"])
}

func TestFindNodeInRepertoire_Found(t *testing.T) {
	svc := NewImportService(nil, nil)

	moveE4 := "e4"
	root := models.RepertoireNode{
		ID:          "root",
		FEN:         "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -",
		Move:        nil,
		ColorToMove: models.ChessColorWhite,
		Children: []*models.RepertoireNode{
			{
				ID:          "e4",
				FEN:         "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3",
				Move:        &moveE4,
				ColorToMove: models.ChessColorBlack,
			},
		},
	}

	fen := "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -"
	result := svc.findNodeInRepertoire(root, fen)

	require.NotNil(t, result)
	assert.Equal(t, "root", result.ID)
	assert.Len(t, result.Children, 1)
}

func TestFindNodeInRepertoire_NotFound(t *testing.T) {
	svc := NewImportService(nil, nil)

	root := models.RepertoireNode{
		ID:          "root",
		FEN:         "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -",
		Move:        nil,
		ColorToMove: models.ChessColorWhite,
	}

	differentFEN := "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6"
	result := svc.findNodeInRepertoire(root, differentFEN)

	assert.Nil(t, result)
}

func TestFindNodeInRepertoire_ReturnsNodeWithChildren(t *testing.T) {
	svc := NewImportService(nil, nil)

	moveE4 := "e4"
	moveD4 := "d4"
	root := models.RepertoireNode{
		ID:          "root",
		FEN:         "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -",
		Move:        nil,
		ColorToMove: models.ChessColorWhite,
		Children: []*models.RepertoireNode{
			{ID: "e4", FEN: "...", Move: &moveE4},
			{ID: "d4", FEN: "...", Move: &moveD4},
		},
	}

	fen := "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -"
	result := svc.findNodeInRepertoire(root, fen)

	require.NotNil(t, result)
	assert.Len(t, result.Children, 2)
	assert.Equal(t, "e4", *result.Children[0].Move)
}

func TestBuildFENIndex_LookupMatchesFindNode(t *testing.T) {
	svc := NewImportService(nil, nil)

	moveE4 := "e4"
	moveE5 := "e5"
	root := models.RepertoireNode{
		ID:  "root",
		FEN: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -",
		Children: []*models.RepertoireNode{
			{
				ID:   "e4",
				FEN:  "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3",
				Move: &moveE4,
				Children: []*models.RepertoireNode{
					{
						ID:   "e5",
						FEN:  "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6",
						Move: &moveE5,
					},
				},
			},
		},
	}

	index := buildFENIndex(&root)

	// Every node reachable in the tree resolves to the same node the recursive
	// search would return. findNodeInRepertoire takes root by value, so for the
	// root FEN it returns a pointer into its local copy; compare by node identity
	// (ID) rather than pointer to stay robust to that copy.
	for _, fen := range []string{
		"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -",
		"rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3",
		"rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6",
	} {
		recursive := svc.findNodeInRepertoire(root, fen)
		indexed := index[fen]
		require.NotNil(t, recursive, "findNodeInRepertoire should find %s", fen)
		require.NotNil(t, indexed, "index should contain %s", fen)
		assert.Equal(t, recursive.ID, indexed.ID, "index lookup must match findNodeInRepertoire for %s", fen)
	}
}

func TestBuildFENIndex_MissingFEN(t *testing.T) {
	root := models.RepertoireNode{
		ID:  "root",
		FEN: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -",
	}

	index := buildFENIndex(&root)

	node, ok := index["rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6"]
	assert.False(t, ok)
	assert.Nil(t, node)
}

func TestBuildFENIndex_TranspositionKeepsFirstPreOrderNode(t *testing.T) {
	// Two distinct nodes share the same FEN (a transposition). A pre-order DFS
	// reaches "first" before "second"; the index must keep "first" so it agrees
	// with findNodeInRepertoire's first-match semantics.
	svc := NewImportService(nil, nil)

	moveA := "a"
	moveB := "b"
	sharedFEN := "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6"
	root := models.RepertoireNode{
		ID:  "root",
		FEN: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -",
		Children: []*models.RepertoireNode{
			{ID: "first", FEN: sharedFEN, Move: &moveA},
			{ID: "second", FEN: sharedFEN, Move: &moveB},
		},
	}

	index := buildFENIndex(&root)

	require.NotNil(t, index[sharedFEN])
	assert.Equal(t, "first", index[sharedFEN].ID)
	assert.Same(t, svc.findNodeInRepertoire(root, sharedFEN), index[sharedFEN])
}

func TestPGNWithNewlines(t *testing.T) {
	svc := NewImportService(nil, nil)

	pgnData := `[Event "Test"]
[White "A"]
[Black "B"]

1. e4
e5
1-0`

	games, err := svc.parsePGN(pgnData)

	require.NoError(t, err)
	assert.Len(t, games, 1)
	assert.Len(t, games[0].Moves(), 2)
}

func TestPosition_StringMethod(t *testing.T) {
	position := chess.StartingPosition()
	fen := position.String()

	assert.Contains(t, fen, "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -")
}

func TestGameStringContainsHeaders(t *testing.T) {
	svc := NewImportService(nil, nil)

	pgnData := `[Event "Test Game"]
[White "Test White"]
[Black "Test Black"]
1. e4 e5 1-0`

	games, err := svc.parsePGN(pgnData)
	require.NoError(t, err)

	output := games[0].String()
	assert.Contains(t, output, "[Event \"Test Game\"]")
	assert.Contains(t, output, "[White \"Test White\"]")
}

func TestNormalizeFEN(t *testing.T) {
	fullFEN := "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
	normalized := normalizeFEN(fullFEN)

	assert.Equal(t, "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -", normalized)
}

func TestAnalyzeGame_CountMoves(t *testing.T) {
	svc := NewImportService(nil, nil)

	pgnData := `[Event "Test"]
[White "A"]
[Black "B"]
1. e4 e5 2. Nf3 Nc6 1-0`

	games, err := svc.parsePGN(pgnData)
	require.NoError(t, err)
	require.Len(t, games, 1)

	root := models.RepertoireNode{
		ID:          "root",
		FEN:         "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -",
		Move:        nil,
		ColorToMove: models.ChessColorWhite,
	}

	analysis := svc.analyzeGame(0, games[0], root, models.ColorWhite)

	assert.Len(t, analysis.Moves, 4)
	assert.Equal(t, 0, analysis.Moves[0].PlyNumber)
	assert.Equal(t, 1, analysis.Moves[1].PlyNumber)
	assert.Equal(t, 2, analysis.Moves[2].PlyNumber)
	assert.Equal(t, 3, analysis.Moves[3].PlyNumber)
}

func TestAnalyzeGame_WhiteMoveClassification(t *testing.T) {
	svc := NewImportService(nil, nil)

	pgnData := `[Event "Test"]
[White "A"]
[Black "B"]
1. e4 d5 1-0`

	games, err := svc.parsePGN(pgnData)
	require.NoError(t, err)
	require.Len(t, games, 1)

	root := models.RepertoireNode{
		ID:          "root",
		FEN:         "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -",
		Move:        nil,
		ColorToMove: models.ChessColorWhite,
	}

	analysis := svc.analyzeGame(0, games[0], root, models.ColorWhite)

	assert.Len(t, analysis.Moves, 2)
	assert.True(t, analysis.Moves[0].IsUserMove)
	assert.False(t, analysis.Moves[1].IsUserMove)
}

func TestAnalyzeGame_BlackRepertoire(t *testing.T) {
	svc := NewImportService(nil, nil)

	pgnData := `[Event "Test"]
[White "A"]
[Black "B"]
1. e4 e5 1-0`

	games, err := svc.parsePGN(pgnData)
	require.NoError(t, err)
	require.Len(t, games, 1)

	root := models.RepertoireNode{
		ID:          "root",
		FEN:         "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -",
		Move:        nil,
		ColorToMove: models.ChessColorWhite,
	}

	analysis := svc.analyzeGame(0, games[0], root, models.ColorBlack)

	assert.Len(t, analysis.Moves, 2)
	assert.False(t, analysis.Moves[0].IsUserMove)
	assert.Equal(t, "out-of-book", analysis.Moves[0].Status) // Root has no children → out-of-book
	assert.True(t, analysis.Moves[1].IsUserMove)
}

func TestAnalyzeGame_NoRepertoire(t *testing.T) {
	svc := NewImportService(nil, nil)

	pgnData := `[Event "Test"]
[White "A"]
[Black "B"]
1. e4 d5 1-0`

	games, err := svc.parsePGN(pgnData)
	require.NoError(t, err)
	require.Len(t, games, 1)

	root := models.RepertoireNode{
		ID:          "root",
		FEN:         "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -",
		Move:        nil,
		ColorToMove: models.ChessColorWhite,
	}

	analysis := svc.analyzeGame(0, games[0], root, models.ColorWhite)

	assert.Len(t, analysis.Moves, 2)
	assert.Equal(t, "out-of-book", analysis.Moves[0].Status) // Root has no children → out-of-book
	assert.Equal(t, "out-of-book", analysis.Moves[1].Status) // Still no tree → out-of-book
}

func strPtr(s string) *string {
	return &s
}

func TestDetermineUserColor_WhitePlayer(t *testing.T) {
	svc := NewImportService(nil, nil)

	pgnData := `[Event "Test"]
[White "TestUser"]
[Black "Opponent"]
1. e4 e5 1-0`

	games, err := svc.parsePGN(pgnData)
	require.NoError(t, err)
	require.Len(t, games, 1)

	color := svc.determineUserColor(games[0], "TestUser")

	assert.Equal(t, models.ColorWhite, color)
}

func TestDetermineUserColor_BlackPlayer(t *testing.T) {
	svc := NewImportService(nil, nil)

	pgnData := `[Event "Test"]
[White "Opponent"]
[Black "TestUser"]
1. e4 e5 1-0`

	games, err := svc.parsePGN(pgnData)
	require.NoError(t, err)
	require.Len(t, games, 1)

	color := svc.determineUserColor(games[0], "TestUser")

	assert.Equal(t, models.ColorBlack, color)
}

func TestDetermineUserColor_CaseInsensitive(t *testing.T) {
	svc := NewImportService(nil, nil)

	pgnData := `[Event "Test"]
[White "TESTUSER"]
[Black "Opponent"]
1. e4 e5 1-0`

	games, err := svc.parsePGN(pgnData)
	require.NoError(t, err)
	require.Len(t, games, 1)

	// Username with different case should still match
	color := svc.determineUserColor(games[0], "testuser")

	assert.Equal(t, models.ColorWhite, color)
}

func TestDetermineUserColor_NotInGame(t *testing.T) {
	svc := NewImportService(nil, nil)

	pgnData := `[Event "Test"]
[White "Player1"]
[Black "Player2"]
1. e4 e5 1-0`

	games, err := svc.parsePGN(pgnData)
	require.NoError(t, err)
	require.Len(t, games, 1)

	// User not in this game
	color := svc.determineUserColor(games[0], "TestUser")

	assert.Equal(t, models.Color(""), color)
}

func TestDetermineUserColor_LichessUsernameFormat(t *testing.T) {
	svc := NewImportService(nil, nil)

	// Lichess often has usernames like "DrNykterstein" or URLs
	pgnData := `[Event "Rated Blitz game"]
[White "Magnus_Carlsen"]
[Black "DrNykterstein"]
1. e4 c5 1-0`

	games, err := svc.parsePGN(pgnData)
	require.NoError(t, err)
	require.Len(t, games, 1)

	color := svc.determineUserColor(games[0], "drnykterstein")

	assert.Equal(t, models.ColorBlack, color)
}

// Additional tests for edge cases and better coverage

func TestNewImportService(t *testing.T) {
	repSvc := NewRepertoireService(nil)
	svc := NewImportService(repSvc, nil)

	assert.NotNil(t, svc)
	assert.NotNil(t, svc.repertoireService)
}

func TestNewImportService_NilRepertoire(t *testing.T) {
	svc := NewImportService(nil, nil)

	assert.NotNil(t, svc)
	assert.Nil(t, svc.repertoireService)
}

func TestValidatePGN_InvalidMoves(t *testing.T) {
	svc := NewImportService(nil, nil)

	// PGN with illegal moves - the library may or may not error
	// It's lenient, so test that validation doesn't panic
	invalidPGN := `[Event "Test"]
[White "A"]
[Black "B"]
1. e4 e5 2. Qxg7 1-0`

	// This tests that the function handles various inputs without panicking
	_ = svc.ValidatePGN(invalidPGN)
}

func TestValidatePGN_Empty(t *testing.T) {
	svc := NewImportService(nil, nil)

	err := svc.ValidatePGN("")

	// Empty PGN should parse but have no games
	assert.NoError(t, err)
}

func TestValidateMove_InvalidFEN(t *testing.T) {
	svc := NewImportService(nil, nil)

	err := svc.ValidateMove("invalid fen string", "e4")

	assert.Error(t, err)
	assert.Contains(t, err.Error(), "invalid FEN")
}

func TestValidateMove_EmptyFEN(t *testing.T) {
	svc := NewImportService(nil, nil)

	err := svc.ValidateMove("", "e4")

	assert.Error(t, err)
}

func TestGetLegalMoves_InvalidFEN(t *testing.T) {
	svc := NewImportService(nil, nil)

	_, err := svc.GetLegalMoves("invalid fen")

	assert.Error(t, err)
	assert.Contains(t, err.Error(), "invalid FEN")
}

func TestGetLegalMoves_Checkmate(t *testing.T) {
	svc := NewImportService(nil, nil)

	// Fool's mate position - black is checkmated
	fen := "rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq -"

	moves, err := svc.GetLegalMoves(fen)

	require.NoError(t, err)
	assert.Empty(t, moves) // No legal moves in checkmate
}

func TestGetLegalMoves_MidgamePosition(t *testing.T) {
	svc := NewImportService(nil, nil)

	// A typical midgame position
	fen := "r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq -"

	moves, err := svc.GetLegalMoves(fen)

	require.NoError(t, err)
	assert.NotEmpty(t, moves)
	// Should have many legal moves in this position
	assert.Greater(t, len(moves), 20)
}

func TestNormalizeFEN_ShortFEN(t *testing.T) {
	// FEN with fewer than 4 parts
	shortFEN := "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w"

	normalized := normalizeFEN(shortFEN)

	// Should return original if less than 4 parts
	assert.Equal(t, shortFEN, normalized)
}

func TestNormalizeFEN_ExactlyFourParts(t *testing.T) {
	fourPartFEN := "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -"

	normalized := normalizeFEN(fourPartFEN)

	assert.Equal(t, fourPartFEN, normalized)
}

func TestEnsureFullFEN_AlreadyFull(t *testing.T) {
	fullFEN := "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"

	result := ensureFullFEN(fullFEN)

	assert.Equal(t, fullFEN, result)
}

func TestEnsureFullFEN_FourParts(t *testing.T) {
	fourPartFEN := "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -"

	result := ensureFullFEN(fourPartFEN)

	assert.Equal(t, "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", result)
}

func TestEnsureFullFEN_ShortFEN(t *testing.T) {
	shortFEN := "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR"

	result := ensureFullFEN(shortFEN)

	// Should add " 0 1" suffix
	assert.Contains(t, result, "0 1")
}

func TestFindNodeInRepertoire_DeepSearch(t *testing.T) {
	svc := NewImportService(nil, nil)

	moveE4 := "e4"
	moveE5 := "e5"
	moveNf3 := "Nf3"

	root := models.RepertoireNode{
		ID:          "root",
		FEN:         "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -",
		Move:        nil,
		ColorToMove: models.ChessColorWhite,
		Children: []*models.RepertoireNode{
			{
				ID:          "e4",
				FEN:         "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3",
				Move:        &moveE4,
				ColorToMove: models.ChessColorBlack,
				Children: []*models.RepertoireNode{
					{
						ID:          "e5",
						FEN:         "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6",
						Move:        &moveE5,
						ColorToMove: models.ChessColorWhite,
						Children: []*models.RepertoireNode{
							{
								ID:          "Nf3",
								FEN:         "rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq -",
								Move:        &moveNf3,
								ColorToMove: models.ChessColorBlack,
							},
						},
					},
				},
			},
		},
	}

	// Test deep search - should find the node after e4 e5
	fenAfterE4E5 := "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6"
	result := svc.findNodeInRepertoire(root, fenAfterE4E5)

	require.NotNil(t, result)
	assert.Equal(t, "e5", result.ID)
	assert.Len(t, result.Children, 1)
	assert.Equal(t, "Nf3", *result.Children[0].Move)
}

func TestFindNodeInRepertoire_WrongFEN(t *testing.T) {
	svc := NewImportService(nil, nil)

	moveE4 := "e4"
	root := models.RepertoireNode{
		ID:          "root",
		FEN:         "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -",
		Move:        nil,
		ColorToMove: models.ChessColorWhite,
		Children: []*models.RepertoireNode{
			{
				ID:          "e4",
				FEN:         "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3",
				Move:        &moveE4,
				ColorToMove: models.ChessColorBlack,
			},
		},
	}

	// Search with a FEN that doesn't exist anywhere in the tree
	differentFEN := "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq -"
	result := svc.findNodeInRepertoire(root, differentFEN)

	assert.Nil(t, result)
}

func TestFindNodeInRepertoire_LeafNode(t *testing.T) {
	svc := NewImportService(nil, nil)

	moveE4 := "e4"
	root := models.RepertoireNode{
		ID:          "root",
		FEN:         "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -",
		Move:        nil,
		ColorToMove: models.ChessColorWhite,
		Children: []*models.RepertoireNode{
			{
				ID:          "e4",
				FEN:         "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3",
				Move:        &moveE4,
				ColorToMove: models.ChessColorBlack,
				Children:    nil, // Leaf node
			},
		},
	}

	// Find the leaf node
	fenAfterE4 := "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3"
	result := svc.findNodeInRepertoire(root, fenAfterE4)

	require.NotNil(t, result)
	assert.Equal(t, "e4", result.ID)
	assert.Empty(t, result.Children) // It's a leaf
}

func TestAnalyzeGame_InRepertoire(t *testing.T) {
	svc := NewImportService(nil, nil)

	pgnData := `[Event "Test"]
[White "A"]
[Black "B"]
1. e4 e5 1-0`

	games, err := svc.parsePGN(pgnData)
	require.NoError(t, err)
	require.Len(t, games, 1)

	moveE4 := "e4"
	root := models.RepertoireNode{
		ID:          "root",
		FEN:         "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -",
		Move:        nil,
		ColorToMove: models.ChessColorWhite,
		Children: []*models.RepertoireNode{
			{
				ID:          "e4",
				FEN:         "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3",
				Move:        &moveE4,
				ColorToMove: models.ChessColorBlack,
			},
		},
	}

	analysis := svc.analyzeGame(0, games[0], root, models.ColorWhite)

	assert.Len(t, analysis.Moves, 2)
	assert.Equal(t, "in-repertoire", analysis.Moves[0].Status)
	assert.True(t, analysis.Moves[0].IsUserMove)
}

func TestAnalyzeGame_WithExpectedMove(t *testing.T) {
	svc := NewImportService(nil, nil)

	// Game where user plays d4 but repertoire expects e4
	pgnData := `[Event "Test"]
[White "A"]
[Black "B"]
1. d4 d5 1-0`

	games, err := svc.parsePGN(pgnData)
	require.NoError(t, err)
	require.Len(t, games, 1)

	moveE4 := "e4"
	root := models.RepertoireNode{
		ID:          "root",
		FEN:         "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -",
		Move:        nil,
		ColorToMove: models.ChessColorWhite,
		Children: []*models.RepertoireNode{
			{
				ID:          "e4",
				FEN:         "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3",
				Move:        &moveE4,
				ColorToMove: models.ChessColorBlack,
			},
		},
	}

	analysis := svc.analyzeGame(0, games[0], root, models.ColorWhite)

	assert.Len(t, analysis.Moves, 2)
	assert.Equal(t, "out-of-repertoire", analysis.Moves[0].Status)
	assert.Equal(t, "e4", analysis.Moves[0].ExpectedMove)
}

// TestAnalyzeGame_ExpectedMovePrefersMainLine verifies that the expected move
// surfaced on an out-of-repertoire move follows the explicit IsMainLine child,
// not insertion order, so review never contradicts the user's chosen main line.
func TestAnalyzeGame_ExpectedMovePrefersMainLine(t *testing.T) {
	svc := NewImportService(nil, nil)

	// User plays d4, but the repertoire's main line is e4 (added second).
	pgnData := `[Event "Test"]
[White "A"]
[Black "B"]
1. d4 d5 1-0`

	games, err := svc.parsePGN(pgnData)
	require.NoError(t, err)
	require.Len(t, games, 1)

	moveC4 := "c4"
	moveE4 := "e4"
	root := models.RepertoireNode{
		ID:          "root",
		FEN:         "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -",
		ColorToMove: models.ChessColorWhite,
		Children: []*models.RepertoireNode{
			// First by insertion order, but NOT the main line.
			{
				ID:          "c4",
				FEN:         "rnbqkbnr/pppppppp/8/8/2P5/8/PP1PPPPP/RNBQKBNR b KQkq c3",
				Move:        &moveC4,
				ColorToMove: models.ChessColorBlack,
			},
			// Explicit main line — should be the expected move.
			{
				ID:          "e4",
				FEN:         "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3",
				Move:        &moveE4,
				ColorToMove: models.ChessColorBlack,
				IsMainLine:  true,
			},
		},
	}

	analysis := svc.analyzeGame(0, games[0], root, models.ColorWhite)

	require.GreaterOrEqual(t, len(analysis.Moves), 1)
	assert.Equal(t, "out-of-repertoire", analysis.Moves[0].Status)
	assert.Equal(t, "e4", analysis.Moves[0].ExpectedMove, "expected move should follow IsMainLine, not insertion order")
}

// TestExpectedMoveForNode covers the helper directly across edge cases.
func TestExpectedMoveForNode(t *testing.T) {
	a := "a"
	b := "b"
	c := "c"

	t.Run("nil node", func(t *testing.T) {
		assert.Equal(t, "", expectedMoveForNode(nil))
	})

	t.Run("no children", func(t *testing.T) {
		assert.Equal(t, "", expectedMoveForNode(&models.RepertoireNode{}))
	})

	t.Run("falls back to first child when none is main line", func(t *testing.T) {
		node := &models.RepertoireNode{Children: []*models.RepertoireNode{
			{Move: &a}, {Move: &b},
		}}
		assert.Equal(t, "a", expectedMoveForNode(node))
	})

	t.Run("prefers main line over insertion order", func(t *testing.T) {
		node := &models.RepertoireNode{Children: []*models.RepertoireNode{
			{Move: &a}, {Move: &b, IsMainLine: true}, {Move: &c},
		}}
		assert.Equal(t, "b", expectedMoveForNode(node))
	})

	t.Run("skips children without a move", func(t *testing.T) {
		node := &models.RepertoireNode{Children: []*models.RepertoireNode{
			{Move: nil}, {Move: &b},
		}}
		assert.Equal(t, "b", expectedMoveForNode(node))
	})
}

func TestParsePGN_WithComments(t *testing.T) {
	svc := NewImportService(nil, nil)

	pgnData := `[Event "Test"]
[White "A"]
[Black "B"]
1. e4 {A strong opening move} e5 {Classical response} 1-0`

	games, err := svc.parsePGN(pgnData)

	require.NoError(t, err)
	assert.Len(t, games, 1)
	assert.Len(t, games[0].Moves(), 2)
}

func TestParsePGN_WithVariations(t *testing.T) {
	svc := NewImportService(nil, nil)

	// PGN with alternative lines (variations)
	pgnData := `[Event "Test"]
[White "A"]
[Black "B"]
1. e4 e5 (1... c5 2. Nf3) 2. Nf3 1-0`

	games, err := svc.parsePGN(pgnData)

	require.NoError(t, err)
	// The library should parse the main line
	assert.GreaterOrEqual(t, len(games), 1)
}

func TestParsePGN_FiltersEmptyGames(t *testing.T) {
	svc := NewImportService(nil, nil)

	// PGN with trailing newlines (causes phantom empty games in notnil/chess)
	pgnData := `[Event "Test"]
[White "A"]
[Black "B"]
1. e4 e5 2. Nf3 1-0

`

	games, err := svc.parsePGN(pgnData)

	require.NoError(t, err)
	// Should only have 1 valid game, not 2 (phantom game should be filtered)
	assert.Len(t, games, 1)
	assert.Len(t, games[0].Moves(), 3)
}

func TestParsePGN_MultipleGamesWithTrailingNewlines(t *testing.T) {
	svc := NewImportService(nil, nil)

	// Multiple games from Lichess-style export (ends with trailing newlines)
	// Note: PGN requires Result header and blank line before moves
	pgnData := `[Event "Game 1"]
[White "A"]
[Black "B"]
[Result "0-1"]

1. e4 c6 0-1

[Event "Game 2"]
[White "C"]
[Black "D"]
[Result "1-0"]

1. d4 d5 2. c4 1-0

`

	games, err := svc.parsePGN(pgnData)

	require.NoError(t, err)
	// Should have exactly 2 valid games (phantom empty game should be filtered)
	assert.Len(t, games, 2)
	assert.Len(t, games[0].Moves(), 2)
	assert.Len(t, games[1].Moves(), 3)
}

func TestExtractHeaders_PartialHeaders(t *testing.T) {
	svc := NewImportService(nil, nil)

	pgnData := `[Event "Test Game"]
[White "Player"]
1. e4 1-0`

	games, err := svc.parsePGN(pgnData)
	require.NoError(t, err)
	require.Len(t, games, 1)

	headers := svc.extractHeaders(games[0])

	assert.Equal(t, "Test Game", headers["Event"])
	assert.Equal(t, "Player", headers["White"])
	assert.Equal(t, "Unknown", headers["Black"]) // Default value
}

func TestComputeFingerprint_LichessSite(t *testing.T) {
	headers := models.PGNHeaders{
		"Site":   "https://lichess.org/abcdefgh",
		"White":  "Player1",
		"Black":  "Player2",
		"Date":   "2024.01.01",
		"Result": "1-0",
		"Event":  "Rated Blitz",
	}
	moves := []models.MoveAnalysis{{SAN: "e4"}, {SAN: "e5"}}

	fp := ComputeFingerprint(headers, moves)

	assert.Equal(t, "https://lichess.org/abcdefgh", fp)
}

func TestComputeFingerprint_ChesscomLink(t *testing.T) {
	headers := models.PGNHeaders{
		"Link":   "https://www.chess.com/game/live/12345",
		"White":  "Player1",
		"Black":  "Player2",
		"Date":   "2024.01.01",
		"Result": "1-0",
		"Event":  "Live Chess",
	}
	moves := []models.MoveAnalysis{{SAN: "d4"}, {SAN: "d5"}}

	fp := ComputeFingerprint(headers, moves)

	assert.Equal(t, "https://www.chess.com/game/live/12345", fp)
}

func TestComputeFingerprint_FallbackHash(t *testing.T) {
	headers := models.PGNHeaders{
		"White":  "Player1",
		"Black":  "Player2",
		"Date":   "2024.01.01",
		"Result": "1-0",
		"Event":  "Club Game",
	}
	moves := []models.MoveAnalysis{{SAN: "e4"}, {SAN: "e5"}, {SAN: "Nf3"}}

	fp := ComputeFingerprint(headers, moves)

	assert.True(t, len(fp) > 0)
	assert.Contains(t, fp, "sha256:")
}

func TestComputeFingerprint_DeterministicHash(t *testing.T) {
	headers := models.PGNHeaders{
		"White":  "Player1",
		"Black":  "Player2",
		"Date":   "2024.01.01",
		"Result": "1-0",
		"Event":  "Club Game",
	}
	moves := []models.MoveAnalysis{{SAN: "e4"}, {SAN: "e5"}}

	fp1 := ComputeFingerprint(headers, moves)
	fp2 := ComputeFingerprint(headers, moves)

	assert.Equal(t, fp1, fp2)
}

func TestComputeFingerprint_DifferentGamesProduceDifferentHashes(t *testing.T) {
	headers1 := models.PGNHeaders{
		"White": "Player1", "Black": "Player2",
		"Date": "2024.01.01", "Result": "1-0", "Event": "Game1",
	}
	headers2 := models.PGNHeaders{
		"White": "Player1", "Black": "Player2",
		"Date": "2024.01.02", "Result": "0-1", "Event": "Game2",
	}
	moves := []models.MoveAnalysis{{SAN: "e4"}, {SAN: "e5"}}

	fp1 := ComputeFingerprint(headers1, moves)
	fp2 := ComputeFingerprint(headers2, moves)

	assert.NotEqual(t, fp1, fp2)
}

func TestComputeFingerprint_LimitsMoves(t *testing.T) {
	headers := models.PGNHeaders{
		"White": "A", "Black": "B", "Date": "2024.01.01",
		"Result": "1-0", "Event": "Test",
	}
	// Create 20 moves
	moves := make([]models.MoveAnalysis, 20)
	for i := range moves {
		moves[i] = models.MoveAnalysis{SAN: "e4"}
	}

	// Should not panic with more than 10 moves
	fp := ComputeFingerprint(headers, moves)
	assert.Contains(t, fp, "sha256:")
}

func TestComputeFingerprint_FewMoves(t *testing.T) {
	headers := models.PGNHeaders{
		"White": "A", "Black": "B", "Date": "2024.01.01",
		"Result": "1-0", "Event": "Test",
	}
	moves := []models.MoveAnalysis{{SAN: "e4"}}

	fp := ComputeFingerprint(headers, moves)
	assert.Contains(t, fp, "sha256:")
}

func TestComputeFingerprint_LichessSitePriority(t *testing.T) {
	// When both Site (lichess) and Link (chess.com) are present, Site wins
	headers := models.PGNHeaders{
		"Site":  "https://lichess.org/abcdefgh",
		"Link":  "https://www.chess.com/game/live/12345",
		"White": "A", "Black": "B",
	}
	moves := []models.MoveAnalysis{{SAN: "e4"}}

	fp := ComputeFingerprint(headers, moves)

	assert.Equal(t, "https://lichess.org/abcdefgh", fp)
}

// --- In-batch deduplication tests ---

// TestParseAndAnalyze_InBatchDuplicate verifies that a PGN containing the same
// game twice within a single import is persisted only once (issue #121).
func TestParseAndAnalyze_InBatchDuplicate(t *testing.T) {
	// No repertoires for either color -> games are analyzed with an empty tree.
	repertoireRepo := &mocks.MockRepertoireRepo{
		GetByColorFunc: func(userID string, color models.Color) ([]models.Repertoire, error) {
			return nil, nil
		},
	}
	repertoireSvc := NewRepertoireService(repertoireRepo)

	// CheckExisting returns no already-persisted games (empty DB).
	fingerprintRepo := &mocks.MockFingerprintRepo{}

	var savedResults []models.GameAnalysis
	var savedGameCount int
	analysisRepo := &mocks.MockAnalysisRepo{
		SaveFunc: func(userID, username, filename string, gameCount int, results []models.GameAnalysis) (*models.AnalysisSummary, error) {
			savedGameCount = gameCount
			savedResults = results
			return &models.AnalysisSummary{ID: "analysis-1", GameCount: gameCount}, nil
		},
	}

	var savedEntries []repository.FingerprintEntry
	fingerprintRepo.SaveBatchFunc = func(userID, analysisID string, entries []repository.FingerprintEntry) error {
		savedEntries = entries
		return nil
	}

	svc := NewImportService(repertoireSvc, analysisRepo, WithFingerprintRepo(fingerprintRepo))

	// The exact same game appears twice in the same upload (e.g. concatenated PGNs).
	game := `[Event "Test"]
[White "Hero"]
[Black "Villain"]
[Date "2024.01.01"]
[Result "1-0"]

1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 1-0`
	pgnData := game + "\n\n" + game

	summary, results, err := svc.ParseAndAnalyze("dup.pgn", "Hero", "user-1", pgnData)

	require.NoError(t, err)
	require.NotNil(t, summary)

	// Only one game persisted despite two identical games in the batch.
	assert.Len(t, results, 1, "duplicate in-batch game should be filtered out")
	assert.Len(t, savedResults, 1, "analysis Save must receive exactly one game")
	assert.Equal(t, 1, savedGameCount, "persisted game count must be 1")
	assert.Equal(t, 1, summary.GameCount)
	assert.Equal(t, 1, summary.SkippedDuplicates, "the in-batch duplicate must be counted as skipped")

	// Only one fingerprint row is written.
	assert.Len(t, savedEntries, 1, "exactly one fingerprint entry should be saved")
}

// TestParseAndAnalyze_NoFingerprintRepo verifies behavior is unchanged (no
// dedup) when the fingerprint repository is not configured.
func TestParseAndAnalyze_NoFingerprintRepo(t *testing.T) {
	repertoireRepo := &mocks.MockRepertoireRepo{
		GetByColorFunc: func(userID string, color models.Color) ([]models.Repertoire, error) {
			return nil, nil
		},
	}
	repertoireSvc := NewRepertoireService(repertoireRepo)

	var savedGameCount int
	analysisRepo := &mocks.MockAnalysisRepo{
		SaveFunc: func(userID, username, filename string, gameCount int, results []models.GameAnalysis) (*models.AnalysisSummary, error) {
			savedGameCount = gameCount
			return &models.AnalysisSummary{ID: "analysis-1", GameCount: gameCount}, nil
		},
	}

	svc := NewImportService(repertoireSvc, analysisRepo)

	game := `[Event "Test"]
[White "Hero"]
[Black "Villain"]
[Date "2024.01.01"]
[Result "1-0"]

1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 1-0`
	pgnData := game + "\n\n" + game

	summary, results, err := svc.ParseAndAnalyze("dup.pgn", "Hero", "user-1", pgnData)

	require.NoError(t, err)
	require.NotNil(t, summary)
	// Without a fingerprint repo there is no dedup, so both games are kept.
	assert.Len(t, results, 2)
	assert.Equal(t, 2, savedGameCount)
}

// --- GetInsights tests ---

func makeRawAnalysis(id, filename string, uploadedAt time.Time, games []models.GameAnalysis) models.RawAnalysis {
	return models.RawAnalysis{
		ID:         id,
		Filename:   filename,
		Results:    games,
		UploadedAt: uploadedAt,
	}
}

func makeGameAnalysis(gameIndex int, headers models.PGNHeaders, moves []models.MoveAnalysis, userColor models.Color, repertoire *models.RepertoireRef) models.GameAnalysis {
	return models.GameAnalysis{
		GameIndex:         gameIndex,
		Headers:           headers,
		Moves:             moves,
		UserColor:         userColor,
		MatchedRepertoire: repertoire,
	}
}

func TestGetInsights_NoEngineService(t *testing.T) {
	// Without engine service, GetInsights returns empty with engineAnalysisDone=true
	svc := NewImportService(nil, nil)
	insights, err := svc.GetInsights("user-1")

	require.NoError(t, err)
	assert.NotNil(t, insights)
	assert.Empty(t, insights.WorstMistakes)
	assert.True(t, insights.EngineAnalysisDone)
}

func TestGetInsights_WithExplorerStats(t *testing.T) {
	now := time.Now()

	gameMoves := []models.MoveAnalysis{
		{PlyNumber: 0, SAN: "d4", FEN: "startFEN w KQkq -", Status: "in-repertoire", IsUserMove: true},
		{PlyNumber: 1, SAN: "d5", FEN: "afterD4 b KQkq -", Status: "in-repertoire", IsUserMove: false},
		{PlyNumber: 2, SAN: "c4", FEN: "afterD5 w KQkq -", Status: "in-repertoire", IsUserMove: true},
		{PlyNumber: 3, SAN: "e6", FEN: "afterC4 b KQkq -", Status: "in-repertoire", IsUserMove: false},
		{PlyNumber: 4, SAN: "Bf4", FEN: "afterE6 w KQkq -", Status: "out-of-repertoire", IsUserMove: true},
		{PlyNumber: 5, SAN: "Nf6", FEN: "afterBf4 b KQkq -", Status: "in-repertoire", IsUserMove: false},
	}

	analyses := []models.RawAnalysis{
		makeRawAnalysis("a1", "lichess_user.pgn", now, []models.GameAnalysis{
			makeGameAnalysis(0, models.PGNHeaders{"White": "A", "Black": "B", "Result": "1-0", "Date": "2024.01.01"}, gameMoves, models.ColorWhite, nil),
		}),
	}

	// Explorer stats: user played Bf4 at ply 4, best was Nc3
	// Bf4 winrate = 0.48, Nc3 winrate = 0.56, drop = 0.08 (8%)
	engineEvals := []models.EngineEval{
		{
			ID: "ee1", UserID: "user-1", AnalysisID: "a1", GameIndex: 0, Status: "done",
			Evals: []models.ExplorerMoveStats{
				{PlyNumber: 0, FEN: "startFEN w KQkq -", PlayedMove: "d4", PlayedWinrate: 0.55, BestMove: "e4", BestWinrate: 0.55, WinrateDrop: 0.0, TotalGames: 1000},
				{PlyNumber: 4, FEN: "afterE6 w KQkq -", PlayedMove: "Bf4", PlayedWinrate: 0.48, BestMove: "Nc3", BestWinrate: 0.56, WinrateDrop: 0.08, TotalGames: 500},
			},
		},
	}

	mockAnalysisRepo := &mocks.MockAnalysisRepo{
		GetAllGamesRawFunc: func(userID string) ([]models.RawAnalysis, error) {
			return analyses, nil
		},
	}

	mockEvalRepo := &mocks.MockEngineEvalRepo{
		GetByUserFunc: func(userID string) ([]models.EngineEval, error) {
			return engineEvals, nil
		},
	}

	engineSvc := NewEngineService(mockEvalRepo, mockAnalysisRepo, nil)
	svc := NewImportService(nil, mockAnalysisRepo, WithEngineService(engineSvc))

	insights, err := svc.GetInsights("user-1")

	require.NoError(t, err)
	assert.True(t, insights.EngineAnalysisDone)
	assert.Equal(t, 1, insights.EngineAnalysisTotal)
	assert.Equal(t, 1, insights.EngineAnalysisCompleted)
	// Single-occurrence mistakes are filtered out (need freq >= 2)
	assert.Len(t, insights.WorstMistakes, 0)
}

func TestGetInsights_RecurringMistake(t *testing.T) {
	now := time.Now()

	gameMoves := []models.MoveAnalysis{
		{PlyNumber: 0, SAN: "d4", FEN: "startFEN w KQkq -", Status: "in-repertoire", IsUserMove: true},
		{PlyNumber: 4, SAN: "Bf4", FEN: "afterE6 w KQkq -", Status: "out-of-repertoire", IsUserMove: true},
	}

	analyses := []models.RawAnalysis{
		makeRawAnalysis("a1", "game1.pgn", now, []models.GameAnalysis{
			makeGameAnalysis(0, models.PGNHeaders{"White": "A", "Black": "B", "Result": "1-0", "Date": "2024.01.01"}, gameMoves, models.ColorWhite, nil),
		}),
		makeRawAnalysis("a2", "game2.pgn", now, []models.GameAnalysis{
			makeGameAnalysis(0, models.PGNHeaders{"White": "A", "Black": "C", "Result": "0-1", "Date": "2024.01.02"}, gameMoves, models.ColorWhite, nil),
		}),
	}

	// Same mistake in two different games
	engineEvals := []models.EngineEval{
		{
			ID: "ee1", UserID: "user-1", AnalysisID: "a1", GameIndex: 0, Status: "done",
			Evals: []models.ExplorerMoveStats{
				{PlyNumber: 4, FEN: "afterE6 w KQkq -", PlayedMove: "Bf4", PlayedWinrate: 0.48, BestMove: "Nc3", BestWinrate: 0.56, WinrateDrop: 0.08, TotalGames: 500},
			},
		},
		{
			ID: "ee2", UserID: "user-1", AnalysisID: "a2", GameIndex: 0, Status: "done",
			Evals: []models.ExplorerMoveStats{
				{PlyNumber: 4, FEN: "afterE6 w KQkq -", PlayedMove: "Bf4", PlayedWinrate: 0.48, BestMove: "Nc3", BestWinrate: 0.56, WinrateDrop: 0.08, TotalGames: 500},
			},
		},
	}

	mockAnalysisRepo := &mocks.MockAnalysisRepo{
		GetAllGamesRawFunc: func(userID string) ([]models.RawAnalysis, error) {
			return analyses, nil
		},
	}

	mockEvalRepo := &mocks.MockEngineEvalRepo{
		GetByUserFunc: func(userID string) ([]models.EngineEval, error) {
			return engineEvals, nil
		},
	}

	engineSvc := NewEngineService(mockEvalRepo, mockAnalysisRepo, nil)
	svc := NewImportService(nil, mockAnalysisRepo, WithEngineService(engineSvc))

	insights, err := svc.GetInsights("user-1")

	require.NoError(t, err)
	assert.Len(t, insights.WorstMistakes, 1)
	assert.Equal(t, "Bf4", insights.WorstMistakes[0].PlayedMove)
	assert.Equal(t, "Nc3", insights.WorstMistakes[0].BestMove)
	assert.InDelta(t, 0.08, insights.WorstMistakes[0].WinrateDrop, 0.001)
	assert.Equal(t, 2, insights.WorstMistakes[0].Frequency)
	assert.Len(t, insights.WorstMistakes[0].Games, 2)
}

func TestGetInsights_Empty(t *testing.T) {
	mockAnalysisRepo := &mocks.MockAnalysisRepo{
		GetAllGamesRawFunc: func(userID string) ([]models.RawAnalysis, error) {
			return nil, nil
		},
	}
	mockEvalRepo := &mocks.MockEngineEvalRepo{
		GetByUserFunc: func(userID string) ([]models.EngineEval, error) {
			return nil, nil
		},
	}

	engineSvc := NewEngineService(mockEvalRepo, mockAnalysisRepo, nil)
	svc := NewImportService(nil, mockAnalysisRepo, WithEngineService(engineSvc))
	insights, err := svc.GetInsights("user-1")

	require.NoError(t, err)
	assert.NotNil(t, insights)
	assert.Empty(t, insights.WorstMistakes)
	assert.True(t, insights.EngineAnalysisDone)
}

func TestAnalyzeGame_RepertoireExhaustion(t *testing.T) {
	// Game follows all prep, tree runs out, remaining moves are "out-of-book"
	svc := NewImportService(nil, nil)

	pgnData := `[Event "Test"]
[White "A"]
[Black "B"]
1. e4 e5 2. Nf3 Nc6 1-0`

	games, err := svc.parsePGN(pgnData)
	require.NoError(t, err)
	require.Len(t, games, 1)

	// Repertoire covers: root -> e4 -> e5 (leaf)
	// So after e4 e5, the tree ends. Nf3 and Nc6 should be "out-of-book".
	moveE4 := "e4"
	moveE5 := "e5"
	root := models.RepertoireNode{
		ID:          "root",
		FEN:         "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -",
		Move:        nil,
		ColorToMove: models.ChessColorWhite,
		Children: []*models.RepertoireNode{
			{
				ID:          "e4",
				FEN:         "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3",
				Move:        &moveE4,
				ColorToMove: models.ChessColorBlack,
				Children: []*models.RepertoireNode{
					{
						ID:          "e5",
						FEN:         "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6",
						Move:        &moveE5,
						ColorToMove: models.ChessColorWhite,
						// No children — tree ends here
					},
				},
			},
		},
	}

	analysis := svc.analyzeGame(0, games[0], root, models.ColorWhite)

	require.Len(t, analysis.Moves, 4)
	// Move 0 (e4): root has child e4 → in-repertoire
	assert.Equal(t, "in-repertoire", analysis.Moves[0].Status)
	// Move 1 (e5): e4-node has child e5 → in-repertoire
	assert.Equal(t, "in-repertoire", analysis.Moves[1].Status)
	// Move 2 (Nf3): e5-node is a leaf (no children) → out-of-book
	assert.Equal(t, "out-of-book", analysis.Moves[2].Status)
	// Move 3 (Nc6): position not in tree → out-of-book
	assert.Equal(t, "out-of-book", analysis.Moves[3].Status)

	// Game status should be "ok" because there are no deviations
	analysis.MatchedRepertoire = &models.RepertoireRef{ID: "rep-1", Name: "Test"}
	status := gameStatusFromGame(analysis)
	assert.Equal(t, "in-repertoire", status)
}

func TestAnalyzeGame_TrueDeviation(t *testing.T) {
	// Game deviates where tree has children — true error
	svc := NewImportService(nil, nil)

	// User plays 1. d4 instead of the repertoire's 1. e4
	pgnData := `[Event "Test"]
[White "A"]
[Black "B"]
1. d4 d5 1-0`

	games, err := svc.parsePGN(pgnData)
	require.NoError(t, err)
	require.Len(t, games, 1)

	moveE4 := "e4"
	moveE5 := "e5"
	root := models.RepertoireNode{
		ID:          "root",
		FEN:         "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -",
		Move:        nil,
		ColorToMove: models.ChessColorWhite,
		Children: []*models.RepertoireNode{
			{
				ID:          "e4",
				FEN:         "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3",
				Move:        &moveE4,
				ColorToMove: models.ChessColorBlack,
				Children: []*models.RepertoireNode{
					{
						ID:   "e5",
						FEN:  "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6",
						Move: &moveE5,
					},
				},
			},
		},
	}

	analysis := svc.analyzeGame(0, games[0], root, models.ColorWhite)

	require.Len(t, analysis.Moves, 2)
	// Move 0 (d4): root has children but d4 not among them → out-of-repertoire
	assert.Equal(t, "out-of-repertoire", analysis.Moves[0].Status)
	assert.Equal(t, "e4", analysis.Moves[0].ExpectedMove)
	// Move 1 (d5): position after d4 not in tree → out-of-book
	assert.Equal(t, "out-of-book", analysis.Moves[1].Status)

	// Game status should be "error" because of the out-of-repertoire move
	analysis.MatchedRepertoire = &models.RepertoireRef{ID: "rep-1", Name: "Test"}
	status := gameStatusFromGame(analysis)
	assert.Equal(t, "error", status)
}

func TestGameStatusFromGame_IgnoresOutOfBook(t *testing.T) {
	// Verify that gameStatusFromGame treats "out-of-book" as benign
	game := models.GameAnalysis{
		MatchedRepertoire: &models.RepertoireRef{ID: "rep-1", Name: "Test"},
		Moves: []models.MoveAnalysis{
			{Status: "in-repertoire"},
			{Status: "in-repertoire"},
			{Status: "out-of-book"},
			{Status: "out-of-book"},
		},
	}

	status := gameStatusFromGame(game)
	assert.Equal(t, "in-repertoire", status)
}

func TestGameStatusFromGame_OutOfRepertoireIsError(t *testing.T) {
	game := models.GameAnalysis{
		MatchedRepertoire: &models.RepertoireRef{ID: "rep-1", Name: "Test"},
		Moves: []models.MoveAnalysis{
			{Status: "in-repertoire"},
			{Status: "out-of-repertoire"},
			{Status: "out-of-book"},
		},
	}

	status := gameStatusFromGame(game)
	assert.Equal(t, "error", status)
}

func TestGameStatusFromGame_OpponentNewIsNewLine(t *testing.T) {
	game := models.GameAnalysis{
		MatchedRepertoire: &models.RepertoireRef{ID: "rep-1", Name: "Test"},
		Moves: []models.MoveAnalysis{
			{Status: "in-repertoire"},
			{Status: "opponent-new"},
			{Status: "out-of-book"},
		},
	}

	status := gameStatusFromGame(game)
	assert.Equal(t, "new-line", status)
}

func TestGameStatusFromGame_NewOpening(t *testing.T) {
	// No matched repertoire → "new-opening"
	game := models.GameAnalysis{
		MatchedRepertoire: nil,
		Moves: []models.MoveAnalysis{
			{Status: "out-of-book"},
			{Status: "out-of-book"},
		},
	}

	status := gameStatusFromGame(game)
	assert.Equal(t, "new-opening", status)
}

// --- ReanalyzeAllGames tests ---

func TestReanalyzeAllGames_Basic(t *testing.T) {
	moveE4 := "e4"
	moveE5 := "e5"
	whiteRepertoire := models.Repertoire{
		ID:    "rep-w",
		Name:  "White Rep",
		Color: models.ColorWhite,
		TreeData: models.RepertoireNode{
			ID:  "root",
			FEN: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -",
			Children: []*models.RepertoireNode{
				{
					ID:   "e4",
					FEN:  "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3",
					Move: &moveE4,
					Children: []*models.RepertoireNode{
						{
							ID:   "e5",
							FEN:  "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6",
							Move: &moveE5,
						},
					},
				},
			},
		},
	}

	analyses := []models.RawAnalysis{
		{
			ID: "a1",
			Results: []models.GameAnalysis{
				{
					GameIndex: 0,
					UserColor: models.ColorWhite,
					Headers:   models.PGNHeaders{"White": "User", "Black": "Opp", "Result": "1-0"},
					Moves: []models.MoveAnalysis{
						{PlyNumber: 0, SAN: "e4", FEN: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -", IsUserMove: true, Status: "out-of-book"},
						{PlyNumber: 1, SAN: "e5", FEN: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3", IsUserMove: false, Status: "out-of-book"},
					},
				},
			},
		},
	}

	var updatedResults []models.GameAnalysis
	mockAnalysisRepo := &mocks.MockAnalysisRepo{
		GetAllGamesRawFunc: func(userID string) ([]models.RawAnalysis, error) {
			return analyses, nil
		},
		UpdateResultsFunc: func(analysisID string, results []models.GameAnalysis) error {
			updatedResults = results
			return nil
		},
	}

	mockRepRepo := &mocks.MockRepertoireRepo{
		GetByColorFunc: func(userID string, color models.Color) ([]models.Repertoire, error) {
			if color == models.ColorWhite {
				return []models.Repertoire{whiteRepertoire}, nil
			}
			return nil, nil
		},
	}

	repSvc := NewRepertoireService(mockRepRepo)
	svc := NewImportService(repSvc, mockAnalysisRepo)

	count, err := svc.ReanalyzeAllGames("user-1", false)

	require.NoError(t, err)
	assert.Equal(t, 1, count)
	require.Len(t, updatedResults, 1)
	assert.Equal(t, "in-repertoire", updatedResults[0].Moves[0].Status) // e4 is in repertoire
	assert.Equal(t, "in-repertoire", updatedResults[0].Moves[1].Status) // e5 is in repertoire
	assert.NotNil(t, updatedResults[0].MatchedRepertoire)
	assert.Equal(t, "rep-w", updatedResults[0].MatchedRepertoire.ID)
	assert.Equal(t, 1, updatedResults[0].MatchScore) // 1 user move matched (e4)
}

func TestReanalyzeAllGames_SharesIndexAcrossManyGames(t *testing.T) {
	// Re-analysing several games against the same repertoire must produce identical
	// results to the single-game path, confirming the shared per-repertoire FEN index
	// is reused correctly rather than rebuilt or skewed across games.
	moveE4 := "e4"
	moveE5 := "e5"
	startFEN := "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -"
	afterE4 := "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3"
	afterE5 := "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6"

	whiteRepertoire := models.Repertoire{
		ID: "rep-w", Name: "White Rep", Color: models.ColorWhite,
		TreeData: models.RepertoireNode{
			ID: "root", FEN: startFEN,
			Children: []*models.RepertoireNode{
				{ID: "e4", FEN: afterE4, Move: &moveE4, Children: []*models.RepertoireNode{
					{ID: "e5", FEN: afterE5, Move: &moveE5},
				}},
			},
		},
	}

	makeGame := func(idx int) models.GameAnalysis {
		return models.GameAnalysis{
			GameIndex: idx,
			UserColor: models.ColorWhite,
			Headers:   models.PGNHeaders{"White": "User", "Black": "Opp", "Result": "1-0"},
			Moves: []models.MoveAnalysis{
				{PlyNumber: 0, SAN: "e4", FEN: startFEN, IsUserMove: true, Status: "out-of-book"},
				{PlyNumber: 1, SAN: "e5", FEN: afterE4, IsUserMove: false, Status: "out-of-book"},
			},
		}
	}

	analyses := []models.RawAnalysis{
		{ID: "a1", Results: []models.GameAnalysis{makeGame(0), makeGame(1), makeGame(2)}},
	}

	var updatedResults []models.GameAnalysis
	mockAnalysisRepo := &mocks.MockAnalysisRepo{
		GetAllGamesRawFunc: func(userID string) ([]models.RawAnalysis, error) { return analyses, nil },
		UpdateResultsFunc: func(analysisID string, results []models.GameAnalysis) error {
			updatedResults = results
			return nil
		},
	}
	mockRepRepo := &mocks.MockRepertoireRepo{
		GetByColorFunc: func(userID string, color models.Color) ([]models.Repertoire, error) {
			if color == models.ColorWhite {
				return []models.Repertoire{whiteRepertoire}, nil
			}
			return nil, nil
		},
	}

	svc := NewImportService(NewRepertoireService(mockRepRepo), mockAnalysisRepo)

	count, err := svc.ReanalyzeAllGames("user-1", false)

	require.NoError(t, err)
	assert.Equal(t, 3, count)
	require.Len(t, updatedResults, 3)
	for i := range updatedResults {
		assert.Equal(t, "in-repertoire", updatedResults[i].Moves[0].Status, "game %d move e4", i)
		assert.Equal(t, "in-repertoire", updatedResults[i].Moves[1].Status, "game %d move e5", i)
		require.NotNil(t, updatedResults[i].MatchedRepertoire)
		assert.Equal(t, "rep-w", updatedResults[i].MatchedRepertoire.ID)
		assert.Equal(t, 1, updatedResults[i].MatchScore)
	}
}

func TestReanalyzeAllGames_NoRepertoires(t *testing.T) {
	analyses := []models.RawAnalysis{
		{
			ID: "a1",
			Results: []models.GameAnalysis{
				{
					GameIndex: 0,
					UserColor: models.ColorWhite,
					Headers:   models.PGNHeaders{"White": "User", "Black": "Opp", "Result": "1-0"},
					Moves: []models.MoveAnalysis{
						{PlyNumber: 0, SAN: "e4", FEN: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -", IsUserMove: true, Status: "in-repertoire"},
					},
					MatchedRepertoire: &models.RepertoireRef{ID: "old-rep", Name: "Old"},
					MatchScore:        1,
				},
			},
		},
	}

	var updatedResults []models.GameAnalysis
	mockAnalysisRepo := &mocks.MockAnalysisRepo{
		GetAllGamesRawFunc: func(userID string) ([]models.RawAnalysis, error) {
			return analyses, nil
		},
		UpdateResultsFunc: func(analysisID string, results []models.GameAnalysis) error {
			updatedResults = results
			return nil
		},
	}

	mockRepRepo := &mocks.MockRepertoireRepo{
		GetByColorFunc: func(userID string, color models.Color) ([]models.Repertoire, error) {
			return nil, nil
		},
	}

	repSvc := NewRepertoireService(mockRepRepo)
	svc := NewImportService(repSvc, mockAnalysisRepo)

	count, err := svc.ReanalyzeAllGames("user-1", false)

	require.NoError(t, err)
	assert.Equal(t, 1, count)
	require.Len(t, updatedResults, 1)
	assert.Nil(t, updatedResults[0].MatchedRepertoire)
	assert.Equal(t, 0, updatedResults[0].MatchScore)
	assert.Equal(t, "out-of-book", updatedResults[0].Moves[0].Status)
}

func TestReanalyzeAllGames_EmptyAnalyses(t *testing.T) {
	mockAnalysisRepo := &mocks.MockAnalysisRepo{
		GetAllGamesRawFunc: func(userID string) ([]models.RawAnalysis, error) {
			return nil, nil
		},
	}

	mockRepRepo := &mocks.MockRepertoireRepo{
		GetByColorFunc: func(userID string, color models.Color) ([]models.Repertoire, error) {
			return nil, nil
		},
	}

	repSvc := NewRepertoireService(mockRepRepo)
	svc := NewImportService(repSvc, mockAnalysisRepo)

	count, err := svc.ReanalyzeAllGames("user-1", false)

	require.NoError(t, err)
	assert.Equal(t, 0, count)
}

// TestReanalyzeAllGames_PreserveAnalysed verifies that auto re-analysis
// (preserveAnalysed=true) does not retroactively flag a previously non-error game as an
// opening error, while manual re-analysis (preserveAnalysed=false) still re-tags it.
func TestReanalyzeAllGames_PreserveAnalysed(t *testing.T) {
	const (
		fenStart = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -"
		fenE4    = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3"
		fenE5    = "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6"
		fenNf3   = "rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq -"
	)
	moveE4, moveE5, moveNf3 := "e4", "e5", "Nf3"

	// Repertoire expects 1.e4 e5 2.Nf3. The user played 2.a3, which deviates — but this
	// prep was added after the game was played.
	whiteRepertoire := models.Repertoire{
		ID:    "rep-w",
		Name:  "White Rep",
		Color: models.ColorWhite,
		TreeData: models.RepertoireNode{
			ID:  "root",
			FEN: fenStart,
			Children: []*models.RepertoireNode{
				{
					ID:   "e4",
					FEN:  fenE4,
					Move: &moveE4,
					Children: []*models.RepertoireNode{
						{
							ID:   "e5",
							FEN:  fenE5,
							Move: &moveE5,
							Children: []*models.RepertoireNode{
								{ID: "nf3", FEN: fenNf3, Move: &moveNf3},
							},
						},
					},
				},
			},
		},
	}

	// Stored analysis: the game was never flagged as an error (no matched repertoire yet).
	freshAnalyses := func() []models.RawAnalysis {
		return []models.RawAnalysis{
			{
				ID: "a1",
				Results: []models.GameAnalysis{
					{
						GameIndex: 0,
						UserColor: models.ColorWhite,
						Headers:   models.PGNHeaders{"White": "User", "Black": "Opp", "Result": "1-0"},
						Moves: []models.MoveAnalysis{
							{PlyNumber: 0, SAN: "e4", FEN: fenStart, IsUserMove: true, Status: "out-of-book"},
							{PlyNumber: 1, SAN: "e5", FEN: fenE4, IsUserMove: false, Status: "out-of-book"},
							{PlyNumber: 2, SAN: "a3", FEN: fenE5, IsUserMove: true, Status: "out-of-book"},
						},
					},
				},
			},
		}
	}

	run := func(preserveAnalysed bool) (updated bool, results []models.GameAnalysis) {
		mockAnalysisRepo := &mocks.MockAnalysisRepo{
			GetAllGamesRawFunc: func(userID string) ([]models.RawAnalysis, error) {
				return freshAnalyses(), nil
			},
			UpdateResultsFunc: func(analysisID string, r []models.GameAnalysis) error {
				updated = true
				results = r
				return nil
			},
		}
		mockRepRepo := &mocks.MockRepertoireRepo{
			GetByColorFunc: func(userID string, color models.Color) ([]models.Repertoire, error) {
				if color == models.ColorWhite {
					return []models.Repertoire{whiteRepertoire}, nil
				}
				return nil, nil
			},
		}
		svc := NewImportService(NewRepertoireService(mockRepRepo), mockAnalysisRepo)
		_, err := svc.ReanalyzeAllGames("user-1", preserveAnalysed)
		require.NoError(t, err)
		return updated, results
	}

	t.Run("auto preserve does not retag", func(t *testing.T) {
		updated, _ := run(true)
		assert.False(t, updated, "preserved game should not be written back as an error")
	})

	t.Run("manual reanalysis retags", func(t *testing.T) {
		updated, results := run(false)
		require.True(t, updated)
		require.Len(t, results, 1)
		assert.Equal(t, "out-of-repertoire", results[0].Moves[2].Status)
		assert.Equal(t, "error", gameStatusFromGame(results[0]))
	})
}

func TestFindBestMatchingRepertoireFromStored(t *testing.T) {
	svc := NewImportService(nil, nil)

	moveE4 := "e4"
	moveD4 := "d4"
	moveE5 := "e5"

	// Repertoire A: e4 only (1 match for e4 game)
	repA := models.Repertoire{
		ID: "rep-a", Name: "e4 Rep",
		TreeData: models.RepertoireNode{
			FEN: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -",
			Children: []*models.RepertoireNode{
				{FEN: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3", Move: &moveE4},
			},
		},
	}

	// Repertoire B: e4 + e5 response (still 1 user match for e4 game, but also covers e5)
	repB := models.Repertoire{
		ID: "rep-b", Name: "Full Rep",
		TreeData: models.RepertoireNode{
			FEN: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -",
			Children: []*models.RepertoireNode{
				{
					FEN:  "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3",
					Move: &moveE4,
					Children: []*models.RepertoireNode{
						{FEN: "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6", Move: &moveE5},
					},
				},
			},
		},
	}

	// Repertoire C: d4 only (0 matches for an e4 game)
	repC := models.Repertoire{
		ID: "rep-c", Name: "d4 Rep",
		TreeData: models.RepertoireNode{
			FEN: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -",
			Children: []*models.RepertoireNode{
				{FEN: "rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq d3", Move: &moveD4},
			},
		},
	}

	game := &models.GameAnalysis{
		UserColor: models.ColorWhite,
		Moves: []models.MoveAnalysis{
			{SAN: "e4", FEN: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -", IsUserMove: true},
			{SAN: "e5", FEN: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3", IsUserMove: false},
		},
	}

	best, score := svc.findBestMatchingRepertoireFromStored(game, indexRepertoires([]models.Repertoire{repA, repB, repC}))

	require.NotNil(t, best)
	// repA and repB both match 1 user move (e4), repA wins by order
	assert.Equal(t, "rep-a", best.repertoire.ID)
	assert.Equal(t, 1, score)
}

func TestCountMatchingMoves_RejectsUnknownOpponentFirstMove_Black(t *testing.T) {
	// Black repertoire covers 1.e4, game starts with 1.d4 → reject
	svc := NewImportService(nil, nil)

	pgnData := `[Event "Test"]
[White "Opp"]
[Black "User"]
1. d4 d5 1-0`

	games, err := svc.parsePGN(pgnData)
	require.NoError(t, err)
	require.Len(t, games, 1)

	moveE4 := "e4"
	moveE5 := "e5"
	root := models.RepertoireNode{
		ID:  "root",
		FEN: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -",
		Children: []*models.RepertoireNode{
			{
				ID:   "e4",
				FEN:  "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3",
				Move: &moveE4,
				Children: []*models.RepertoireNode{
					{
						ID:   "e5",
						FEN:  "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6",
						Move: &moveE5,
					},
				},
			},
		},
	}

	score := svc.countMatchingMoves(games[0], root, models.ColorBlack)
	assert.Equal(t, -1, score, "should reject when opponent's first move (1.d4) is not in black repertoire covering 1.e4")
}

func TestCountMatchingMoves_AcceptsKnownOpponentFirstMove_Black(t *testing.T) {
	// Black repertoire covers 1.e4, game starts with 1.e4 → accept
	svc := NewImportService(nil, nil)

	pgnData := `[Event "Test"]
[White "Opp"]
[Black "User"]
1. e4 e5 1-0`

	games, err := svc.parsePGN(pgnData)
	require.NoError(t, err)
	require.Len(t, games, 1)

	moveE4 := "e4"
	moveE5 := "e5"
	root := models.RepertoireNode{
		ID:  "root",
		FEN: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -",
		Children: []*models.RepertoireNode{
			{
				ID:   "e4",
				FEN:  "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3",
				Move: &moveE4,
				Children: []*models.RepertoireNode{
					{
						ID:   "e5",
						FEN:  "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6",
						Move: &moveE5,
					},
				},
			},
		},
	}

	score := svc.countMatchingMoves(games[0], root, models.ColorBlack)
	assert.Equal(t, 1, score, "should accept and count 1 matching user move (e5)")
}

func TestCountMatchingMoves_RejectsUnknownOpponentFirstMove_White(t *testing.T) {
	// White repertoire covers 1.e4 e5, game has 1.e4 c5 → reject (c5 not in repertoire)
	svc := NewImportService(nil, nil)

	pgnData := `[Event "Test"]
[White "User"]
[Black "Opp"]
1. e4 c5 2. Nf3 d6 1-0`

	games, err := svc.parsePGN(pgnData)
	require.NoError(t, err)
	require.Len(t, games, 1)

	moveE4 := "e4"
	moveE5 := "e5"
	root := models.RepertoireNode{
		ID:  "root",
		FEN: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -",
		Children: []*models.RepertoireNode{
			{
				ID:   "e4",
				FEN:  "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3",
				Move: &moveE4,
				Children: []*models.RepertoireNode{
					{
						ID:   "e5",
						FEN:  "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6",
						Move: &moveE5,
					},
				},
			},
		},
	}

	score := svc.countMatchingMoves(games[0], root, models.ColorWhite)
	assert.Equal(t, -1, score, "should reject when opponent's first response (1...c5) is not in white repertoire covering 1.e4 e5")
}

func TestFindBestMatchingRepertoireFromStored_RejectsAllUnmatched(t *testing.T) {
	// All repertoires reject the opponent's first move → nil result
	svc := NewImportService(nil, nil)

	moveE4 := "e4"
	moveE5 := "e5"

	repA := models.Repertoire{
		ID: "rep-e4", Name: "e4 Rep",
		Color: models.ColorBlack,
		TreeData: models.RepertoireNode{
			FEN: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -",
			Children: []*models.RepertoireNode{
				{
					FEN:  "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3",
					Move: &moveE4,
					Children: []*models.RepertoireNode{
						{FEN: "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6", Move: &moveE5},
					},
				},
			},
		},
	}

	// Game starts with 1.d4 — not covered by the e4 repertoire
	game := &models.GameAnalysis{
		UserColor: models.ColorBlack,
		Moves: []models.MoveAnalysis{
			{PlyNumber: 0, SAN: "d4", FEN: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -", IsUserMove: false},
			{PlyNumber: 1, SAN: "d5", FEN: "rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq d3", IsUserMove: true},
		},
	}

	best, score := svc.findBestMatchingRepertoireFromStored(game, indexRepertoires([]models.Repertoire{repA}))

	assert.Nil(t, best, "should not match any repertoire when opponent's first move is not covered")
	assert.Equal(t, 0, score)
}

func TestFindBestMatchingRepertoireFromStored_Empty(t *testing.T) {
	svc := NewImportService(nil, nil)

	game := &models.GameAnalysis{
		Moves: []models.MoveAnalysis{
			{SAN: "e4", FEN: "start", IsUserMove: true},
		},
	}

	best, score := svc.findBestMatchingRepertoireFromStored(game, nil)

	assert.Nil(t, best)
	assert.Equal(t, 0, score)
}

// --- GetDashboardStats tests ---

func TestGetDashboardStats_OpeningErrorRate(t *testing.T) {
	repRef := &models.RepertoireRef{ID: "rep-1", Name: "My White"}

	analyses := []models.RawAnalysis{
		makeRawAnalysis("a1", "games.pgn", time.Now(), []models.GameAnalysis{
			// Game 1: in-repertoire (win)
			makeGameAnalysis(0, models.PGNHeaders{"Result": "1-0"}, []models.MoveAnalysis{
				{PlyNumber: 0, SAN: "e4", Status: "in-repertoire", IsUserMove: true},
				{PlyNumber: 1, SAN: "e5", Status: "in-repertoire", IsUserMove: false},
				{PlyNumber: 2, SAN: "Nf3", Status: "out-of-book", IsUserMove: true},
			}, models.ColorWhite, repRef),
			// Game 2: error - user deviated (loss)
			makeGameAnalysis(1, models.PGNHeaders{"Result": "0-1"}, []models.MoveAnalysis{
				{PlyNumber: 0, SAN: "d4", Status: "out-of-repertoire", IsUserMove: true, ExpectedMove: "e4"},
				{PlyNumber: 1, SAN: "d5", Status: "out-of-book", IsUserMove: false},
			}, models.ColorWhite, repRef),
			// Game 3: new-line - opponent novelty (draw)
			makeGameAnalysis(2, models.PGNHeaders{"Result": "1/2-1/2"}, []models.MoveAnalysis{
				{PlyNumber: 0, SAN: "e4", Status: "in-repertoire", IsUserMove: true},
				{PlyNumber: 1, SAN: "c5", Status: "opponent-new", IsUserMove: false},
				{PlyNumber: 2, SAN: "Nf3", Status: "out-of-book", IsUserMove: true},
			}, models.ColorWhite, repRef),
			// Game 4: no matched repertoire
			makeGameAnalysis(3, models.PGNHeaders{"Result": "1-0"}, []models.MoveAnalysis{
				{PlyNumber: 0, SAN: "d4", Status: "out-of-book", IsUserMove: true},
			}, models.ColorWhite, nil),
		}),
	}

	mockAnalysisRepo := &mocks.MockAnalysisRepo{
		GetAllGamesRawFunc: func(userID string) ([]models.RawAnalysis, error) {
			return analyses, nil
		},
	}

	mockRepRepo := &mocks.MockRepertoireRepo{
		GetByIDFunc: func(id string) (*models.Repertoire, error) {
			return &models.Repertoire{
				ID: "rep-1", Name: "My White", Color: models.ColorWhite,
				TreeData: models.RepertoireNode{FEN: "start"},
			}, nil
		},
	}

	repSvc := NewRepertoireService(mockRepRepo)
	svc := NewImportService(repSvc, mockAnalysisRepo)

	stats, err := svc.GetDashboardStats("user-1")
	require.NoError(t, err)

	// 4 total games
	assert.Equal(t, 4, stats.TotalGames)
	assert.Equal(t, 2, stats.Wins)   // game 0 + game 3
	assert.Equal(t, 1, stats.Losses) // game 1
	assert.Equal(t, 1, stats.Draws)  // game 2

	// 3 matched games (games 0, 1, 2 have repRef; game 3 does not)
	assert.Equal(t, 3, stats.MatchedGamesCount)
	// 1 error (game 1)
	assert.Equal(t, 1, stats.OpeningErrorCount)
	// Error rate: 1/3
	assert.InDelta(t, 1.0/3.0, stats.OpeningErrorRate, 0.001)
}

func TestGetDashboardStats_OpponentGaps(t *testing.T) {
	repRef := &models.RepertoireRef{ID: "rep-1", Name: "My White"}

	analyses := []models.RawAnalysis{
		makeRawAnalysis("a1", "games.pgn", time.Now(), []models.GameAnalysis{
			// Game 1: opponent plays c5 (new line), user wins
			makeGameAnalysis(0, models.PGNHeaders{"Result": "1-0"}, []models.MoveAnalysis{
				{PlyNumber: 0, SAN: "e4", FEN: "fen-start", Status: "in-repertoire", IsUserMove: true},
				{PlyNumber: 1, SAN: "c5", FEN: "fen-after-e4", Status: "opponent-new", IsUserMove: false},
			}, models.ColorWhite, repRef),
			// Game 2: opponent plays c5 again (same gap), user loses
			makeGameAnalysis(1, models.PGNHeaders{"Result": "0-1"}, []models.MoveAnalysis{
				{PlyNumber: 0, SAN: "e4", FEN: "fen-start", Status: "in-repertoire", IsUserMove: true},
				{PlyNumber: 1, SAN: "c5", FEN: "fen-after-e4", Status: "opponent-new", IsUserMove: false},
			}, models.ColorWhite, repRef),
			// Game 3: opponent plays d5 (different gap), draw
			makeGameAnalysis(2, models.PGNHeaders{"Result": "1/2-1/2"}, []models.MoveAnalysis{
				{PlyNumber: 0, SAN: "e4", FEN: "fen-start", Status: "in-repertoire", IsUserMove: true},
				{PlyNumber: 1, SAN: "d5", FEN: "fen-after-e4", Status: "opponent-new", IsUserMove: false},
			}, models.ColorWhite, repRef),
			// Game 4: user deviated first, then opponent new — should not count as gap
			makeGameAnalysis(3, models.PGNHeaders{"Result": "1-0"}, []models.MoveAnalysis{
				{PlyNumber: 0, SAN: "d4", FEN: "fen-start", Status: "out-of-repertoire", IsUserMove: true},
				{PlyNumber: 1, SAN: "d5", FEN: "fen-after-d4", Status: "opponent-new", IsUserMove: false},
			}, models.ColorWhite, repRef),
		}),
	}

	mockAnalysisRepo := &mocks.MockAnalysisRepo{
		GetAllGamesRawFunc: func(userID string) ([]models.RawAnalysis, error) {
			return analyses, nil
		},
	}

	mockRepRepo := &mocks.MockRepertoireRepo{
		GetByIDFunc: func(id string) (*models.Repertoire, error) {
			return &models.Repertoire{
				ID: "rep-1", Name: "My White", Color: models.ColorWhite,
				TreeData: models.RepertoireNode{FEN: "start"},
			}, nil
		},
	}

	repSvc := NewRepertoireService(mockRepRepo)
	svc := NewImportService(repSvc, mockAnalysisRepo)

	stats, err := svc.GetDashboardStats("user-1")
	require.NoError(t, err)

	// Should have 1 gap: c5 (freq 2). d5 (freq 1) is filtered out (min frequency = 2)
	require.Len(t, stats.OpponentGaps, 1)

	assert.Equal(t, "c5", stats.OpponentGaps[0].OpponentMove)
	assert.Equal(t, 2, stats.OpponentGaps[0].Frequency)
	assert.Equal(t, 1, stats.OpponentGaps[0].Wins)
	assert.Equal(t, 1, stats.OpponentGaps[0].Losses)
	assert.Equal(t, 0, stats.OpponentGaps[0].Draws)
	assert.InDelta(t, 0.5, stats.OpponentGaps[0].WinRate, 0.001)
	assert.Equal(t, "e4", stats.OpponentGaps[0].ContextMove)
}

func TestGetDashboardStats_BranchStats(t *testing.T) {
	repRef := &models.RepertoireRef{ID: "rep-1", Name: "My White"}
	branchName := "Sicilian"

	moveE4 := "e4"
	moveC5 := "c5"
	moveE5 := "e5"

	repTree := models.RepertoireNode{
		ID:  "root",
		FEN: "fen-start",
		Children: []*models.RepertoireNode{
			{
				ID:   "e4",
				FEN:  "fen-after-e4",
				Move: &moveE4,
				Children: []*models.RepertoireNode{
					{
						ID:         "c5",
						FEN:        "fen-after-c5",
						Move:       &moveC5,
						BranchName: &branchName,
						Children:   []*models.RepertoireNode{},
					},
					{
						ID:       "e5",
						FEN:      "fen-after-e5",
						Move:     &moveE5,
						Children: []*models.RepertoireNode{},
					},
				},
			},
		},
	}

	analyses := []models.RawAnalysis{
		makeRawAnalysis("a1", "games.pgn", time.Now(), []models.GameAnalysis{
			// Game 1: enters Sicilian branch, stays in-rep (win)
			makeGameAnalysis(0, models.PGNHeaders{"Result": "1-0"}, []models.MoveAnalysis{
				{PlyNumber: 0, SAN: "e4", FEN: "fen-start", Status: "in-repertoire", IsUserMove: true},
				{PlyNumber: 1, SAN: "c5", FEN: "fen-after-e4", Status: "in-repertoire", IsUserMove: false},
				{PlyNumber: 2, SAN: "Nf3", FEN: "fen-after-c5", Status: "out-of-book", IsUserMove: true},
			}, models.ColorWhite, repRef),
			// Game 2: enters Sicilian branch, error (loss)
			makeGameAnalysis(1, models.PGNHeaders{"Result": "0-1"}, []models.MoveAnalysis{
				{PlyNumber: 0, SAN: "e4", FEN: "fen-start", Status: "in-repertoire", IsUserMove: true},
				{PlyNumber: 1, SAN: "c5", FEN: "fen-after-e4", Status: "in-repertoire", IsUserMove: false},
				{PlyNumber: 2, SAN: "d4", FEN: "fen-after-c5", Status: "out-of-repertoire", IsUserMove: true},
			}, models.ColorWhite, repRef),
			// Game 3: enters e5 line (no branch name) — should not appear in branch stats
			makeGameAnalysis(2, models.PGNHeaders{"Result": "1/2-1/2"}, []models.MoveAnalysis{
				{PlyNumber: 0, SAN: "e4", FEN: "fen-start", Status: "in-repertoire", IsUserMove: true},
				{PlyNumber: 1, SAN: "e5", FEN: "fen-after-e4", Status: "in-repertoire", IsUserMove: false},
				{PlyNumber: 2, SAN: "Nf3", FEN: "fen-after-e5", Status: "out-of-book", IsUserMove: true},
			}, models.ColorWhite, repRef),
		}),
	}

	mockAnalysisRepo := &mocks.MockAnalysisRepo{
		GetAllGamesRawFunc: func(userID string) ([]models.RawAnalysis, error) {
			return analyses, nil
		},
	}

	mockRepRepo := &mocks.MockRepertoireRepo{
		GetByIDFunc: func(id string) (*models.Repertoire, error) {
			return &models.Repertoire{
				ID: "rep-1", Name: "My White", Color: models.ColorWhite,
				TreeData: repTree,
			}, nil
		},
	}

	repSvc := NewRepertoireService(mockRepRepo)
	svc := NewImportService(repSvc, mockAnalysisRepo)

	stats, err := svc.GetDashboardStats("user-1")
	require.NoError(t, err)

	// Only 1 branch (Sicilian) with 2 games (games 0 and 1)
	// Game 2 (e5 line) has no branch name, so excluded
	require.Len(t, stats.BranchStats, 1)
	assert.Equal(t, "Sicilian", stats.BranchStats[0].BranchName)
	assert.Equal(t, 2, stats.BranchStats[0].GameCount)
	assert.Equal(t, 1, stats.BranchStats[0].Wins)
	assert.Equal(t, 1, stats.BranchStats[0].Losses)
	assert.Equal(t, 0, stats.BranchStats[0].Draws)
	assert.InDelta(t, 0.5, stats.BranchStats[0].WinRate, 0.001)
	assert.Equal(t, 1, stats.BranchStats[0].ErrorCount)
	assert.InDelta(t, 0.5, stats.BranchStats[0].ErrorRate, 0.001)
}

func TestFindBranchForGame_FindsDeepestBranch(t *testing.T) {
	branchA := "Sicilian"
	branchB := "Najdorf"
	moveE4 := "e4"
	moveC5 := "c5"
	moveNf3 := "Nf3"
	moveD6 := "d6"

	root := &models.RepertoireNode{
		ID:  "root",
		FEN: "fen-start",
		Children: []*models.RepertoireNode{
			{
				ID:         "e4",
				FEN:        "fen-after-e4",
				Move:       &moveE4,
				BranchName: nil,
				Children: []*models.RepertoireNode{
					{
						ID:         "c5",
						FEN:        "fen-after-c5",
						Move:       &moveC5,
						BranchName: &branchA, // "Sicilian"
						Children: []*models.RepertoireNode{
							{
								ID:   "Nf3",
								FEN:  "fen-after-Nf3",
								Move: &moveNf3,
								Children: []*models.RepertoireNode{
									{
										ID:         "d6",
										FEN:        "fen-after-d6",
										Move:       &moveD6,
										BranchName: &branchB, // "Najdorf"
									},
								},
							},
						},
					},
				},
			},
		},
	}

	// Game goes e4 c5 Nf3 d6 → should find "Najdorf" (deepest branch)
	moves1 := []models.MoveAnalysis{
		{SAN: "e4", Status: "in-repertoire"},
		{SAN: "c5", Status: "in-repertoire"},
		{SAN: "Nf3", Status: "in-repertoire"},
		{SAN: "d6", Status: "in-repertoire"},
	}
	assert.Equal(t, "Najdorf", findBranchForGame(root, moves1))

	// Game goes e4 c5 Nf3 then out-of-book → should find "Sicilian"
	moves2 := []models.MoveAnalysis{
		{SAN: "e4", Status: "in-repertoire"},
		{SAN: "c5", Status: "in-repertoire"},
		{SAN: "Nf3", Status: "in-repertoire"},
		{SAN: "Be7", Status: "out-of-book"},
	}
	assert.Equal(t, "Sicilian", findBranchForGame(root, moves2))

	// Game goes e4 then opponent-new → no branch found (e4 node has no branch name)
	moves3 := []models.MoveAnalysis{
		{SAN: "e4", Status: "in-repertoire"},
		{SAN: "d5", Status: "opponent-new"},
	}
	assert.Equal(t, "", findBranchForGame(root, moves3))

	// Empty moves → no branch
	assert.Equal(t, "", findBranchForGame(root, nil))
}

func TestGetDashboardStats_EmptyData(t *testing.T) {
	mockAnalysisRepo := &mocks.MockAnalysisRepo{
		GetAllGamesRawFunc: func(userID string) ([]models.RawAnalysis, error) {
			return nil, nil
		},
	}

	svc := NewImportService(nil, mockAnalysisRepo)

	stats, err := svc.GetDashboardStats("user-1")
	require.NoError(t, err)

	assert.Equal(t, 0, stats.TotalGames)
	assert.Equal(t, 0, stats.OpeningErrorCount)
	assert.Equal(t, 0, stats.MatchedGamesCount)
	assert.InDelta(t, 0.0, stats.OpeningErrorRate, 0.001)
	assert.Empty(t, stats.OpponentGaps)
	assert.Empty(t, stats.BranchStats)
}

// --- AnalyzeTrainingMoves tests ---

func TestAnalyzeTrainingMoves_MatchesRepertoire(t *testing.T) {
	moveE4 := "e4"
	moveE5 := "e5"
	moveNf3 := "Nf3"

	whiteRep := models.Repertoire{
		ID:    "rep-w",
		Name:  "Italian",
		Color: models.ColorWhite,
		TreeData: models.RepertoireNode{
			ID:          "root",
			FEN:         "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -",
			ColorToMove: models.ChessColorWhite,
			Children: []*models.RepertoireNode{
				{
					ID:          "e4-node",
					FEN:         "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3",
					Move:        &moveE4,
					ColorToMove: models.ChessColorBlack,
					Children: []*models.RepertoireNode{
						{
							ID:          "e5-node",
							FEN:         "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6",
							Move:        &moveE5,
							ColorToMove: models.ChessColorWhite,
							Children: []*models.RepertoireNode{
								{
									ID:          "nf3-node",
									FEN:         "rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq -",
									Move:        &moveNf3,
									ColorToMove: models.ChessColorBlack,
									Children:    []*models.RepertoireNode{},
								},
							},
						},
					},
				},
			},
		},
	}

	mockRepRepo := &mocks.MockRepertoireRepo{
		GetByColorFunc: func(userID string, color models.Color) ([]models.Repertoire, error) {
			if color == models.ColorWhite {
				return []models.Repertoire{whiteRep}, nil
			}
			return nil, nil
		},
	}

	repSvc := NewRepertoireService(mockRepRepo)
	svc := NewImportService(repSvc, nil)

	resp, err := svc.AnalyzeTrainingMoves("user-1", []string{"e4", "e5", "Nf3", "Nc6"}, models.ColorWhite)

	require.NoError(t, err)
	require.NotNil(t, resp)
	require.NotNil(t, resp.MatchedRepertoire)
	assert.Equal(t, "rep-w", resp.MatchedRepertoire.ID)
	assert.Equal(t, "Italian", resp.MatchedRepertoire.Name)
	assert.Equal(t, 2, resp.MatchScore) // e4 and Nf3 are user moves that matched

	require.Len(t, resp.Moves, 4)
	// e4 -> in-repertoire (user move)
	assert.Equal(t, "e4", resp.Moves[0].SAN)
	assert.Equal(t, "in-repertoire", resp.Moves[0].Status)
	assert.True(t, resp.Moves[0].IsUserMove)
	// e5 -> in-repertoire (opponent)
	assert.Equal(t, "e5", resp.Moves[1].SAN)
	assert.Equal(t, "in-repertoire", resp.Moves[1].Status)
	assert.False(t, resp.Moves[1].IsUserMove)
	// Nf3 -> in-repertoire (user move)
	assert.Equal(t, "Nf3", resp.Moves[2].SAN)
	assert.Equal(t, "in-repertoire", resp.Moves[2].Status)
	assert.True(t, resp.Moves[2].IsUserMove)
	// Nc6 -> out-of-book (leaf, no children)
	assert.Equal(t, "Nc6", resp.Moves[3].SAN)
	assert.Equal(t, "out-of-book", resp.Moves[3].Status)
	assert.False(t, resp.Moves[3].IsUserMove)
}

func TestAnalyzeTrainingMoves_NoMatchingRepertoire(t *testing.T) {
	mockRepRepo := &mocks.MockRepertoireRepo{
		GetByColorFunc: func(userID string, color models.Color) ([]models.Repertoire, error) {
			return nil, nil
		},
	}

	repSvc := NewRepertoireService(mockRepRepo)
	svc := NewImportService(repSvc, nil)

	resp, err := svc.AnalyzeTrainingMoves("user-1", []string{"e4", "e5"}, models.ColorWhite)

	require.NoError(t, err)
	require.NotNil(t, resp)
	assert.Nil(t, resp.MatchedRepertoire)
	assert.Equal(t, 0, resp.MatchScore)
	require.Len(t, resp.Moves, 2)
	assert.Equal(t, "out-of-book", resp.Moves[0].Status)
	assert.Equal(t, "out-of-book", resp.Moves[1].Status)
}

func TestAnalyzeTrainingMoves_DetectsOutOfRepertoire(t *testing.T) {
	moveE4 := "e4"
	moveE5 := "e5"
	moveNf3 := "Nf3"

	// Repertoire expects e4 e5 Nf3, but user will play d4 instead of Nf3
	whiteRep := models.Repertoire{
		ID:    "rep-w",
		Name:  "Kings Pawn",
		Color: models.ColorWhite,
		TreeData: models.RepertoireNode{
			ID:          "root",
			FEN:         "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -",
			ColorToMove: models.ChessColorWhite,
			Children: []*models.RepertoireNode{
				{
					ID:          "e4-node",
					FEN:         "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3",
					Move:        &moveE4,
					ColorToMove: models.ChessColorBlack,
					Children: []*models.RepertoireNode{
						{
							ID:          "e5-node",
							FEN:         "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6",
							Move:        &moveE5,
							ColorToMove: models.ChessColorWhite,
							Children: []*models.RepertoireNode{
								{
									ID:          "nf3-node",
									FEN:         "rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq -",
									Move:        &moveNf3,
									ColorToMove: models.ChessColorBlack,
									Children:    []*models.RepertoireNode{},
								},
							},
						},
					},
				},
			},
		},
	}

	mockRepRepo := &mocks.MockRepertoireRepo{
		GetByColorFunc: func(userID string, color models.Color) ([]models.Repertoire, error) {
			if color == models.ColorWhite {
				return []models.Repertoire{whiteRep}, nil
			}
			return nil, nil
		},
	}

	repSvc := NewRepertoireService(mockRepRepo)
	svc := NewImportService(repSvc, nil)

	// User plays Bc4 instead of Nf3
	resp, err := svc.AnalyzeTrainingMoves("user-1", []string{"e4", "e5", "Bc4"}, models.ColorWhite)

	require.NoError(t, err)
	require.NotNil(t, resp)
	require.NotNil(t, resp.MatchedRepertoire)
	assert.Equal(t, "rep-w", resp.MatchedRepertoire.ID)
	assert.Equal(t, 1, resp.MatchScore) // only e4 matched

	require.Len(t, resp.Moves, 3)
	assert.Equal(t, "in-repertoire", resp.Moves[0].Status)     // e4
	assert.Equal(t, "in-repertoire", resp.Moves[1].Status)     // e5
	assert.Equal(t, "out-of-repertoire", resp.Moves[2].Status) // Bc4 (expected Nf3)
	assert.Equal(t, "Nf3", resp.Moves[2].ExpectedMove)
	assert.True(t, resp.Moves[2].IsUserMove)
}

func TestAnalyzeTrainingMoves_InvalidMove(t *testing.T) {
	mockRepRepo := &mocks.MockRepertoireRepo{
		GetByColorFunc: func(userID string, color models.Color) ([]models.Repertoire, error) {
			return nil, nil
		},
	}

	repSvc := NewRepertoireService(mockRepRepo)
	svc := NewImportService(repSvc, nil)

	_, err := svc.AnalyzeTrainingMoves("user-1", []string{"e4", "e5", "INVALID"}, models.ColorWhite)

	assert.Error(t, err)
	assert.Contains(t, err.Error(), "invalid move")
}

func TestAnalyzeTrainingMoves_BlackRepertoire(t *testing.T) {
	moveE4 := "e4"
	moveE5 := "e5"

	blackRep := models.Repertoire{
		ID:    "rep-b",
		Name:  "Sicilian",
		Color: models.ColorBlack,
		TreeData: models.RepertoireNode{
			ID:          "root",
			FEN:         "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -",
			ColorToMove: models.ChessColorWhite,
			Children: []*models.RepertoireNode{
				{
					ID:          "e4-node",
					FEN:         "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3",
					Move:        &moveE4,
					ColorToMove: models.ChessColorBlack,
					Children: []*models.RepertoireNode{
						{
							ID:          "e5-node",
							FEN:         "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6",
							Move:        &moveE5,
							ColorToMove: models.ChessColorWhite,
							Children:    []*models.RepertoireNode{},
						},
					},
				},
			},
		},
	}

	mockRepRepo := &mocks.MockRepertoireRepo{
		GetByColorFunc: func(userID string, color models.Color) ([]models.Repertoire, error) {
			if color == models.ColorBlack {
				return []models.Repertoire{blackRep}, nil
			}
			return nil, nil
		},
	}

	repSvc := NewRepertoireService(mockRepRepo)
	svc := NewImportService(repSvc, nil)

	resp, err := svc.AnalyzeTrainingMoves("user-1", []string{"e4", "e5", "Nf3"}, models.ColorBlack)

	require.NoError(t, err)
	require.NotNil(t, resp)
	require.NotNil(t, resp.MatchedRepertoire)
	assert.Equal(t, "rep-b", resp.MatchedRepertoire.ID)
	assert.Equal(t, 1, resp.MatchScore) // e5 is the only black user move that matched

	require.Len(t, resp.Moves, 3)
	// e4 -> in-repertoire (opponent move for black user)
	assert.Equal(t, "in-repertoire", resp.Moves[0].Status)
	assert.False(t, resp.Moves[0].IsUserMove)
	// e5 -> in-repertoire (user move)
	assert.Equal(t, "in-repertoire", resp.Moves[1].Status)
	assert.True(t, resp.Moves[1].IsUserMove)
	// Nf3 -> out-of-book (leaf)
	assert.Equal(t, "out-of-book", resp.Moves[2].Status)
	assert.False(t, resp.Moves[2].IsUserMove)
}

// syntheticPGN returns a PGN string containing n games where the given
// username plays White. Each game uses a distinct move so fingerprints differ.
func syntheticPGN(username string, n int) string {
	// A small pool of distinct legal opening lines so games are unique enough
	// to produce distinct fingerprints.
	openings := []string{
		"1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 1-0",
		"1. d4 d5 2. c4 e6 3. Nc3 Nf6 1-0",
		"1. c4 e5 2. Nc3 Nf6 3. Nf3 Nc6 1-0",
		"1. Nf3 d5 2. g3 g6 3. Bg2 Bg7 1-0",
		"1. e4 c5 2. Nf3 d6 3. d4 cxd4 1-0",
	}
	var b strings.Builder
	for i := 0; i < n; i++ {
		fmt.Fprintf(&b, "[Event \"Game %d\"]\n", i)
		b.WriteString("[Site \"Test\"]\n")
		fmt.Fprintf(&b, "[Date \"2024.01.%02d\"]\n", (i%28)+1)
		fmt.Fprintf(&b, "[White \"%s\"]\n", username)
		fmt.Fprintf(&b, "[Black \"opponent%d\"]\n", i)
		b.WriteString("[Result \"1-0\"]\n\n")
		b.WriteString(openings[i%len(openings)])
		b.WriteString("\n\n")
	}
	return b.String()
}

// TestParseAndAnalyze_RejectsTooManyGames verifies that an import exceeding
// config.MaxGamesPerImport is rejected with ErrTooManyGames rather than being
// allowed to proceed to the DB layer (where it could hit Postgres's
// 65535-parameter limit).
func TestParseAndAnalyze_RejectsTooManyGames(t *testing.T) {
	repSvc := NewRepertoireService(&mocks.MockRepertoireRepo{})
	svc := NewImportService(repSvc, &mocks.MockAnalysisRepo{})

	pgn := syntheticPGN("bigimporter", config.MaxGamesPerImport+1)

	_, _, err := svc.ParseAndAnalyze("big.pgn", "bigimporter", "user-1", pgn)

	require.Error(t, err)
	assert.ErrorIs(t, err, ErrTooManyGames)
}

// TestParseAndAnalyze_AcceptsAtLimit verifies the boundary: exactly
// MaxGamesPerImport games is not rejected by the size guard. We keep the
// repertoire/analysis mocks permissive so the call proceeds past the guard.
func TestParseAndAnalyze_AcceptsAtLimit(t *testing.T) {
	repSvc := NewRepertoireService(&mocks.MockRepertoireRepo{
		GetByColorFunc: func(string, models.Color) ([]models.Repertoire, error) {
			return nil, nil
		},
	})
	analysisRepo := &mocks.MockAnalysisRepo{
		SaveFunc: func(_ string, username, filename string, gameCount int, _ []models.GameAnalysis) (*models.AnalysisSummary, error) {
			return &models.AnalysisSummary{ID: "a-1", Username: username, Filename: filename, GameCount: gameCount}, nil
		},
	}
	svc := NewImportService(repSvc, analysisRepo)

	pgn := syntheticPGN("atlimit", config.MaxGamesPerImport)

	summary, _, err := svc.ParseAndAnalyze("limit.pgn", "atlimit", "user-1", pgn)

	require.NoError(t, err)
	require.NotNil(t, summary)
	assert.Equal(t, config.MaxGamesPerImport, summary.GameCount)
}
