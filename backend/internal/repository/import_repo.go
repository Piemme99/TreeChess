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
