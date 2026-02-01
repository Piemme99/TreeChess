package repository

import (
	"context"
	"fmt"
	"log"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/treechess/backend/config"
)

// DB wraps the database connection pool
type DB struct {
	Pool *pgxpool.Pool
}

// NewDB creates a new database connection and runs migrations
func NewDB(cfg config.Config) (*DB, error) {
	pool, err := pgxpool.New(context.Background(), cfg.DatabaseURL)
	if err != nil {
		return nil, fmt.Errorf("failed to create connection pool: %w", err)
	}

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

func (db *DB) runMigrations() error {
	ctx, cancel := context.WithTimeout(context.Background(), config.MigrationDBTimeout)
	defer cancel()

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

	_, err := db.Pool.Exec(ctx, schema)
	if err != nil {
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
	}
	for _, m := range migrations {
		if _, err := db.Pool.Exec(ctx, m); err != nil {
			return fmt.Errorf("failed to run migration: %w", err)
		}
	}

	log.Println("Database migrations completed successfully")
	return nil
}
