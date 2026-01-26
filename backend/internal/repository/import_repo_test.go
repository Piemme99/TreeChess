package repository

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/treechess/backend/internal/models"
)

func TestSaveAnalysis_JSONMarshaling(t *testing.T) {
	results := []models.GameAnalysis{
		{
			GameIndex: 0,
			Headers: models.PGNHeaders{
				"Event": "Test Game",
				"White": "Player1",
				"Black": "Player2",
			},
			Moves: []models.MoveAnalysis{
				{PlyNumber: 0, SAN: "e4", Status: "in-repertoire", IsUserMove: true},
				{PlyNumber: 1, SAN: "c5", Status: "in-repertoire", IsUserMove: false},
			},
		},
	}

	resultsJSON, err := json.Marshal(results)
	require.NoError(t, err)

	var decoded []models.GameAnalysis
	err = json.Unmarshal(resultsJSON, &decoded)
	require.NoError(t, err)

	assert.Len(t, decoded, 1)
	assert.Equal(t, "Test Game", decoded[0].Headers["Event"])
	assert.Len(t, decoded[0].Moves, 2)
}

func TestAnalysisSummary_JSON(t *testing.T) {
	summary := models.AnalysisSummary{
		ID:        "test-id",
		Username:  "testuser",
		Filename:  "test.pgn",
		GameCount: 5,
	}

	data, err := json.Marshal(summary)
	require.NoError(t, err)

	var decoded models.AnalysisSummary
	err = json.Unmarshal(data, &decoded)
	require.NoError(t, err)

	assert.Equal(t, summary.ID, decoded.ID)
	assert.Equal(t, summary.Username, decoded.Username)
	assert.Equal(t, summary.Filename, decoded.Filename)
	assert.Equal(t, summary.GameCount, decoded.GameCount)
}

func TestAnalysisDetail_JSON(t *testing.T) {
	detail := models.AnalysisDetail{
		ID:        "test-id",
		Username:  "testuser",
		Filename:  "games.pgn",
		GameCount: 3,
		Results: []models.GameAnalysis{
			{
				GameIndex: 0,
				Headers:   models.PGNHeaders{"Event": "Casual"},
				UserColor: models.ColorBlack,
				Moves: []models.MoveAnalysis{
					{PlyNumber: 0, SAN: "d4", Status: "out-of-repertoire", IsUserMove: true},
				},
			},
		},
	}

	data, err := json.Marshal(detail)
	require.NoError(t, err)

	var decoded models.AnalysisDetail
	err = json.Unmarshal(data, &decoded)
	require.NoError(t, err)

	assert.Equal(t, detail.ID, decoded.ID)
	assert.Equal(t, detail.Username, decoded.Username)
	assert.Len(t, decoded.Results, 1)
	assert.Equal(t, "out-of-repertoire", decoded.Results[0].Moves[0].Status)
}

func TestMoveAnalysis_StatusValues(t *testing.T) {
	validStatuses := []string{"in-repertoire", "out-of-repertoire", "opponent-new"}

	for _, status := range validStatuses {
		ma := models.MoveAnalysis{
			PlyNumber:  0,
			SAN:        "e4",
			FEN:        "starting-fen",
			Status:     status,
			IsUserMove: true,
		}
		assert.Contains(t, validStatuses, ma.Status)
	}
}

func TestPGNHeaders_JSON(t *testing.T) {
	headers := models.PGNHeaders{
		"Event":  "World Championship",
		"Site":   "London",
		"Date":   "2024.01.01",
		"White":  "Carlsen",
		"Black":  "Niemann",
		"Result": "1-0",
	}

	data, err := json.Marshal(headers)
	require.NoError(t, err)

	var decoded models.PGNHeaders
	err = json.Unmarshal(data, &decoded)
	require.NoError(t, err)

	assert.Equal(t, "World Championship", decoded["Event"])
	assert.Equal(t, "Carlsen", decoded["White"])
}

