package repository

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kumquat/backend/internal/models"
)

// Un import sans nouvelle depuis ce délai est tenu pour mort (serveur redémarré en route) : on peut le relancer.
const staleImportAfter = 5 * time.Minute

type PostgresPlayedGameRepo struct {
	pool *pgxpool.Pool
}

func NewPostgresPlayedGameRepo(pool *pgxpool.Pool) *PostgresPlayedGameRepo {
	return &PostgresPlayedGameRepo{pool: pool}
}

// SaveGames enregistre un lot de parties ; une partie déjà importée est laissée telle quelle.
func (r *PostgresPlayedGameRepo) SaveGames(ctx context.Context, userID string, games []models.PlayedGame) error {
	if len(games) == 0 {
		return nil
	}
	batch := &pgx.Batch{}
	for _, game := range games {
		batch.Queue(
			`INSERT INTO played_games (user_id, source, source_id, color, moves, score, rating, played_at)
			 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
			 ON CONFLICT (user_id, source, source_id) DO NOTHING`,
			userID, game.Source, game.SourceID, game.Color, game.Moves, game.Score, game.Rating, game.PlayedAt,
		)
	}
	if err := r.pool.SendBatch(ctx, batch).Close(); err != nil {
		return fmt.Errorf("save played games: %w", err)
	}
	return nil
}

func (r *PostgresPlayedGameRepo) ListGames(ctx context.Context, userID string) ([]models.PlayedGame, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT source, source_id, color, moves, score, rating, to_char(played_at, 'YYYY-MM-DD')
		 FROM played_games WHERE user_id = $1 ORDER BY played_at, source_id`,
		userID,
	)
	if err != nil {
		return nil, fmt.Errorf("list played games: %w", err)
	}
	defer rows.Close()
	games := []models.PlayedGame{}
	for rows.Next() {
		var game models.PlayedGame
		if err := rows.Scan(&game.Source, &game.SourceID, &game.Color, &game.Moves, &game.Score, &game.Rating, &game.PlayedAt); err != nil {
			return nil, fmt.Errorf("scan played game: %w", err)
		}
		games = append(games, game)
	}
	return games, rows.Err()
}

// GetImport rend l'état du dernier import, ou nil s'il n'y en a jamais eu.
func (r *PostgresPlayedGameRepo) GetImport(ctx context.Context, userID string) (*models.PlayedGameImport, error) {
	var state models.PlayedGameImport
	var message *string
	var updatedAt time.Time
	err := r.pool.QueryRow(ctx,
		`SELECT status, imported, error, started_at, updated_at, finished_at FROM played_game_imports WHERE user_id = $1`,
		userID,
	).Scan(&state.Status, &state.Imported, &message, &state.StartedAt, &updatedAt, &state.FinishedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("get played game import: %w", err)
	}
	if message != nil {
		state.Error = *message
	}
	if state.Status == models.PlayedGameImportRunning && time.Since(updatedAt) > staleImportAfter {
		state.Status = models.PlayedGameImportFailed
		state.Error = "the import stopped before the end"
	}
	return &state, nil
}

// StartImport passe l'import à « en cours » ; false si un import vivant tourne déjà.
func (r *PostgresPlayedGameRepo) StartImport(ctx context.Context, userID string) (bool, error) {
	tag, err := r.pool.Exec(ctx,
		`INSERT INTO played_game_imports (user_id, status, imported, started_at, updated_at)
		 VALUES ($1, 'running', 0, NOW(), NOW())
		 ON CONFLICT (user_id) DO UPDATE
		 SET status = 'running', imported = 0, error = NULL, started_at = NOW(), updated_at = NOW(), finished_at = NULL
		 WHERE played_game_imports.status <> 'running' OR played_game_imports.updated_at < NOW() - $2::interval`,
		userID, staleImportAfter.String(),
	)
	if err != nil {
		return false, fmt.Errorf("start played game import: %w", err)
	}
	return tag.RowsAffected() == 1, nil
}

func (r *PostgresPlayedGameRepo) UpdateProgress(ctx context.Context, userID string, imported int) error {
	if _, err := r.pool.Exec(ctx,
		`UPDATE played_game_imports SET imported = $2, updated_at = NOW() WHERE user_id = $1`,
		userID, imported,
	); err != nil {
		return fmt.Errorf("update played game import: %w", err)
	}
	return nil
}

func (r *PostgresPlayedGameRepo) FinishImport(ctx context.Context, userID string, imported int, failure string) error {
	status := models.PlayedGameImportDone
	var message *string
	if failure != "" {
		status = models.PlayedGameImportFailed
		message = &failure
	}
	if _, err := r.pool.Exec(ctx,
		`UPDATE played_game_imports SET status = $2, imported = $3, error = $4, updated_at = NOW(), finished_at = NOW() WHERE user_id = $1`,
		userID, status, imported, message,
	); err != nil {
		return fmt.Errorf("finish played game import: %w", err)
	}
	return nil
}
