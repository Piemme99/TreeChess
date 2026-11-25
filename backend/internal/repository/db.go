package repository

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kumquat/backend/config"
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

// dbContext derives a context with the default per-query timeout from the
// caller-supplied parent context. Deriving from the caller (rather than
// context.Background()) means an in-flight query is cancelled when the caller's
// context is cancelled — e.g. when an HTTP client disconnects or the background
// worker is shut down — while still bounding every query by DefaultDBTimeout.
func dbContext(ctx context.Context) (context.Context, context.CancelFunc) {
	return context.WithTimeout(ctx, config.DefaultDBTimeout)
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

	migrations := []string{
		`CREATE TABLE IF NOT EXISTS users (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			username VARCHAR(50) NOT NULL UNIQUE,
			oauth_provider VARCHAR(20),
			oauth_id VARCHAR(255),
			created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
			UNIQUE(oauth_provider, oauth_id)
		)`,
		`ALTER TABLE users ADD COLUMN IF NOT EXISTS lichess_username VARCHAR(50)`,
		`ALTER TABLE users ADD COLUMN IF NOT EXISTS lichess_access_token TEXT`,
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
		// Mark rotated tokens as consumed instead of hard-deleting them, so a replayed
		// (stolen) token can be distinguished from an unknown one and trigger family-wide
		// revocation. Consumed rows are purged on expiry.
		`ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS consumed BOOLEAN NOT NULL DEFAULT false`,
		// Shared cache for Lichess Opening Explorer responses; flattens upstream load
		// across all users so the rate-limit budget on individual user tokens is preserved.
		`CREATE TABLE IF NOT EXISTS opening_explorer_cache (
			cache_key  TEXT PRIMARY KEY,
			response   JSONB NOT NULL,
			expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
			created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
		)`,
		`CREATE INDEX IF NOT EXISTS idx_opening_explorer_cache_expires ON opening_explorer_cache(expires_at)`,
		// v2 : les parties du joueur importées de Lichess, réduites à ce que lit l'arbre des ouvertures.
		`CREATE TABLE IF NOT EXISTS played_games (
			user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			source VARCHAR(20) NOT NULL,
			source_id VARCHAR(40) NOT NULL,
			color VARCHAR(5) NOT NULL,
			moves TEXT NOT NULL,
			score REAL NOT NULL,
			rating INTEGER,
			played_at DATE NOT NULL,
			PRIMARY KEY (user_id, source, source_id)
		)`,
		`CREATE TABLE IF NOT EXISTS played_game_imports (
			user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
			status VARCHAR(10) NOT NULL,
			imported INTEGER NOT NULL DEFAULT 0,
			error TEXT,
			started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			finished_at TIMESTAMPTZ
		)`,
		// L'ordre d'arrivée garde stable le rang d'une partie quand un import suivant en ajoute le même jour.
		`ALTER TABLE played_games ADD COLUMN IF NOT EXISTS seq BIGSERIAL`,
		// Le jour du premier import réussi : le répertoire naît ce jour-là, les imports suivants n'y touchent pas.
		`ALTER TABLE played_game_imports ADD COLUMN IF NOT EXISTS first_done_at TIMESTAMPTZ`,
		`UPDATE played_game_imports SET first_done_at = finished_at WHERE first_done_at IS NULL AND status = 'done'`,
		// v2 : les décisions du joueur (ajouts, parties écartées, révision, lignes travaillées), une valeur JSON par clé.
		`CREATE TABLE IF NOT EXISTS player_state (
			user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
			state JSONB NOT NULL DEFAULT '{}',
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`,
		// Tables de la v1, supprimée : la mise en production exporte toute la base avant de démarrer ce backend.
		`DROP TABLE IF EXISTS games, viewed_games, engine_evals, game_fingerprints, dismissed_mistakes,
			dismissed_gaps, analyses, repertoires, categories CASCADE`,
		`DROP FUNCTION IF EXISTS check_repertoire_limit() CASCADE`,
		// Restes de la connexion par e-mail et de la synchro v1 : le déploiement qui les supprime exporte d'abord la base.
		`DROP TABLE IF EXISTS password_reset_tokens`,
		`DROP INDEX IF EXISTS idx_users_email`,
		`ALTER TABLE users DROP COLUMN IF EXISTS password_hash, DROP COLUMN IF EXISTS email,
			DROP COLUMN IF EXISTS password_changed_at, DROP COLUMN IF EXISTS chesscom_username,
			DROP COLUMN IF EXISTS last_lichess_sync_at, DROP COLUMN IF EXISTS last_chesscom_sync_at,
			DROP COLUMN IF EXISTS time_format_prefs`,
	}
	for _, m := range migrations {
		if _, err := conn.Exec(ctx, m); err != nil {
			return fmt.Errorf("failed to run migration: %w", err)
		}
	}

	slog.Info("database migrations completed")
	return nil
}
