package repository

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/treechess/backend/internal/models"
)

// PostgresEngineEvalRepo implements EngineEvalRepository using PostgreSQL
type PostgresEngineEvalRepo struct {
	pool *pgxpool.Pool
}

// NewPostgresEngineEvalRepo creates a new PostgresEngineEvalRepo
func NewPostgresEngineEvalRepo(pool *pgxpool.Pool) *PostgresEngineEvalRepo {
	return &PostgresEngineEvalRepo{pool: pool}
}

// CreatePendingBatch creates pending engine eval rows for all games in an analysis
func (r *PostgresEngineEvalRepo) CreatePendingBatch(userID, analysisID string, gameCount int) error {
	ctx, cancel := dbContext()
	defer cancel()

	for i := 0; i < gameCount; i++ {
		_, err := r.pool.Exec(ctx,
			`INSERT INTO engine_evals (user_id, analysis_id, game_index, status)
			 VALUES ($1, $2, $3, 'pending')
			 ON CONFLICT (analysis_id, game_index) DO NOTHING`,
			userID, analysisID, i,
		)
		if err != nil {
			return fmt.Errorf("failed to create pending eval for game %d: %w", i, err)
		}
	}
	return nil
}

// GetPending returns up to limit pending engine evals
func (r *PostgresEngineEvalRepo) GetPending(limit int) ([]models.EngineEval, error) {
	ctx, cancel := dbContext()
	defer cancel()

	rows, err := r.pool.Query(ctx,
		`SELECT id, user_id, analysis_id, game_index, status, created_at, updated_at
		 FROM engine_evals
		 WHERE status = 'pending'
		 ORDER BY created_at ASC
		 LIMIT $1`,
		limit,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to query pending evals: %w", err)
	}
	defer rows.Close()

	var evals []models.EngineEval
	for rows.Next() {
		var e models.EngineEval
		if err := rows.Scan(&e.ID, &e.UserID, &e.AnalysisID, &e.GameIndex, &e.Status, &e.CreatedAt, &e.UpdatedAt); err != nil {
			return nil, fmt.Errorf("failed to scan eval: %w", err)
		}
		evals = append(evals, e)
	}
	return evals, nil
}

// MarkProcessing marks an engine eval as processing
func (r *PostgresEngineEvalRepo) MarkProcessing(id string) error {
	ctx, cancel := dbContext()
	defer cancel()

	_, err := r.pool.Exec(ctx,
		`UPDATE engine_evals SET status = 'processing', updated_at = $2 WHERE id = $1`,
		id, time.Now(),
	)
	return err
}

// SaveEvals saves completed evaluations for an engine eval
func (r *PostgresEngineEvalRepo) SaveEvals(id string, evals []models.ExplorerMoveStats) error {
	ctx, cancel := dbContext()
	defer cancel()

	evalsJSON, err := json.Marshal(evals)
	if err != nil {
		return fmt.Errorf("failed to marshal evals: %w", err)
	}

	_, err = r.pool.Exec(ctx,
		`UPDATE engine_evals SET status = 'done', evals = $2, updated_at = $3 WHERE id = $1`,
		id, evalsJSON, time.Now(),
	)
	return err
}

// MarkFailed marks an engine eval as failed
func (r *PostgresEngineEvalRepo) MarkFailed(id string) error {
	ctx, cancel := dbContext()
	defer cancel()

	_, err := r.pool.Exec(ctx,
		`UPDATE engine_evals SET status = 'failed', updated_at = $2 WHERE id = $1`,
		id, time.Now(),
	)
	return err
}

// GetByUser returns all engine evals for a user
func (r *PostgresEngineEvalRepo) GetByUser(userID string) ([]models.EngineEval, error) {
	ctx, cancel := dbContext()
	defer cancel()

	rows, err := r.pool.Query(ctx,
		`SELECT id, user_id, analysis_id, game_index, status, evals, created_at, updated_at
		 FROM engine_evals
		 WHERE user_id = $1
		 ORDER BY created_at DESC`,
		userID,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to query user evals: %w", err)
	}
	defer rows.Close()

	var evals []models.EngineEval
	for rows.Next() {
		var e models.EngineEval
		var evalsJSON []byte
		if err := rows.Scan(&e.ID, &e.UserID, &e.AnalysisID, &e.GameIndex, &e.Status, &evalsJSON, &e.CreatedAt, &e.UpdatedAt); err != nil {
			return nil, fmt.Errorf("failed to scan eval: %w", err)
		}
		if evalsJSON != nil {
			if err := json.Unmarshal(evalsJSON, &e.Evals); err != nil {
				return nil, fmt.Errorf("failed to unmarshal evals: %w", err)
			}
		}
		evals = append(evals, e)
	}
	return evals, nil
}
