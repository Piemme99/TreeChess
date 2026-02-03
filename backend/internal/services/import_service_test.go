package services

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/notnil/chess"
	"github.com/treechess/backend/internal/models"
	"github.com/treechess/backend/internal/repository/mocks"
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

	engineSvc := NewEngineService(mockEvalRepo, mockAnalysisRepo)
	svc := NewImportService(nil, mockAnalysisRepo, WithEngineService(engineSvc))

	insights, err := svc.GetInsights("user-1")

	require.NoError(t, err)
	assert.True(t, insights.EngineAnalysisDone)
	assert.Equal(t, 1, insights.EngineAnalysisTotal)
	assert.Equal(t, 1, insights.EngineAnalysisCompleted)
	assert.Len(t, insights.WorstMistakes, 1)
	assert.Equal(t, "Bf4", insights.WorstMistakes[0].PlayedMove)
	assert.Equal(t, "Nc3", insights.WorstMistakes[0].BestMove)
	assert.InDelta(t, 0.08, insights.WorstMistakes[0].WinrateDrop, 0.001)
	assert.Equal(t, 1, insights.WorstMistakes[0].Frequency)
	// Verify the game reference includes the ply number for navigation
	assert.Len(t, insights.WorstMistakes[0].Games, 1)
	assert.Equal(t, 4, insights.WorstMistakes[0].Games[0].PlyNumber)
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

	engineSvc := NewEngineService(mockEvalRepo, mockAnalysisRepo)
	svc := NewImportService(nil, mockAnalysisRepo, WithEngineService(engineSvc))
	insights, err := svc.GetInsights("user-1")

	require.NoError(t, err)
	assert.NotNil(t, insights)
	assert.Empty(t, insights.WorstMistakes)
	assert.True(t, insights.EngineAnalysisDone)
}
