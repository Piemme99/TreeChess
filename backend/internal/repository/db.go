package repository

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kumquat/backend/config"
	"github.com/kumquat/backend/internal/models"
)

// DB wraps the database connection pool
type DB struct {
	Pool *pgxpool.Pool
}

// NewDB creates a new database connection and runs migrations
func NewDB(cfg config.Config) (*DB, error) {
	poolConfig, err := pgxpool.ParseConfig(cfg.DatabaseURL)
	if err != nil {
		return nil, fmt.Errorf("failed to parse database URL: %w", err)
	}

	// Connection pool tuning.
	// These values are sensible defaults for a small-to-medium workload.
	// They can still be overridden via DATABASE_URL query parameters
	// (e.g. ?pool_max_conns=10) since ParseConfig applies those first,
	// but explicit code values take precedence for clarity.
	poolConfig.MaxConns = 20                        // Default pgx: max(4, NumCPU). 20 gives headroom for concurrent requests.
	poolConfig.MinConns = 2                         // Default pgx: 0. Pre-warm 2 connections to avoid cold-start latency.
	poolConfig.MaxConnLifetime = 1 * time.Hour      // Default pgx: 1h. Recycle connections to pick up server config changes.
	poolConfig.MaxConnIdleTime = 15 * time.Minute   // Default pgx: 30m. Release idle connections faster to save server RAM.
	poolConfig.HealthCheckPeriod = 30 * time.Second // Default pgx: 1m. Detect broken connections sooner.

	pool, err := pgxpool.NewWithConfig(context.Background(), poolConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to create connection pool: %w", err)
	}

	slog.Info("database pool configured",
		"max_conns", poolConfig.MaxConns,
		"min_conns", poolConfig.MinConns,
		"max_conn_lifetime", poolConfig.MaxConnLifetime,
		"max_conn_idle_time", poolConfig.MaxConnIdleTime,
		"health_check_period", poolConfig.HealthCheckPeriod,
	)

	ctx, cancel := context.WithTimeout(context.Background(), config.DefaultDBTimeout)
	defer cancel()

	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	db := &DB{Pool: pool}

	if err := db.runMigrations(); err != nil {
		pool.Close()
		return nil, fmt.Errorf("failed to run migrations: %w", err)
	}

	return db, nil
}

// Close closes the database connection pool
func (db *DB) Close() {
	if db.Pool != nil {
		db.Pool.Close()
	}
}

// dbContext creates a context with default timeout for database operations
func dbContext() (context.Context, context.CancelFunc) {
	return context.WithTimeout(context.Background(), config.DefaultDBTimeout)
}

// migrationLockID is an arbitrary constant used as the PostgreSQL advisory lock key.
// This ensures only one instance runs migrations at a time.
const migrationLockID = 1001

