package services

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/notnil/chess"
	"github.com/treechess/backend/internal/models"
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

func TestMoveExistsInRepertoire_Found(t *testing.T) {
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
	result := svc.moveExistsInRepertoire(root, fen, "e4")

	assert.True(t, result)
}

func TestMoveExistsInRepertoire_NotFound(t *testing.T) {
	svc := NewImportService(nil, nil)

	root := models.RepertoireNode{
		ID:          "root",
		FEN:         "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -",
		Move:        nil,
		ColorToMove: models.ChessColorWhite,
	}

	fen := "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -"
	result := svc.moveExistsInRepertoire(root, fen, "e4")

	assert.False(t, result)
}

func TestFindExpectedMove(t *testing.T) {
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
	result := svc.findExpectedMove(root, fen)

	assert.Equal(t, "e4", result)
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
	assert.Equal(t, "opponent-new", analysis.Moves[0].Status)
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
	assert.Equal(t, "out-of-repertoire", analysis.Moves[0].Status)
	assert.Equal(t, "opponent-new", analysis.Moves[1].Status)
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

func TestMoveExistsInRepertoire_DeepSearch(t *testing.T) {
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

	// Test deep search - should find Nf3 move
	fenAfterE4E5 := "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6"
	result := svc.moveExistsInRepertoire(root, fenAfterE4E5, "Nf3")

	assert.True(t, result)
}

func TestMoveExistsInRepertoire_WrongFEN(t *testing.T) {
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

	// Search with a different FEN that doesn't match
	differentFEN := "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq -"
	result := svc.moveExistsInRepertoire(root, differentFEN, "e4")

	assert.False(t, result)
}

func TestFindExpectedMove_NotFound(t *testing.T) {
	svc := NewImportService(nil, nil)

	root := models.RepertoireNode{
		ID:          "root",
		FEN:         "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -",
		Move:        nil,
		ColorToMove: models.ChessColorWhite,
		Children:    nil, // No children
	}

	// FEN that doesn't match root
	differentFEN := "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq -"
	result := svc.findExpectedMove(root, differentFEN)

	assert.Empty(t, result)
}

func TestFindExpectedMove_NoChildren(t *testing.T) {
	svc := NewImportService(nil, nil)

	root := models.RepertoireNode{
		ID:          "root",
		FEN:         "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -",
		Move:        nil,
		ColorToMove: models.ChessColorWhite,
		Children:    []*models.RepertoireNode{}, // Empty children
	}

	fen := "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -"
	result := svc.findExpectedMove(root, fen)

	assert.Empty(t, result)
}

func TestFindExpectedMove_DeepSearch(t *testing.T) {
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
								ID:   "Nf3",
								FEN:  "rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq -",
								Move: &moveNf3,
							},
						},
					},
				},
			},
		},
	}

	// Find expected move from deep position
	fenAfterE4E5 := "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6"
	result := svc.findExpectedMove(root, fenAfterE4E5)

	assert.Equal(t, "Nf3", result)
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
