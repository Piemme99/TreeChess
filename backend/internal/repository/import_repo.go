package repository

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kumquat/backend/internal/models"
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
		RETURNING user_id, filename, uploaded_at
	`
	deleteGamesForAnalysisSQL = `
		DELETE FROM games WHERE analysis_id = $1
	`
	insertGameSQL = `
		INSERT INTO games (
			analysis_id, game_index, user_id, white, black, result, date,
			user_color, status, time_class, opening, source, synced,
			repertoire_id, repertoire_name, uploaded_at
		) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
	`
	// lockAnalysisResultsSQL reads the current results under a row-level lock so a
	// read-modify-write cycle cannot interleave with a concurrent writer. The
	// matching write must run inside the same transaction.
	lockAnalysisResultsSQL = `
		SELECT results
		FROM analyses
		WHERE id = $1
		FOR UPDATE
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

// Save saves a new analysis and its per-game projection in a single transaction.
func (r *PostgresAnalysisRepo) Save(ctx context.Context, userID string, username, filename string, gameCount int, results []models.GameAnalysis) (*models.AnalysisSummary, error) {
	ctx, cancel := dbContext(ctx)
	defer cancel()

	resultsJSON, err := json.Marshal(results)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal results: %w", err)
	}

	id := uuid.New()
	uploadedAt := time.Now()

	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var summary models.AnalysisSummary
	err = tx.QueryRow(ctx, saveAnalysisSQL,
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

	if err := rebuildGamesForAnalysis(ctx, tx, summary.ID, userID, filename, summary.UploadedAt, results); err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("failed to commit analysis: %w", err)
	}

	return &summary, nil
}