func (db *DB) runMigrations() error {
	ctx, cancel := context.WithTimeout(context.Background(), config.MigrationDBTimeout)
	defer cancel()

	// Acquire advisory lock to prevent concurrent migrations.
	// We use a dedicated connection (not from pool) so the lock is held for
	// the duration of migrations and released when the connection closes.
	conn, err := db.Pool.Acquire(ctx)
	if err != nil {
		return fmt.Errorf("failed to acquire connection for migrations: %w", err)
	}
	defer conn.Release()

	if _, err := conn.Exec(ctx, "SELECT pg_advisory_lock($1)", migrationLockID); err != nil {
		return fmt.Errorf("failed to acquire migration lock: %w", err)
	}
	defer func() {
		_, _ = conn.Exec(ctx, "SELECT pg_advisory_unlock($1)", migrationLockID)
	}()

	schema := `
		-- Create users table
		CREATE TABLE IF NOT EXISTS users (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			username VARCHAR(50) NOT NULL UNIQUE,
			password_hash VARCHAR(255),
			oauth_provider VARCHAR(20),
			oauth_id VARCHAR(255),
			created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
			UNIQUE(oauth_provider, oauth_id)
		);

		-- Create repertoires table
		CREATE TABLE IF NOT EXISTS repertoires (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			user_id UUID NOT NULL REFERENCES users(id),
			name VARCHAR(100) NOT NULL DEFAULT 'Main Repertoire',
			color VARCHAR(5) NOT NULL CHECK (color IN ('white', 'black')),
			tree_data JSONB NOT NULL,
			metadata JSONB NOT NULL DEFAULT '{"totalNodes": 0, "totalMoves": 0, "deepestDepth": 0}',
			created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
			updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
		);

		-- Create analyses table
		CREATE TABLE IF NOT EXISTS analyses (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			user_id UUID NOT NULL REFERENCES users(id),
			username VARCHAR(255) NOT NULL,
			filename VARCHAR(255) NOT NULL,
			game_count INTEGER NOT NULL,
			results JSONB NOT NULL,
			uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
		);

		-- Create indexes
		CREATE INDEX IF NOT EXISTS idx_repertoires_user_id ON repertoires(user_id);
		CREATE INDEX IF NOT EXISTS idx_repertoires_color ON repertoires(color);
		CREATE INDEX IF NOT EXISTS idx_repertoires_updated ON repertoires(updated_at DESC);
		CREATE INDEX IF NOT EXISTS idx_repertoires_name ON repertoires(name);
		CREATE INDEX IF NOT EXISTS idx_analyses_user_id ON analyses(user_id);
		CREATE INDEX IF NOT EXISTS idx_analyses_username ON analyses(username);
		CREATE INDEX IF NOT EXISTS idx_analyses_uploaded ON analyses(uploaded_at DESC);
		-- Create function to enforce max 50 repertoires per user
		CREATE OR REPLACE FUNCTION check_repertoire_limit()
		RETURNS TRIGGER AS $$
		BEGIN
			-- Serialize concurrent inserts for the same user before counting.
			-- Without this, the COUNT(*) check below is a TOCTOU race: parallel
			-- transactions each read a stale count under 50 and all insert,
			-- overshooting the limit. The transaction-scoped advisory lock makes
			-- same-user inserts mutually exclusive and is released automatically
			-- at COMMIT/ROLLBACK. Different users hash to different keys, so they
			-- do not contend.
			PERFORM pg_advisory_xact_lock(hashtext('repertoire_limit:' || NEW.user_id::text));
			IF (SELECT COUNT(*) FROM repertoires WHERE user_id = NEW.user_id) >= 50 THEN
				RAISE EXCEPTION 'Maximum of 50 repertoires allowed';
			END IF;
			RETURN NEW;
		END;
		$$ LANGUAGE plpgsql;

		-- Drop trigger if it exists (for idempotency)
		DROP TRIGGER IF EXISTS repertoire_limit_trigger ON repertoires;

		-- Create trigger to enforce limit
		CREATE TRIGGER repertoire_limit_trigger
			BEFORE INSERT ON repertoires
			FOR EACH ROW EXECUTE FUNCTION check_repertoire_limit();
	`

	if _, err := conn.Exec(ctx, schema); err != nil {
		return fmt.Errorf("failed to execute schema: %w", err)
	}

	migrations := []string{
		`ALTER TABLE users ADD COLUMN IF NOT EXISTS lichess_username VARCHAR(50)`,
		`ALTER TABLE users ADD COLUMN IF NOT EXISTS chesscom_username VARCHAR(50)`,
		`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_lichess_sync_at TIMESTAMP WITH TIME ZONE`,
		`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_chesscom_sync_at TIMESTAMP WITH TIME ZONE`,
		`ALTER TABLE users ADD COLUMN IF NOT EXISTS lichess_access_token TEXT`,
		`CREATE TABLE IF NOT EXISTS game_fingerprints (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			user_id UUID NOT NULL REFERENCES users(id),
			fingerprint VARCHAR(512) NOT NULL,
			analysis_id UUID NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
			game_index INTEGER NOT NULL,
			created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
			UNIQUE(user_id, fingerprint)
		)`,
		`CREATE INDEX IF NOT EXISTS idx_game_fingerprints_user ON game_fingerprints(user_id)`,
		`CREATE INDEX IF NOT EXISTS idx_game_fingerprints_analysis ON game_fingerprints(analysis_id)`,
		`CREATE TABLE IF NOT EXISTS viewed_games (
			user_id UUID NOT NULL REFERENCES users(id),
			analysis_id UUID NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
			game_index INTEGER NOT NULL,
			viewed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
			PRIMARY KEY (user_id, analysis_id, game_index)
		)`,
		`CREATE TABLE IF NOT EXISTS engine_evals (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			user_id UUID NOT NULL REFERENCES users(id),
			analysis_id UUID NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
			game_index INTEGER NOT NULL,
			status VARCHAR(20) NOT NULL DEFAULT 'pending',
			evals JSONB,
			created_at TIMESTAMPTZ DEFAULT NOW(),
			updated_at TIMESTAMPTZ DEFAULT NOW(),
			UNIQUE(analysis_id, game_index)
		)`,
		`CREATE INDEX IF NOT EXISTS idx_engine_evals_user ON engine_evals(user_id)`,
		`CREATE INDEX IF NOT EXISTS idx_engine_evals_status ON engine_evals(status)`,
		`CREATE TABLE IF NOT EXISTS dismissed_mistakes (
			user_id UUID NOT NULL REFERENCES users(id),
			fen TEXT NOT NULL,
			played_move VARCHAR(10) NOT NULL,
			dismissed_at TIMESTAMPTZ DEFAULT NOW(),
			PRIMARY KEY (user_id, fen, played_move)
		)`,
		// Note: no single-column user_id index here — the (user_id, fen, played_move)
		// primary key already covers user_id-prefixed lookups. A separate index would
		// be redundant and only add write overhead. The historical idx_dismissed_mistakes_user
		// is dropped below for existing databases.
		`ALTER TABLE users ADD COLUMN IF NOT EXISTS time_format_prefs TEXT[] DEFAULT '{}'`,
		`ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(255)`,
		`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email) WHERE email IS NOT NULL`,
		`CREATE TABLE IF NOT EXISTS password_reset_tokens (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			token_hash VARCHAR(64) NOT NULL UNIQUE,
			expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
			used_at TIMESTAMP WITH TIME ZONE,
			created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
		)`,
		`CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user ON password_reset_tokens(user_id)`,
		`CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_hash ON password_reset_tokens(token_hash)`,
		`CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires ON password_reset_tokens(expires_at)`,
		// Categories table for grouping repertoires
		`CREATE TABLE IF NOT EXISTS categories (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			user_id UUID NOT NULL REFERENCES users(id),
			name VARCHAR(100) NOT NULL,
			color VARCHAR(5) NOT NULL CHECK (color IN ('white', 'black')),
			created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
			updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
			UNIQUE(user_id, name, color)
		)`,
		`CREATE INDEX IF NOT EXISTS idx_categories_user_id ON categories(user_id)`,
		`CREATE INDEX IF NOT EXISTS idx_categories_color ON categories(color)`,
		// Add category_id to repertoires with cascade delete
		`ALTER TABLE repertoires ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES categories(id) ON DELETE CASCADE`,
		`CREATE INDEX IF NOT EXISTS idx_repertoires_category ON repertoires(category_id)`,
		// Track when password was last changed for JWT invalidation
		`ALTER TABLE users ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMP WITH TIME ZONE`,
		// Dismissed opponent gaps
		`CREATE TABLE IF NOT EXISTS dismissed_gaps (
			user_id UUID NOT NULL REFERENCES users(id),
			fen TEXT NOT NULL,
			opponent_move VARCHAR(10) NOT NULL,
			repertoire_id UUID NOT NULL,
			dismissed_at TIMESTAMPTZ DEFAULT NOW(),
			PRIMARY KEY (user_id, fen, opponent_move, repertoire_id)
		)`,
		// Note: no single-column user_id index here — the
		// (user_id, fen, opponent_move, repertoire_id) primary key already covers
		// user_id-prefixed lookups, so a separate index would be redundant. The
		// historical idx_dismissed_gaps_user is dropped below for existing databases.
		// Add is_public column to repertoires (default false - private by default)
		`ALTER TABLE repertoires ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT false`,
		`CREATE INDEX IF NOT EXISTS idx_repertoires_is_public ON repertoires(is_public) WHERE is_public = true`,
		// Refresh tokens table for token rotation
		`CREATE TABLE IF NOT EXISTS refresh_tokens (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			token_hash VARCHAR(64) NOT NULL UNIQUE,
			expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
			created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
		)`,
		`CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id)`,
		`CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash ON refresh_tokens(token_hash)`,
		`CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires ON refresh_tokens(expires_at)`,
		// Add description column to repertoires
		`ALTER TABLE repertoires ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT ''`,
		// Track origin of imported repertoires (e.g. from Lichess studies)
		`ALTER TABLE repertoires ADD COLUMN IF NOT EXISTS origin_type VARCHAR(20)`,
		`ALTER TABLE repertoires ADD COLUMN IF NOT EXISTS origin_url TEXT`,
		`ALTER TABLE repertoires ADD COLUMN IF NOT EXISTS origin_creator VARCHAR(100)`,
		`CREATE INDEX IF NOT EXISTS idx_repertoires_origin_type ON repertoires(origin_type) WHERE origin_type IS NOT NULL`,
		// Shared cache for Lichess Opening Explorer responses; flattens upstream load
		// across all users so the rate-limit budget on individual user tokens is preserved.
		`CREATE TABLE IF NOT EXISTS opening_explorer_cache (
			cache_key  TEXT PRIMARY KEY,
			response   JSONB NOT NULL,
			expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
			created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
		)`,
		`CREATE INDEX IF NOT EXISTS idx_opening_explorer_cache_expires ON opening_explorer_cache(expires_at)`,
		// Drop redundant single-column user_id indexes. Each duplicates the leading
		// column of its table's composite primary key, so Postgres can already serve
		// user_id-prefixed lookups from the PK index; the standalone indexes only added
		// write overhead. Safe to drop on databases that never had them (IF EXISTS).
		`DROP INDEX IF EXISTS idx_dismissed_mistakes_user`,
		`DROP INDEX IF EXISTS idx_dismissed_gaps_user`,
		// Per-game projection of analyses.results. One row per game with the
		// filterable/sortable columns denormalized out of the JSONB blob so the
		// games listing can paginate and filter in SQL (LIMIT/OFFSET/WHERE) instead
		// of unmarshalling every analysis's full per-move history on every page.
		// analyses.results stays the source of truth for per-move detail; this table
		// is a derived projection kept in sync on every Save/UpdateResults.
		`CREATE TABLE IF NOT EXISTS games (
			analysis_id     UUID NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
			game_index      INTEGER NOT NULL,
			user_id         UUID NOT NULL REFERENCES users(id),
			white           TEXT,
			black           TEXT,
			result          TEXT,
			date            TEXT,
			user_color      TEXT,
			status          TEXT NOT NULL,
			time_class      TEXT NOT NULL,
			opening         TEXT,
			source          TEXT NOT NULL,
			synced          BOOLEAN NOT NULL,
			repertoire_id   UUID,
			repertoire_name TEXT,
			uploaded_at     TIMESTAMPTZ NOT NULL,
			PRIMARY KEY (analysis_id, game_index)
		)`,
		`CREATE INDEX IF NOT EXISTS idx_games_user_uploaded ON games(user_id, uploaded_at DESC, game_index)`,
		`CREATE INDEX IF NOT EXISTS idx_games_user_filters ON games(user_id, time_class, source, repertoire_id)`,
	}
	for _, m := range migrations {
		if _, err := conn.Exec(ctx, m); err != nil {
			return fmt.Errorf("failed to run migration: %w", err)
		}
	}

	if err := backfillGames(ctx, conn); err != nil {
		return fmt.Errorf("failed to backfill games table: %w", err)
	}

	slog.Info("database migrations completed")
	return nil
}