func TestAnalysisDetail_NilResults(t *testing.T) {
	detail := models.AnalysisDetail{
		ID:        "test-id",
		Username:  "testuser",
		Filename:  "empty.pgn",
		GameCount: 0,
		Results:   nil,
	}

	data, err := json.Marshal(detail)
	require.NoError(t, err)

	var decoded models.AnalysisDetail
	err = json.Unmarshal(data, &decoded)
	require.NoError(t, err)

	assert.Nil(t, decoded.Results)
}

func TestGameAnalysis_MultipleGames(t *testing.T) {
	analysis := models.AnalysisDetail{
		ID:        "multi",
		Filename:  "tournament.pgn",
		GameCount: 2,
		Results: []models.GameAnalysis{
			{GameIndex: 0, Headers: models.PGNHeaders{"White": "A"}},
			{GameIndex: 1, Headers: models.PGNHeaders{"White": "B"}},
		},
	}

	assert.Len(t, analysis.Results, 2)
	assert.Equal(t, 0, analysis.Results[0].GameIndex)
	assert.Equal(t, 1, analysis.Results[1].GameIndex)
}

// Tests for computeGameStatus function

func TestComputeGameStatus_AllInRepertoire(t *testing.T) {
	game := models.GameAnalysis{
		GameIndex: 0,
		Moves: []models.MoveAnalysis{
			{PlyNumber: 0, Status: "in-repertoire", IsUserMove: true},
			{PlyNumber: 1, Status: "in-repertoire", IsUserMove: false},
			{PlyNumber: 2, Status: "in-repertoire", IsUserMove: true},
			{PlyNumber: 3, Status: "in-repertoire", IsUserMove: false},
		},
	}

	status := computeGameStatus(game)

	assert.Equal(t, "ok", status)
}

func TestComputeGameStatus_OutOfRepertoire(t *testing.T) {
	game := models.GameAnalysis{
		GameIndex: 0,
		Moves: []models.MoveAnalysis{
			{PlyNumber: 0, Status: "in-repertoire", IsUserMove: true},
			{PlyNumber: 1, Status: "in-repertoire", IsUserMove: false},
			{PlyNumber: 2, Status: "out-of-repertoire", IsUserMove: true}, // User deviation
			{PlyNumber: 3, Status: "opponent-new", IsUserMove: false},
		},
	}

	status := computeGameStatus(game)

	assert.Equal(t, "error", status)
}

func TestComputeGameStatus_OpponentNew(t *testing.T) {
	game := models.GameAnalysis{
		GameIndex: 0,
		Moves: []models.MoveAnalysis{
			{PlyNumber: 0, Status: "in-repertoire", IsUserMove: true},
			{PlyNumber: 1, Status: "opponent-new", IsUserMove: false}, // Opponent plays new move
			{PlyNumber: 2, Status: "in-repertoire", IsUserMove: true},
		},
	}

	status := computeGameStatus(game)

	assert.Equal(t, "new-line", status)
}

func TestComputeGameStatus_EmptyMoves(t *testing.T) {
	game := models.GameAnalysis{
		GameIndex: 0,
		Moves:     []models.MoveAnalysis{},
	}

	status := computeGameStatus(game)

	assert.Equal(t, "ok", status)
}

func TestComputeGameStatus_OutOfRepertoireFirst(t *testing.T) {
	// Test that out-of-repertoire takes precedence when it appears first
	game := models.GameAnalysis{
		GameIndex: 0,
		Moves: []models.MoveAnalysis{
			{PlyNumber: 0, Status: "out-of-repertoire", IsUserMove: true}, // Out first
			{PlyNumber: 1, Status: "opponent-new", IsUserMove: false},
		},
	}

	status := computeGameStatus(game)

	assert.Equal(t, "error", status) // out-of-repertoire should result in "error"
}

