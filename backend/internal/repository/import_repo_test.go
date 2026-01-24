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
