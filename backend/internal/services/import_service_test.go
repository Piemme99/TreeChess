package services

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/notnil/chess"
	"github.com/treechess/backend/internal/models"
)

func TestImportService_ParsePGN(t *testing.T) {
	svc := NewImportService(nil)

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
	svc := NewImportService(nil)

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
	svc := NewImportService(nil)

	pgnData := `[Event "Test"]
[White "A"]
[Black "B"]
1. e4 e5 1-0`

	err := svc.ValidatePGN(pgnData)

	assert.NoError(t, err)
}

func TestImportService_ValidateMove_Valid(t *testing.T) {
	svc := NewImportService(nil)

	fen := "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -"
	san := "e4"

	err := svc.ValidateMove(fen, san)

	assert.NoError(t, err)
}

func TestImportService_ValidateMove_Invalid(t *testing.T) {
	svc := NewImportService(nil)

	fen := "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -"
	san := "e5"

	err := svc.ValidateMove(fen, san)

	assert.Error(t, err)
}

func TestImportService_GetLegalMoves(t *testing.T) {
	svc := NewImportService(nil)

	fen := "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -"
	moves := svc.GetLegalMoves(fen)

	assert.NotEmpty(t, moves)
}

func TestExtractHeaders(t *testing.T) {
	svc := NewImportService(nil)

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
	svc := NewImportService(nil)

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
	svc := NewImportService(nil)

	moveE4 := "e4"
	root := models.RepertoireNode{
		ID:          "root",
		FEN:         "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -",
		Move:        nil,
		ColorToMove: models.ColorWhite,
		Children: []*models.RepertoireNode{
			{
				ID:          "e4",
				FEN:         "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3",
				Move:        &moveE4,
				ColorToMove: models.ColorBlack,
			},
		},
	}

	fen := "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -"
	result := svc.moveExistsInRepertoire(root, fen, "e4")

	assert.True(t, result)
}

func TestMoveExistsInRepertoire_NotFound(t *testing.T) {
	svc := NewImportService(nil)

	root := models.RepertoireNode{
		ID:          "root",
		FEN:         "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -",
		Move:        nil,
		ColorToMove: models.ColorWhite,
	}

	fen := "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -"
	result := svc.moveExistsInRepertoire(root, fen, "e4")

	assert.False(t, result)
}

func TestFindExpectedMove(t *testing.T) {
	svc := NewImportService(nil)

	moveE4 := "e4"
	moveD4 := "d4"
	root := models.RepertoireNode{
		ID:          "root",
		FEN:         "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -",
		Move:        nil,
		ColorToMove: models.ColorWhite,
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
	svc := NewImportService(nil)

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
	svc := NewImportService(nil)

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
	svc := NewImportService(nil)

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
		ColorToMove: models.ColorWhite,
	}

	analysis := svc.analyzeGame(0, games[0], root, models.ColorWhite)

	assert.Len(t, analysis.Moves, 4)
	assert.Equal(t, 0, analysis.Moves[0].PlyNumber)
	assert.Equal(t, 1, analysis.Moves[1].PlyNumber)
	assert.Equal(t, 2, analysis.Moves[2].PlyNumber)
	assert.Equal(t, 3, analysis.Moves[3].PlyNumber)
}

func TestAnalyzeGame_WhiteMoveClassification(t *testing.T) {
	svc := NewImportService(nil)

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
		ColorToMove: models.ColorWhite,
	}

	analysis := svc.analyzeGame(0, games[0], root, models.ColorWhite)

	assert.Len(t, analysis.Moves, 2)
	assert.True(t, analysis.Moves[0].IsUserMove)
	assert.False(t, analysis.Moves[1].IsUserMove)
}

func TestAnalyzeGame_BlackRepertoire(t *testing.T) {
	svc := NewImportService(nil)

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
		ColorToMove: models.ColorWhite,
	}

	analysis := svc.analyzeGame(0, games[0], root, models.ColorBlack)

	assert.Len(t, analysis.Moves, 2)
	assert.False(t, analysis.Moves[0].IsUserMove)
	assert.Equal(t, "opponent-new", analysis.Moves[0].Status)
	assert.True(t, analysis.Moves[1].IsUserMove)
}

func TestAnalyzeGame_NoRepertoire(t *testing.T) {
	svc := NewImportService(nil)

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
		ColorToMove: models.ColorWhite,
	}

	analysis := svc.analyzeGame(0, games[0], root, models.ColorWhite)

	assert.Len(t, analysis.Moves, 2)
	assert.Equal(t, "out-of-repertoire", analysis.Moves[0].Status)
	assert.Equal(t, "opponent-new", analysis.Moves[1].Status)
}

func strPtr(s string) *string {
	return &s
}
