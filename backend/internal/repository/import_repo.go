package repository

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/treechess/backend/internal/models"
)

const (
	saveAnalysisSQL = `
		INSERT INTO analyses (id, username, filename, game_count, results, uploaded_at)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id, username, filename, game_count, uploaded_at
	`
	getAnalysesSQL = `
		SELECT id, username, filename, game_count, uploaded_at
		FROM analyses
		ORDER BY uploaded_at DESC
	`
	getAnalysisByIDSQL = `
		SELECT id, username, filename, game_count, results, uploaded_at
		FROM analyses
		WHERE id = $1
	`
	deleteAnalysisSQL = `
		DELETE FROM analyses
		WHERE id = $1
	`
	getAllGamesSQL = `
		SELECT id, results, uploaded_at
		FROM analyses
		ORDER BY uploaded_at DESC
	`
	updateAnalysisResultsSQL = `
		UPDATE analyses
		SET results = $2, game_count = $3
		WHERE id = $1
	`
)

func SaveAnalysis(username string, filename string, gameCount int, results []models.GameAnalysis) (*models.AnalysisSummary, error) {
	db := GetPool()
	ctx, cancel := dbContext()
	defer cancel()

	resultsJSON, err := json.Marshal(results)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal results: %w", err)
	}

	id := uuid.New()
	uploadedAt := time.Now()

	var summary models.AnalysisSummary
	err = db.QueryRow(ctx, saveAnalysisSQL,
		id,
		username,
		filename,
		gameCount,
		resultsJSON,
		uploadedAt,
	).Scan(
		&summary.ID,
		&summary.Username,
		&summary.Filename,
		&summary.GameCount,
		&summary.UploadedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to save analysis: %w", err)
	}

	return &summary, nil
}

func GetAnalyses() ([]models.AnalysisSummary, error) {
	db := GetPool()
	ctx, cancel := dbContext()
	defer cancel()

	rows, err := db.Query(ctx, getAnalysesSQL)
	if err != nil {
		return nil, fmt.Errorf("failed to query analyses: %w", err)
	}
	defer rows.Close()

	var analyses []models.AnalysisSummary
	for rows.Next() {
		var a models.AnalysisSummary
		err := rows.Scan(&a.ID, &a.Username, &a.Filename, &a.GameCount, &a.UploadedAt)
		if err != nil {
			return nil, fmt.Errorf("failed to scan analysis: %w", err)
		}
		analyses = append(analyses, a)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating analyses: %w", err)
	}

	return analyses, nil
}

func GetAnalysisByID(id string) (*models.AnalysisDetail, error) {
	db := GetPool()
	ctx, cancel := dbContext()
	defer cancel()

	var detail models.AnalysisDetail
	var resultsJSON []byte

	err := db.QueryRow(ctx, getAnalysisByIDSQL, id).Scan(
		&detail.ID,
		&detail.Username,
		&detail.Filename,
		&detail.GameCount,
		&resultsJSON,
		&detail.UploadedAt,
	)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, fmt.Errorf("analysis not found")
		}
		return nil, fmt.Errorf("failed to get analysis: %w", err)
	}

	if err := json.Unmarshal(resultsJSON, &detail.Results); err != nil {
		return nil, fmt.Errorf("failed to unmarshal results: %w", err)
	}

	return &detail, nil
}

func DeleteAnalysis(id string) error {
	db := GetPool()
	ctx, cancel := dbContext()
	defer cancel()

	result, err := db.Exec(ctx, deleteAnalysisSQL, id)
	if err != nil {
		return fmt.Errorf("failed to delete analysis: %w", err)
	}

	if result.RowsAffected() == 0 {
		return fmt.Errorf("analysis not found")
	}

	return nil
}

// GetAllGames returns all games from all analyses with pagination
func GetAllGames(limit, offset int) (*models.GamesResponse, error) {
	db := GetPool()
	ctx, cancel := dbContext()
	defer cancel()

	rows, err := db.Query(ctx, getAllGamesSQL)
	if err != nil {
		return nil, fmt.Errorf("failed to query analyses: %w", err)
	}
	defer rows.Close()

	var allGames []models.GameSummary

	for rows.Next() {
		var analysisID string
		var resultsJSON []byte
		var uploadedAt time.Time

		if err := rows.Scan(&analysisID, &resultsJSON, &uploadedAt); err != nil {
			return nil, fmt.Errorf("failed to scan analysis: %w", err)
		}

		var games []models.GameAnalysis
		if err := json.Unmarshal(resultsJSON, &games); err != nil {
			return nil, fmt.Errorf("failed to unmarshal results: %w", err)
		}

		for _, game := range games {
			status := computeGameStatus(game)
			summary := models.GameSummary{
				AnalysisID: analysisID,
				GameIndex:  game.GameIndex,
				White:      game.Headers["White"],
				Black:      game.Headers["Black"],
				Result:     game.Headers["Result"],
				Date:       game.Headers["Date"],
				UserColor:  game.UserColor,
				Status:     status,
				ImportedAt: uploadedAt,
			}
			allGames = append(allGames, summary)
		}
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating analyses: %w", err)
	}

	total := len(allGames)

	// Apply pagination
	start := offset
	if start > total {
		start = total
	}
	end := start + limit
	if end > total {
		end = total
	}

	paginatedGames := allGames[start:end]
	if paginatedGames == nil {
		paginatedGames = []models.GameSummary{}
	}

	return &models.GamesResponse{
		Games:  paginatedGames,
		Total:  total,
		Limit:  limit,
		Offset: offset,
	}, nil
}

// computeGameStatus determines the overall status of a game based on the first actionable move
func computeGameStatus(game models.GameAnalysis) string {
	// Find the first move that is either out-of-repertoire or opponent-new
	for _, move := range game.Moves {
		if move.Status == "out-of-repertoire" {
			return "error"
		}
		if move.Status == "opponent-new" {
			return "new-line"
		}
	}
	return "ok"
}

// DeleteGame removes a single game from an analysis
func DeleteGame(analysisID string, gameIndex int) error {
	db := GetPool()
	ctx, cancel := dbContext()
	defer cancel()

	// First, get the current analysis
	var resultsJSON []byte
	err := db.QueryRow(ctx, "SELECT results FROM analyses WHERE id = $1", analysisID).Scan(&resultsJSON)
	if err != nil {
		if err == pgx.ErrNoRows {
			return fmt.Errorf("analysis not found")
		}
		return fmt.Errorf("failed to get analysis: %w", err)
	}

	var games []models.GameAnalysis
	if err := json.Unmarshal(resultsJSON, &games); err != nil {
		return fmt.Errorf("failed to unmarshal results: %w", err)
	}

	// Find and remove the game with the given index
	found := false
	var updatedGames []models.GameAnalysis
	for _, game := range games {
		if game.GameIndex == gameIndex {
			found = true
		} else {
			updatedGames = append(updatedGames, game)
		}
	}

	if !found {
		return fmt.Errorf("game not found")
	}

	// If no games left, delete the entire analysis
	if len(updatedGames) == 0 {
		return DeleteAnalysis(analysisID)
	}

	// Update the analysis with remaining games
	updatedJSON, err := json.Marshal(updatedGames)
	if err != nil {
		return fmt.Errorf("failed to marshal updated results: %w", err)
	}

	_, err = db.Exec(ctx, updateAnalysisResultsSQL, analysisID, updatedJSON, len(updatedGames))
	if err != nil {
		return fmt.Errorf("failed to update analysis: %w", err)
	}

	return nil
}
