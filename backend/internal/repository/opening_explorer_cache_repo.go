package repository

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type PostgresOpeningExplorerCacheRepo struct {
	pool *pgxpool.Pool
}

func NewPostgresOpeningExplorerCacheRepo(pool *pgxpool.Pool) *PostgresOpeningExplorerCacheRepo {
	return &PostgresOpeningExplorerCacheRepo{pool: pool}
}

func (r *PostgresOpeningExplorerCacheRepo) Get(ctx context.Context, cacheKey string) ([]byte, bool, error) {
	var payload []byte
	err := r.pool.QueryRow(ctx,
		`SELECT response FROM opening_explorer_cache WHERE cache_key = $1 AND expires_at > NOW()`,
		cacheKey,
	).Scan(&payload)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, false, nil
	}
	if err != nil {
		return nil, false, fmt.Errorf("opening explorer cache get: %w", err)
	}
	return payload, true, nil
}

// DeleteExpired removes all cache entries whose TTL has elapsed. Used by the
// periodic cleanup worker so stale Opening Explorer payloads do not accumulate
// indefinitely.
func (r *PostgresOpeningExplorerCacheRepo) DeleteExpired(ctx context.Context) error {
	_, err := r.pool.Exec(ctx,
		`DELETE FROM opening_explorer_cache WHERE expires_at < NOW()`,
	)
	if err != nil {
		return fmt.Errorf("opening explorer cache delete expired: %w", err)
	}
	return nil
}

func (r *PostgresOpeningExplorerCacheRepo) Put(ctx context.Context, cacheKey string, payload []byte, expiresAt time.Time) error {
	_, err := r.pool.Exec(ctx,
		`INSERT INTO opening_explorer_cache (cache_key, response, expires_at)
		 VALUES ($1, $2, $3)
		 ON CONFLICT (cache_key) DO UPDATE
		   SET response = EXCLUDED.response,
		       expires_at = EXCLUDED.expires_at,
		       created_at = NOW()`,
		cacheKey, payload, expiresAt,
	)
	if err != nil {
		return fmt.Errorf("opening explorer cache put: %w", err)
	}
	return nil
}
