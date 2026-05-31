package repository

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kumquat/backend/config"
	"github.com/kumquat/backend/internal/models"
)

// PostgresEngineEvalRepo implements EngineEvalRepository using PostgreSQL
type PostgresEngineEvalRepo struct {
	pool *pgxpool.Pool
}

// NewPostgresEngineEvalRepo creates a new PostgresEngineEvalRepo
func NewPostgresEngineEvalRepo(pool *pgxpool.Pool) *PostgresEngineEvalRepo {
	return &PostgresEngineEvalRepo{pool: pool}
}

// CreatePendingBatch creates pending engine eval rows for all games in an
// analysis using chunked multi-row INSERTs (config.DBBatchSize rows per query,
// 4 parameters per row) so a large analysis never exceeds Postgres's
// 65535-parameter limit and never issues one round-trip per game.
func (r *PostgresEngineEvalRepo) CreatePendingBatch(ctx context.Context, userID, analysisID string, gameCount int) error {
	if gameCount <= 0 {
		return nil
	}

	for start := 0; start < gameCount; start += config.DBBatchSize {
		end := start + config.DBBatchSize
		if end > gameCount {
			end = gameCount
		}
		if err := r.createPendingChunk(ctx, userID, analysisID, start, end); err != nil {
			return err
		}
	}
	return nil
}

// createPendingChunk inserts pending eval rows for game indexes [start, end) in
// a single multi-row INSERT.
func (r *PostgresEngineEvalRepo) createPendingChunk(parent context.Context, userID, analysisID string, start, end int) error {
	ctx, cancel := dbContextFrom(parent)
	defer cancel()

	params := make([]interface{}, 0, (end-start)*4)
	valueClauses := make([]string, 0, end-start)
	for i := start; i < end; i++ {
		base := len(params)
		params = append(params, userID, analysisID, i, "pending")
		valueClauses = append(valueClauses, fmt.Sprintf("($%d, $%d, $%d, $%d)", base+1, base+2, base+3, base+4))
	}

	query := fmt.Sprintf(
		`INSERT INTO engine_evals (user_id, analysis_id, game_index, status) VALUES %s
		 ON CONFLICT (analysis_id, game_index) DO NOTHING`,
		strings.Join(valueClauses, ", "),
	)

	if _, err := r.pool.Exec(ctx, query, params...); err != nil {
		return fmt.Errorf("failed to create pending evals: %w", err)
	}
	return nil
}

// ClaimPending atomically claims up to limit pending engine evals, marking them
// 'processing' and returning the claimed rows. It uses FOR UPDATE SKIP LOCKED so
// that concurrent workers never claim the same row, replacing the previous
// GetPending+MarkProcessing TOCTOU pattern.
func (r *PostgresEngineEvalRepo) ClaimPending(parent context.Context, limit int) ([]models.EngineEval, error) {
	ctx, cancel := dbContextFrom(parent)
	defer cancel()

	rows, err := r.pool.Query(ctx,
		`UPDATE engine_evals SET status = 'processing', updated_at = $2
		 WHERE id IN (
		     SELECT id FROM engine_evals
		     WHERE status = 'pending'
		     ORDER BY created_at ASC
		     LIMIT $1
		     FOR UPDATE SKIP LOCKED
		 )
		 RETURNING id, user_id, analysis_id, game_index, status, created_at, updated_at`,
		limit, time.Now(),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to claim pending evals: %w", err)
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
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating claimed evals: %w", err)
	}
	return evals, nil
}

// GetPending returns up to limit pending engine evals without claiming them.
// The worker uses the atomic ClaimPending instead; GetPending remains for
// read-only callers (e.g. tests) that must not mutate row state.
func (r *PostgresEngineEvalRepo) GetPending(ctx context.Context, limit int) ([]models.EngineEval, error) {
	ctx, cancel := dbContext(ctx)
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
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating pending evals: %w", err)
	}
	return evals, nil
}

// MarkProcessing marks an engine eval as processing. The worker claims rows
// atomically via ClaimPending; MarkProcessing remains for non-worker callers.
func (r *PostgresEngineEvalRepo) MarkProcessing(ctx context.Context, id string) error {
	ctx, cancel := dbContext(ctx)
	defer cancel()

	_, err := r.pool.Exec(ctx,
		`UPDATE engine_evals SET status = 'processing', updated_at = $2 WHERE id = $1`,
		id, time.Now(),
	)
	if err != nil {
		return fmt.Errorf("failed to mark eval processing: %w", err)
	}
	return nil
}

// SaveEvals saves completed evaluations for an engine eval
func (r *PostgresEngineEvalRepo) SaveEvals(parent context.Context, id string, evals []models.ExplorerMoveStats) error {
	ctx, cancel := dbContextFrom(parent)
	defer cancel()

	evalsJSON, err := json.Marshal(evals)
	if err != nil {
		return fmt.Errorf("failed to marshal evals: %w", err)
	}

	_, err = r.pool.Exec(ctx,
		`UPDATE engine_evals SET status = 'done', evals = $2, updated_at = $3 WHERE id = $1`,
		id, evalsJSON, time.Now(),
	)
	if err != nil {
		return fmt.Errorf("failed to save evals: %w", err)
	}
	return nil
}

// MarkFailed marks an engine eval as failed
func (r *PostgresEngineEvalRepo) MarkFailed(parent context.Context, id string) error {
	ctx, cancel := dbContextFrom(parent)
	defer cancel()

	_, err := r.pool.Exec(ctx,
		`UPDATE engine_evals SET status = 'failed', updated_at = $2 WHERE id = $1`,
		id, time.Now(),
	)
	if err != nil {
		return fmt.Errorf("failed to mark eval failed: %w", err)
	}
	return nil
}

// ResetStaleProcessing resets any evals stuck in 'processing' back to 'pending'.
// This recovers from server crashes/restarts that interrupted in-flight evaluations.
// Returns the number of rows reset.
func (r *PostgresEngineEvalRepo) ResetStaleProcessing(parent context.Context) (int, error) {
	ctx, cancel := dbContextFrom(parent)
	defer cancel()

	tag, err := r.pool.Exec(ctx,
		`UPDATE engine_evals SET status = 'pending', updated_at = $1 WHERE status = 'processing'`,
		time.Now(),
	)
	if err != nil {
		return 0, fmt.Errorf("failed to reset stale processing evals: %w", err)
	}
	return int(tag.RowsAffected()), nil
}

// GetByUser returns all engine evals for a user
func (r *PostgresEngineEvalRepo) GetByUser(ctx context.Context, userID string) ([]models.EngineEval, error) {
	ctx, cancel := dbContext(ctx)
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
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating user evals: %w", err)
	}
	return evals, nil
}
