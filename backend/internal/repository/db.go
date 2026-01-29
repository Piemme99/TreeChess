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
		-- Drop all existing tables (destructive migration)
		DROP TABLE IF EXISTS video_positions, video_imports, analyses, repertoires, users CASCADE;

		-- Drop old functions/triggers
		DROP FUNCTION IF EXISTS check_repertoire_limit() CASCADE;

		-- Create users table
		CREATE TABLE IF NOT EXISTS users (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			username VARCHAR(50) NOT NULL UNIQUE,
			password_hash VARCHAR(255) NOT NULL,
			created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
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

		-- Create video_imports table
		CREATE TABLE IF NOT EXISTS video_imports (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			user_id UUID NOT NULL REFERENCES users(id),
			youtube_url VARCHAR(500) NOT NULL,
			youtube_id VARCHAR(20) NOT NULL,
			title VARCHAR(500) NOT NULL DEFAULT '',
			status VARCHAR(20) NOT NULL DEFAULT 'pending'
				CHECK (status IN ('pending','downloading','extracting','recognizing','building_tree','completed','failed')),
			progress INTEGER NOT NULL DEFAULT 0,
			error_message TEXT,
			total_frames INTEGER,
			processed_frames INTEGER DEFAULT 0,
			created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
			completed_at TIMESTAMP WITH TIME ZONE
		);

		-- Create video_positions table
		CREATE TABLE IF NOT EXISTS video_positions (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			video_import_id UUID NOT NULL REFERENCES video_imports(id) ON DELETE CASCADE,
			fen VARCHAR(100) NOT NULL,
			timestamp_seconds FLOAT NOT NULL,
			frame_index INTEGER NOT NULL,
			confidence FLOAT,
			created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
		);

		-- Create indexes
		CREATE INDEX IF NOT EXISTS idx_repertoires_user_id ON repertoires(user_id);
		CREATE INDEX IF NOT EXISTS idx_repertoires_color ON repertoires(color);
		CREATE INDEX IF NOT EXISTS idx_repertoires_updated ON repertoires(updated_at DESC);
		CREATE INDEX IF NOT EXISTS idx_repertoires_name ON repertoires(name);
		CREATE INDEX IF NOT EXISTS idx_analyses_user_id ON analyses(user_id);
		CREATE INDEX IF NOT EXISTS idx_analyses_username ON analyses(username);
		CREATE INDEX IF NOT EXISTS idx_analyses_uploaded ON analyses(uploaded_at DESC);
		CREATE INDEX IF NOT EXISTS idx_video_imports_user_id ON video_imports(user_id);
		CREATE INDEX IF NOT EXISTS idx_video_positions_fen ON video_positions(fen);
		CREATE INDEX IF NOT EXISTS idx_video_positions_video_id ON video_positions(video_import_id);
		CREATE INDEX IF NOT EXISTS idx_video_imports_youtube_id ON video_imports(youtube_id);

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

	log.Println("Database migrations completed successfully")
	return nil
}
