package repository

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/treechess/backend/internal/models"
)

const (
	saveAnalysisSQL = `
		INSERT INTO analyses (id, user_id, username, filename, game_count, results, uploaded_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id, username, filename, game_count, uploaded_at
	`
	getAnalysesSQL = `
		SELECT id, username, filename, game_count, uploaded_at
		FROM analyses
		WHERE user_id = $1
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
		SELECT id, filename, results, uploaded_at
		FROM analyses
		WHERE user_id = $1
		ORDER BY uploaded_at DESC
	`
	belongsToUserAnalysisSQL = `
		SELECT EXISTS(SELECT 1 FROM analyses WHERE id = $1 AND user_id = $2)
	`
	updateAnalysisResultsSQL = `
		UPDATE analyses
		SET results = $2, game_count = $3
		WHERE id = $1
	`
)

// PostgresAnalysisRepo implements AnalysisRepository using PostgreSQL
type PostgresAnalysisRepo struct {
	pool *pgxpool.Pool
}

// NewPostgresAnalysisRepo creates a new PostgreSQL analysis repository
func NewPostgresAnalysisRepo(pool *pgxpool.Pool) *PostgresAnalysisRepo {
	return &PostgresAnalysisRepo{pool: pool}
}

// Save saves a new analysis
func (r *PostgresAnalysisRepo) Save(userID string, username, filename string, gameCount int, results []models.GameAnalysis) (*models.AnalysisSummary, error) {
	ctx, cancel := dbContext()
	defer cancel()

	resultsJSON, err := json.Marshal(results)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal results: %w", err)
	}

	id := uuid.New()
	uploadedAt := time.Now()

	var summary models.AnalysisSummary
	err = r.pool.QueryRow(ctx, saveAnalysisSQL,
		id,
		userID,
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

// GetAll returns all analysis summaries for a user
func (r *PostgresAnalysisRepo) GetAll(userID string) ([]models.AnalysisSummary, error) {
	ctx, cancel := dbContext()
	defer cancel()

	rows, err := r.pool.Query(ctx, getAnalysesSQL, userID)
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

// GetByID returns analysis details by ID
func (r *PostgresAnalysisRepo) GetByID(id string) (*models.AnalysisDetail, error) {
	ctx, cancel := dbContext()
	defer cancel()

	var detail models.AnalysisDetail
	var resultsJSON []byte

	err := r.pool.QueryRow(ctx, getAnalysisByIDSQL, id).Scan(
		&detail.ID,
		&detail.Username,
		&detail.Filename,
		&detail.GameCount,
		&resultsJSON,
		&detail.UploadedAt,
	)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, ErrAnalysisNotFound
		}
		return nil, fmt.Errorf("failed to get analysis: %w", err)
	}

	if err := json.Unmarshal(resultsJSON, &detail.Results); err != nil {
		return nil, fmt.Errorf("failed to unmarshal results: %w", err)
	}

	return &detail, nil
}

// Delete deletes an analysis by ID
func (r *PostgresAnalysisRepo) Delete(id string) error {
	ctx, cancel := dbContext()
	defer cancel()

	result, err := r.pool.Exec(ctx, deleteAnalysisSQL, id)
	if err != nil {
		return fmt.Errorf("failed to delete analysis: %w", err)
	}

	if result.RowsAffected() == 0 {
		return ErrAnalysisNotFound
	}

	return nil
}

