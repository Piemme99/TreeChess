package repository

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/treechess/backend/config"
)

// DefaultTimeout for database operations
const DefaultTimeout = 5 * time.Second

var pool *pgxpool.Pool

func InitDB(cfg config.Config) error {
	var err error
	pool, err = pgxpool.New(context.Background(), cfg.DatabaseURL)
	if err != nil {
		return fmt.Errorf("failed to create connection pool: %w", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), DefaultTimeout)
	defer cancel()

	if err := pool.Ping(ctx); err != nil {
		return fmt.Errorf("failed to ping database: %w", err)
	}

	if err := runMigrations(); err != nil {
		return fmt.Errorf("failed to run migrations: %w", err)
	}

	return nil
}

func runMigrations() error {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// Create tables if they don't exist
	schema := `
		-- Create repertoires table
		CREATE TABLE IF NOT EXISTS repertoires (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
			username VARCHAR(255) NOT NULL,
			filename VARCHAR(255) NOT NULL,
			game_count INTEGER NOT NULL,
			results JSONB NOT NULL,
			uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
		);

		-- Create indexes if they don't exist
		CREATE INDEX IF NOT EXISTS idx_repertoires_color ON repertoires(color);
		CREATE INDEX IF NOT EXISTS idx_repertoires_updated ON repertoires(updated_at DESC);
		CREATE INDEX IF NOT EXISTS idx_repertoires_name ON repertoires(name);
		CREATE INDEX IF NOT EXISTS idx_analyses_username ON analyses(username);
		CREATE INDEX IF NOT EXISTS idx_analyses_uploaded ON analyses(uploaded_at DESC);

		-- Create function to enforce max 50 repertoires
		CREATE OR REPLACE FUNCTION check_repertoire_limit()
		RETURNS TRIGGER AS $$
		BEGIN
			IF (SELECT COUNT(*) FROM repertoires) >= 50 THEN
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

	_, err := pool.Exec(ctx, schema)
	if err != nil {
		return fmt.Errorf("failed to execute schema: %w", err)
	}

	log.Println("Database migrations completed successfully")
	return nil
}

func GetPool() *pgxpool.Pool {
	return pool
}

func CloseDB() {
	if pool != nil {
		pool.Close()
	}
}

// dbContext creates a context with default timeout for database operations
func dbContext() (context.Context, context.CancelFunc) {
	return context.WithTimeout(context.Background(), DefaultTimeout)
}