// GetAll returns all analysis summaries for a user
func (r *PostgresAnalysisRepo) GetAll(ctx context.Context, userID string) ([]models.AnalysisSummary, error) {
	ctx, cancel := dbContext(ctx)
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
func (r *PostgresAnalysisRepo) GetByID(ctx context.Context, id string) (*models.AnalysisDetail, error) {
	ctx, cancel := dbContext(ctx)
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
		if errors.Is(err, pgx.ErrNoRows) {
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
func (r *PostgresAnalysisRepo) Delete(ctx context.Context, id string) error {
	ctx, cancel := dbContext(ctx)
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

// GetAllGames returns a paginated, filtered slice of games for a user.
//
// Pagination and filtering are pushed into SQL against the denormalized `games`
// projection: each page reads at most `limit` rows and a single COUNT, so the
// work per request is bounded regardless of how many games the user has imported
// (no full-history JSONB unmarshal). The per-game "synced" flag — synced AND not
// yet viewed — is computed in SQL via a NOT EXISTS against viewed_games rather
// than materializing the whole viewed-games set in Go.
func (r *PostgresAnalysisRepo) GetAllGames(ctx context.Context, userID string, limit, offset int, timeClass, repertoire, source string, onlyNew bool) (*models.GamesResponse, error) {
	ctx, cancel := dbContext(ctx)
	defer cancel()

	// Build the shared WHERE clause once so the COUNT and the page query stay
	// in lockstep. $1 is always user_id; optional filters append further args.
	args := []any{userID}
	where := "g.user_id = $1"

	syncedExpr := "(g.synced AND NOT EXISTS (" +
		"SELECT 1 FROM viewed_games v " +
		"WHERE v.user_id = g.user_id AND v.analysis_id = g.analysis_id AND v.game_index = g.game_index))"

	if timeClass != "" {
		args = append(args, timeClass)
		where += fmt.Sprintf(" AND g.time_class = $%d", len(args))
	}
	if source != "" {
		args = append(args, source)
		where += fmt.Sprintf(" AND g.source = $%d", len(args))
	}
	if repertoire != "" {
		args = append(args, repertoire)
		where += fmt.Sprintf(" AND g.repertoire_id = $%d", len(args))
	}
	if onlyNew {
		// "New" games are synced and not yet viewed — the set the analyse
		// session steps through.
		where += " AND " + syncedExpr
	}

	var total int
	countSQL := "SELECT COUNT(*) FROM games g WHERE " + where
	if err := r.pool.QueryRow(ctx, countSQL, args...).Scan(&total); err != nil {
		return nil, fmt.Errorf("failed to count games: %w", err)
	}

	pageArgs := append([]any{}, args...)
	pageArgs = append(pageArgs, limit, offset)
	listSQL := fmt.Sprintf(`
		SELECT g.analysis_id, g.game_index, g.white, g.black, g.result, g.date,
		       g.user_color, g.status, g.time_class, g.opening, g.source,
		       %s AS synced, g.repertoire_id, g.repertoire_name, g.uploaded_at
		FROM games g
		WHERE %s
		ORDER BY g.uploaded_at DESC, g.analysis_id, g.game_index
		LIMIT $%d OFFSET $%d`,
		syncedExpr, where, len(pageArgs)-1, len(pageArgs))

	rows, err := r.pool.Query(ctx, listSQL, pageArgs...)
	if err != nil {
		return nil, fmt.Errorf("failed to query games: %w", err)
	}
	defer rows.Close()

	games := []models.GameSummary{}
	for rows.Next() {
		var g models.GameSummary
		var repertoireID, repertoireName *string
		if err := rows.Scan(
			&g.AnalysisID, &g.GameIndex, &g.White, &g.Black, &g.Result, &g.Date,
			&g.UserColor, &g.Status, &g.TimeClass, &g.Opening, &g.Source,
			&g.Synced, &repertoireID, &repertoireName, &g.ImportedAt,
		); err != nil {
			return nil, fmt.Errorf("failed to scan game: %w", err)
		}
		if repertoireID != nil {
			g.RepertoireID = *repertoireID
		}
		if repertoireName != nil {
			g.RepertoireName = *repertoireName
		}
		games = append(games, g)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating games: %w", err)
	}

	return &models.GamesResponse{
		Games:  games,
		Total:  total,
		Limit:  limit,
		Offset: offset,
	}, nil
}

// UpdateResults updates the results array of an existing analysis and rebuilds
// its per-game projection in the same transaction so `games` stays consistent.
func (r *PostgresAnalysisRepo) UpdateResults(ctx context.Context, analysisID string, results []models.GameAnalysis) error {
	ctx, cancel := dbContext(ctx)
	defer cancel()

	resultsJSON, err := json.Marshal(results)
	if err != nil {
		return fmt.Errorf("failed to marshal results: %w", err)
	}

	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var userID, filename string
	var uploadedAt time.Time
	err = tx.QueryRow(ctx, updateAnalysisResultsSQL, analysisID, resultsJSON, len(results)).
		Scan(&userID, &filename, &uploadedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrAnalysisNotFound
		}
		return fmt.Errorf("failed to update analysis results: %w", err)
	}

	if err := rebuildGamesForAnalysis(ctx, tx, analysisID, userID, filename, uploadedAt, results); err != nil {
		return err
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("failed to commit analysis update: %w", err)
	}

	return nil
}

// MutateResults applies mutate to an analysis's results under a row-level lock,
// then persists the new results — all within a single transaction.
//
// The read (FOR UPDATE) and the write share one transaction, so concurrent
// callers serialize on the row lock instead of racing a read-modify-write
// against a stale copy. This is what protects the results JSONB from lost
// updates when manual and auto re-analysis fire for the same analysis at once:
// each caller mutates the freshly-locked array, never an outdated snapshot.
//
// mutate receives the current results and returns the new results plus a
// changed flag. When changed is false the row is left untouched (no write, no
// game_count change) and the transaction still commits cleanly, releasing the
// lock. If mutate returns an error the transaction is rolled back.
func (r *PostgresAnalysisRepo) MutateResults(ctx context.Context, analysisID string, mutate ResultsMutator) error {
	ctx, cancel := dbContext(ctx)
	defer cancel()

	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	// Rollback is a no-op after a successful Commit, so deferring it
	// unconditionally is safe and guarantees the lock is released on any error
	// path (including panics).
	defer func() { _ = tx.Rollback(ctx) }()

	var resultsJSON []byte
	err = tx.QueryRow(ctx, lockAnalysisResultsSQL, analysisID).Scan(&resultsJSON)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrAnalysisNotFound
		}
		return fmt.Errorf("failed to lock analysis results: %w", err)
	}

	var current []models.GameAnalysis
	if err := json.Unmarshal(resultsJSON, &current); err != nil {
		return fmt.Errorf("failed to unmarshal results: %w", err)
	}

	updated, changed, err := mutate(current)
	if err != nil {
		return err
	}
	if !changed {
		// Nothing to persist; commit to release the row lock.
		if err := tx.Commit(ctx); err != nil {
			return fmt.Errorf("failed to commit transaction: %w", err)
		}
		return nil
	}

	updatedJSON, err := json.Marshal(updated)
	if err != nil {
		return fmt.Errorf("failed to marshal results: %w", err)
	}

	if _, err := tx.Exec(ctx, updateAnalysisResultsSQL, analysisID, updatedJSON, len(updated)); err != nil {
		return fmt.Errorf("failed to update analysis results: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	return nil
}

// BelongsToUser checks if an analysis belongs to a specific user
func (r *PostgresAnalysisRepo) BelongsToUser(ctx context.Context, id string, userID string) (bool, error) {
	ctx, cancel := dbContext(ctx)
	defer cancel()

	var belongs bool
	err := r.pool.QueryRow(ctx, belongsToUserAnalysisSQL, id, userID).Scan(&belongs)
	if err != nil {
		return false, fmt.Errorf("failed to check analysis ownership: %w", err)
	}
	return belongs, nil
}

// GetDistinctRepertoires returns a sorted list of distinct repertoires (id, name,
// color) referenced by a user's games. It reads the denormalized `games`
// projection with SQL DISTINCT/ORDER BY rather than scanning every analysis.
func (r *PostgresAnalysisRepo) GetDistinctRepertoires(ctx context.Context, userID string) ([]models.RepertoireFilterOption, error) {
	ctx, cancel := dbContext(ctx)
	defer cancel()

	rows, err := r.pool.Query(ctx, `
		SELECT DISTINCT repertoire_id, repertoire_name, user_color
		FROM games
		WHERE user_id = $1 AND repertoire_id IS NOT NULL
		ORDER BY repertoire_name, user_color`, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to query distinct repertoires: %w", err)
	}
	defer rows.Close()

	repertoires := []models.RepertoireFilterOption{}
	for rows.Next() {
		var opt models.RepertoireFilterOption
		var name *string
		if err := rows.Scan(&opt.ID, &name, &opt.Color); err != nil {
			return nil, fmt.Errorf("failed to scan repertoire option: %w", err)
		}
		if name != nil {
			opt.Name = *name
		}
		repertoires = append(repertoires, opt)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating distinct repertoires: %w", err)
	}

	return repertoires, nil
}

// MarkGameViewed marks a specific game as viewed by the user
func (r *PostgresAnalysisRepo) MarkGameViewed(ctx context.Context, userID, analysisID string, gameIndex int) error {
	ctx, cancel := dbContext(ctx)
	defer cancel()

	_, err := r.pool.Exec(ctx,
		`INSERT INTO viewed_games (user_id, analysis_id, game_index) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
		userID, analysisID, gameIndex,
	)
	if err != nil {
		return fmt.Errorf("failed to mark game as viewed: %w", err)
	}
	return nil
}

// GetViewedGames returns a set of "analysisID-gameIndex" keys for all viewed games of a user
func (r *PostgresAnalysisRepo) GetViewedGames(ctx context.Context, userID string) (map[string]bool, error) {
	ctx, cancel := dbContext(ctx)
	defer cancel()

	rows, err := r.pool.Query(ctx,
		`SELECT analysis_id, game_index FROM viewed_games WHERE user_id = $1`,
		userID,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to query viewed games: %w", err)
	}
	defer rows.Close()

	viewed := make(map[string]bool)
	for rows.Next() {
		var analysisID string
		var gameIndex int
		if err := rows.Scan(&analysisID, &gameIndex); err != nil {
			return nil, fmt.Errorf("failed to scan viewed game: %w", err)
		}
		viewed[fmt.Sprintf("%s-%d", analysisID, gameIndex)] = true
	}
	return viewed, rows.Err()
}

// GetAllGamesRaw returns all analyses with full game data for a user
func (r *PostgresAnalysisRepo) GetAllGamesRaw(ctx context.Context, userID string) ([]models.RawAnalysis, error) {
	ctx, cancel := dbContext(ctx)
	defer cancel()

	rows, err := r.pool.Query(ctx, getAllGamesSQL, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to query analyses: %w", err)
	}
	defer rows.Close()

	var analyses []models.RawAnalysis
	for rows.Next() {
		var a models.RawAnalysis
		var resultsJSON []byte

		if err := rows.Scan(&a.ID, &a.Filename, &resultsJSON, &a.UploadedAt); err != nil {
			return nil, fmt.Errorf("failed to scan analysis: %w", err)
		}

		if err := json.Unmarshal(resultsJSON, &a.Results); err != nil {
			return nil, fmt.Errorf("failed to unmarshal results: %w", err)
		}

		analyses = append(analyses, a)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating analyses: %w", err)
	}

	return analyses, nil
}

// classifySource derives the import source from the analysis filename
func classifySource(filename string) string {
	if strings.HasPrefix(filename, "sync_lichess_") || strings.HasPrefix(filename, "lichess_") {
		return "lichess"
	}
	if strings.HasPrefix(filename, "sync_chesscom_") || strings.HasPrefix(filename, "chesscom_") {
		return "chesscom"
	}
	return "pgn"
}

// isSynced returns true if the analysis was imported via automatic sync
func isSynced(filename string) bool {
	return strings.HasPrefix(filename, "sync_")
}

// computeGameStatus determines the overall status of a game based on the first actionable move
func computeGameStatus(game models.GameAnalysis) string {
	if game.MatchedRepertoire == nil && len(game.Moves) > 0 {
		return "new-opening"
	}
	for _, move := range game.Moves {
		if move.Status == "out-of-repertoire" {
			return "error"
		}
		if move.Status == "opponent-new" {
			return "new-line"
		}
	}
	return "in-repertoire"
}

// dbExecer is the subset of pgx behaviour shared by *pgxpool.Pool and pgx.Tx
// that rebuildGamesForAnalysis needs, so the rebuild can run inside a caller's
// transaction.
type dbExecer interface {
	Exec(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error)
}

// rebuildGamesForAnalysis replaces the `games` projection rows for one analysis.
// It deletes any existing rows for the analysis and inserts one row per game,
// deriving the denormalized filter columns from the existing helpers. It runs
// against the caller's transaction so the projection stays consistent with
// analyses.results.
func rebuildGamesForAnalysis(ctx context.Context, q dbExecer, analysisID, userID, filename string, uploadedAt time.Time, results []models.GameAnalysis) error {
	if _, err := q.Exec(ctx, deleteGamesForAnalysisSQL, analysisID); err != nil {
		return fmt.Errorf("failed to clear games projection: %w", err)
	}

	source := classifySource(filename)
	synced := isSynced(filename)

	for _, game := range results {
		var repertoireID, repertoireName *string
		if game.MatchedRepertoire != nil && game.MatchedRepertoire.ID != "" {
			id := game.MatchedRepertoire.ID
			name := game.MatchedRepertoire.Name
			repertoireID = &id
			repertoireName = &name
		}

		if _, err := q.Exec(ctx, insertGameSQL,
			analysisID,
			game.GameIndex,
			userID,
			game.Headers["White"],
			game.Headers["Black"],
			game.Headers["Result"],
			game.Headers["Date"],
			string(game.UserColor),
			computeGameStatus(game),
			models.ClassifyTimeControl(game.Headers["TimeControl"]),
			game.Headers["Opening"],
			source,
			synced,
			repertoireID,
			repertoireName,
			uploadedAt,
		); err != nil {
			return fmt.Errorf("failed to insert game projection row: %w", err)
		}
	}

	return nil
}