// GetAllGames returns all games from all analyses with pagination for a user
func (r *PostgresAnalysisRepo) GetAllGames(userID string, limit, offset int, timeClass, opening string) (*models.GamesResponse, error) {
	ctx, cancel := dbContext()
	defer cancel()

	rows, err := r.pool.Query(ctx, getAllGamesSQL, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to query analyses: %w", err)
	}
	defer rows.Close()

	var allGames []models.GameSummary

	for rows.Next() {
		var analysisID string
		var filename string
		var resultsJSON []byte
		var uploadedAt time.Time

		if err := rows.Scan(&analysisID, &filename, &resultsJSON, &uploadedAt); err != nil {
			return nil, fmt.Errorf("failed to scan analysis: %w", err)
		}

		source := classifySource(filename)

		var games []models.GameAnalysis
		if err := json.Unmarshal(resultsJSON, &games); err != nil {
			return nil, fmt.Errorf("failed to unmarshal results: %w", err)
		}

		for _, game := range games {
			status := computeGameStatus(game)
			tc := models.ClassifyTimeControl(game.Headers["TimeControl"])
			if timeClass != "" && tc != timeClass {
				continue
			}
			gameOpening := game.Headers["Opening"]
			searchableOpening := gameOpening
			if searchableOpening == "" {
				searchableOpening = game.Headers["ECO"]
			}
			if opening != "" && !strings.Contains(strings.ToLower(searchableOpening), strings.ToLower(opening)) {
				continue
			}
			summary := models.GameSummary{
				AnalysisID: analysisID,
				GameIndex:  game.GameIndex,
				White:      game.Headers["White"],
				Black:      game.Headers["Black"],
				Result:     game.Headers["Result"],
				Date:       game.Headers["Date"],
				UserColor:  game.UserColor,
				Status:     status,
				TimeClass:  tc,
				Opening:    gameOpening,
				ImportedAt: uploadedAt,
				Source:     source,
			}
			if game.MatchedRepertoire != nil {
				summary.RepertoireName = game.MatchedRepertoire.Name
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

// DeleteGame removes a single game from an analysis
func (r *PostgresAnalysisRepo) DeleteGame(analysisID string, gameIndex int) error {
	ctx, cancel := dbContext()
	defer cancel()

	// First, get the current analysis
	var resultsJSON []byte
	err := r.pool.QueryRow(ctx, "SELECT results FROM analyses WHERE id = $1", analysisID).Scan(&resultsJSON)
	if err != nil {
		if err == pgx.ErrNoRows {
			return ErrAnalysisNotFound
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
		return ErrGameNotFound
	}

	// If no games left, delete the entire analysis
	if len(updatedGames) == 0 {
		return r.Delete(analysisID)
	}

	// Update the analysis with remaining games
	updatedJSON, err := json.Marshal(updatedGames)
	if err != nil {
		return fmt.Errorf("failed to marshal updated results: %w", err)
	}

	_, err = r.pool.Exec(ctx, updateAnalysisResultsSQL, analysisID, updatedJSON, len(updatedGames))
	if err != nil {
		return fmt.Errorf("failed to update analysis: %w", err)
	}

	return nil
}

// UpdateResults updates the results array of an existing analysis
func (r *PostgresAnalysisRepo) UpdateResults(analysisID string, results []models.GameAnalysis) error {
	ctx, cancel := dbContext()
	defer cancel()

	resultsJSON, err := json.Marshal(results)
	if err != nil {
		return fmt.Errorf("failed to marshal results: %w", err)
	}

	result, err := r.pool.Exec(ctx, updateAnalysisResultsSQL, analysisID, resultsJSON, len(results))
	if err != nil {
		return fmt.Errorf("failed to update analysis results: %w", err)
	}

	if result.RowsAffected() == 0 {
		return ErrAnalysisNotFound
	}

	return nil
}

// BelongsToUser checks if an analysis belongs to a specific user
func (r *PostgresAnalysisRepo) BelongsToUser(id string, userID string) (bool, error) {
	ctx, cancel := dbContext()
	defer cancel()

	var belongs bool
	err := r.pool.QueryRow(ctx, belongsToUserAnalysisSQL, id, userID).Scan(&belongs)
	if err != nil {
		return false, fmt.Errorf("failed to check analysis ownership: %w", err)
	}
	return belongs, nil
}

// classifySource derives the import source from the analysis filename
func classifySource(filename string) string {
	if strings.HasPrefix(filename, "sync_") {
		return "sync"
	}
	if strings.HasPrefix(filename, "lichess_") {
		return "lichess"
	}
	if strings.HasPrefix(filename, "chesscom_") {
		return "chesscom"
	}
	return "pgn"
}

// computeGameStatus determines the overall status of a game based on the first actionable move
func computeGameStatus(game models.GameAnalysis) string {
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
