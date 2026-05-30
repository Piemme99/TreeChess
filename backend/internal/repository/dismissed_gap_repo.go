package repository

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
)

// DismissedGapRepo implements DismissedGapRepository
type DismissedGapRepo struct {
	pool *pgxpool.Pool
}

// NewDismissedGapRepo creates a new dismissed gap repository
func NewDismissedGapRepo(pool *pgxpool.Pool) *DismissedGapRepo {
	return &DismissedGapRepo{pool: pool}
}

// Dismiss marks a gap as dismissed for a user
func (r *DismissedGapRepo) Dismiss(ctx context.Context, userID, fen, opponentMove, repertoireID string) error {
	ctx, cancel := dbContext(ctx)
	defer cancel()

	query := `
		INSERT INTO dismissed_gaps (user_id, fen, opponent_move, repertoire_id)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (user_id, fen, opponent_move, repertoire_id) DO NOTHING
	`
	_, err := r.pool.Exec(ctx, query, userID, fen, opponentMove, repertoireID)
	if err != nil {
		return fmt.Errorf("failed to dismiss gap: %w", err)
	}
	return nil
}

// GetDismissed returns a map of dismissed gaps for a user
// The key is "fen|opponentMove|repertoireID"
func (r *DismissedGapRepo) GetDismissed(ctx context.Context, userID string) (map[string]bool, error) {
	ctx, cancel := dbContext(ctx)
	defer cancel()

	query := `SELECT fen, opponent_move, repertoire_id FROM dismissed_gaps WHERE user_id = $1`
	rows, err := r.pool.Query(ctx, query, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get dismissed gaps: %w", err)
	}
	defer rows.Close()

	dismissed := make(map[string]bool)
	for rows.Next() {
		var fen, opponentMove, repertoireID string
		if err := rows.Scan(&fen, &opponentMove, &repertoireID); err != nil {
			return nil, fmt.Errorf("failed to scan dismissed gap: %w", err)
		}
		key := fen + "|" + opponentMove + "|" + repertoireID
		dismissed[key] = true
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating dismissed gaps: %w", err)
	}

	return dismissed, nil
}
