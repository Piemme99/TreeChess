package repository

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type PostgresPlayerStateRepo struct {
	pool *pgxpool.Pool
}

func NewPostgresPlayerStateRepo(pool *pgxpool.Pool) *PostgresPlayerStateRepo {
	return &PostgresPlayerStateRepo{pool: pool}
}

// Get rend toutes les valeurs du joueur, un objet vide s'il n'a encore rien enregistré.
func (r *PostgresPlayerStateRepo) Get(ctx context.Context, userID string) (json.RawMessage, error) {
	var state json.RawMessage
	err := r.pool.QueryRow(ctx, `SELECT state FROM player_state WHERE user_id = $1`, userID).Scan(&state)
	if errors.Is(err, pgx.ErrNoRows) {
		return json.RawMessage(`{}`), nil
	}
	if err != nil {
		return nil, fmt.Errorf("get player state: %w", err)
	}
	return state, nil
}

// Set remplace une seule clé : deux pages qui écrivent deux clés différentes ne s'écrasent pas.
func (r *PostgresPlayerStateRepo) Set(ctx context.Context, userID, key string, value json.RawMessage) error {
	if _, err := r.pool.Exec(ctx,
		`INSERT INTO player_state (user_id, state, updated_at) VALUES ($1, jsonb_build_object($2::text, $3::jsonb), NOW())
		 ON CONFLICT (user_id) DO UPDATE SET state = player_state.state || jsonb_build_object($2::text, $3::jsonb), updated_at = NOW()`,
		userID, key, string(value),
	); err != nil {
		return fmt.Errorf("set player state: %w", err)
	}
	return nil
}