func TestComputeGameStatus_OpponentNewFirst(t *testing.T) {
	// Test when opponent-new appears before out-of-repertoire
	game := models.GameAnalysis{
		GameIndex: 0,
		Moves: []models.MoveAnalysis{
			{PlyNumber: 0, Status: "opponent-new", IsUserMove: false}, // Opponent new first
			{PlyNumber: 1, Status: "out-of-repertoire", IsUserMove: true},
		},
	}

	status := computeGameStatus(game)

	assert.Equal(t, "new-line", status) // First non-in-repertoire determines status
}

func TestComputeGameStatus_SingleMove(t *testing.T) {
	tests := []struct {
		name     string
		status   string
		expected string
	}{
		{"in-repertoire move", "in-repertoire", "ok"},
		{"out-of-repertoire move", "out-of-repertoire", "error"},
		{"opponent-new move", "opponent-new", "new-line"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			game := models.GameAnalysis{
				GameIndex: 0,
				Moves: []models.MoveAnalysis{
					{PlyNumber: 0, Status: tt.status, IsUserMove: true},
				},
			}

			status := computeGameStatus(game)

			assert.Equal(t, tt.expected, status)
		})
	}
}

func TestComputeGameStatus_LongGame(t *testing.T) {
	// Test a long game where deviation happens late
	moves := make([]models.MoveAnalysis, 50)
	for i := 0; i < 49; i++ {
		moves[i] = models.MoveAnalysis{
			PlyNumber:  i,
			Status:     "in-repertoire",
			IsUserMove: i%2 == 0,
		}
	}
	// Last move is out-of-repertoire
	moves[49] = models.MoveAnalysis{
		PlyNumber:  49,
		Status:     "out-of-repertoire",
		IsUserMove: true,
	}

	game := models.GameAnalysis{
		GameIndex: 0,
		Moves:     moves,
	}

	status := computeGameStatus(game)

	assert.Equal(t, "error", status)
}

// Additional repository-related tests

func TestGameSummary_JSON(t *testing.T) {
	summary := models.GameSummary{
		AnalysisID: "analysis-123",
		GameIndex:  0,
		White:      "Player1",
		Black:      "Player2",
		Result:     "1-0",
		Date:       "2024.01.01",
		UserColor:  models.ColorWhite,
		Status:     "ok",
	}

	data, err := json.Marshal(summary)
	require.NoError(t, err)

	var decoded models.GameSummary
	err = json.Unmarshal(data, &decoded)
	require.NoError(t, err)

	assert.Equal(t, summary.AnalysisID, decoded.AnalysisID)
	assert.Equal(t, summary.GameIndex, decoded.GameIndex)
	assert.Equal(t, summary.White, decoded.White)
	assert.Equal(t, summary.Black, decoded.Black)
	assert.Equal(t, summary.Result, decoded.Result)
	assert.Equal(t, summary.UserColor, decoded.UserColor)
	assert.Equal(t, summary.Status, decoded.Status)
}

func TestGamesResponse_JSON(t *testing.T) {
	response := models.GamesResponse{
		Games: []models.GameSummary{
			{AnalysisID: "a1", GameIndex: 0, White: "P1", Black: "P2"},
			{AnalysisID: "a1", GameIndex: 1, White: "P3", Black: "P4"},
		},
		Total:  10,
		Limit:  20,
		Offset: 0,
	}

	data, err := json.Marshal(response)
	require.NoError(t, err)

	var decoded models.GamesResponse
	err = json.Unmarshal(data, &decoded)
	require.NoError(t, err)

	assert.Len(t, decoded.Games, 2)
	assert.Equal(t, 10, decoded.Total)
	assert.Equal(t, 20, decoded.Limit)
	assert.Equal(t, 0, decoded.Offset)
}

func TestGamesResponse_EmptyGames(t *testing.T) {
	response := models.GamesResponse{
		Games:  []models.GameSummary{},
		Total:  0,
		Limit:  20,
		Offset: 0,
	}

	data, err := json.Marshal(response)
	require.NoError(t, err)

	var decoded models.GamesResponse
	err = json.Unmarshal(data, &decoded)
	require.NoError(t, err)

	assert.Empty(t, decoded.Games)
	assert.Equal(t, 0, decoded.Total)
}
