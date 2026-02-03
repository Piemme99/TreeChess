package repository

import (
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
)

// DismissedMistakeRepo implements DismissedMistakeRepository
type DismissedMistakeRepo struct {
	pool *pgxpool.Pool
}

// NewDismissedMistakeRepo creates a new dismissed mistake repository
func NewDismissedMistakeRepo(pool *pgxpool.Pool) *DismissedMistakeRepo {
	return &DismissedMistakeRepo{pool: pool}
}

// Dismiss marks a mistake as dismissed for a user
func (r *DismissedMistakeRepo) Dismiss(userID, fen, playedMove string) error {
	ctx, cancel := dbContext()
	defer cancel()

	query := `
		INSERT INTO dismissed_mistakes (user_id, fen, played_move)
		VALUES ($1, $2, $3)
		ON CONFLICT (user_id, fen, played_move) DO NOTHING
	`
	_, err := r.pool.Exec(ctx, query, userID, fen, playedMove)
	if err != nil {
		return fmt.Errorf("failed to dismiss mistake: %w", err)
	}
	return nil
}

// GetDismissed returns a map of dismissed mistakes for a user
// The key is "fen|playedMove"
func (r *DismissedMistakeRepo) GetDismissed(userID string) (map[string]bool, error) {
	ctx, cancel := dbContext()
	defer cancel()

	query := `SELECT fen, played_move FROM dismissed_mistakes WHERE user_id = $1`
	rows, err := r.pool.Query(ctx, query, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get dismissed mistakes: %w", err)
	}
	defer rows.Close()

	dismissed := make(map[string]bool)
	for rows.Next() {
		var fen, playedMove string
		if err := rows.Scan(&fen, &playedMove); err != nil {
			return nil, fmt.Errorf("failed to scan dismissed mistake: %w", err)
		}
		key := fen + "|" + playedMove
		dismissed[key] = true
	}

	return dismissed, nil
}