// gamesBackfillQuerier is the minimal pgx surface backfillGames needs. It is
// satisfied by the migration connection (*pgxpool.Conn) and lets the backfill
// both read analyses and feed rebuildGamesForAnalysis.
type gamesBackfillQuerier interface {
	dbExecer
	Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error)
}

// backfillGames populates the `games` projection from existing analyses the
// first time the table is empty. It is idempotent: once any games row exists it
// returns immediately, so it is a no-op on every boot after the initial one and
// on fresh installs that import through the (already projection-aware) write
// path. The CREATE TABLE migration leaves `games` empty, so no data is lost.
func backfillGames(ctx context.Context, conn gamesBackfillQuerier) error {
	var exists bool
	rows, err := conn.Query(ctx, `SELECT EXISTS(SELECT 1 FROM games)`)
	if err != nil {
		return fmt.Errorf("checking games emptiness: %w", err)
	}
	if rows.Next() {
		if err := rows.Scan(&exists); err != nil {
			rows.Close()
			return fmt.Errorf("scanning games emptiness: %w", err)
		}
	}
	rows.Close()
	if exists {
		return nil
	}

	analysisRows, err := conn.Query(ctx, `
		SELECT id, user_id, filename, results, uploaded_at
		FROM analyses
		ORDER BY uploaded_at`)
	if err != nil {
		return fmt.Errorf("querying analyses for backfill: %w", err)
	}

	type pending struct {
		id         string
		userID     string
		filename   string
		uploadedAt time.Time
		results    []models.GameAnalysis
	}
	var batch []pending
	for analysisRows.Next() {
		var p pending
		var resultsJSON []byte
		if err := analysisRows.Scan(&p.id, &p.userID, &p.filename, &resultsJSON, &p.uploadedAt); err != nil {
			analysisRows.Close()
			return fmt.Errorf("scanning analysis for backfill: %w", err)
		}
		if err := json.Unmarshal(resultsJSON, &p.results); err != nil {
			analysisRows.Close()
			return fmt.Errorf("unmarshalling analysis %s for backfill: %w", p.id, err)
		}
		batch = append(batch, p)
	}
	if err := analysisRows.Err(); err != nil {
		analysisRows.Close()
		return fmt.Errorf("iterating analyses for backfill: %w", err)
	}
	analysisRows.Close()

	for _, p := range batch {
		if err := rebuildGamesForAnalysis(ctx, conn, p.id, p.userID, p.filename, p.uploadedAt, p.results); err != nil {
			return fmt.Errorf("backfilling analysis %s: %w", p.id, err)
		}
	}

	if len(batch) > 0 {
		slog.Info("backfilled games projection", "analyses", len(batch))
	}
	return nil
}
