package repository

import (
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kumquat/backend/internal/models"
)

const (
	refreshTokenColumns = `id, user_id, token_hash, expires_at, created_at, consumed`

	createRefreshTokenSQL = `
		INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at)
		VALUES ($1, $2, $3, $4)
		RETURNING ` + refreshTokenColumns

	getRefreshTokenByHashSQL = `
		SELECT ` + refreshTokenColumns + `
		FROM refresh_tokens
		WHERE token_hash = $1
	`

	markRefreshTokenConsumedSQL = `
		UPDATE refresh_tokens
		SET consumed = true
		WHERE id = $1
	`

	deleteRefreshTokenSQL = `
		DELETE FROM refresh_tokens
		WHERE id = $1
	`

	deleteRefreshTokensByUserSQL = `
		DELETE FROM refresh_tokens
		WHERE user_id = $1
	`

	deleteExpiredRefreshTokensSQL = `
		DELETE FROM refresh_tokens
		WHERE expires_at < NOW()
	`

	countRefreshTokensByUserSQL = `
		SELECT COUNT(*)
		FROM refresh_tokens
		WHERE user_id = $1
	`
)

type PostgresRefreshTokenRepo struct {
	pool *pgxpool.Pool
}

func NewPostgresRefreshTokenRepo(pool *pgxpool.Pool) *PostgresRefreshTokenRepo {
	return &PostgresRefreshTokenRepo{pool: pool}
}

func scanRefreshToken(scan func(dest ...any) error) (*models.RefreshToken, error) {
	var token models.RefreshToken
	err := scan(
		&token.ID, &token.UserID, &token.TokenHash,
		&token.ExpiresAt, &token.CreatedAt, &token.Consumed,
	)
	if err != nil {
		return nil, err
	}
	return &token, nil
}

func (r *PostgresRefreshTokenRepo) Create(userID, tokenHash string, expiresAt time.Time) (*models.RefreshToken, error) {
	ctx, cancel := dbContext()
	defer cancel()

	id := uuid.New().String()
	token, err := scanRefreshToken(r.pool.QueryRow(ctx, createRefreshTokenSQL, id, userID, tokenHash, expiresAt).Scan)
	if err != nil {
		return nil, fmt.Errorf("failed to create refresh token: %w", err)
	}
	return token, nil
}

func (r *PostgresRefreshTokenRepo) GetByTokenHash(tokenHash string) (*models.RefreshToken, error) {
	ctx, cancel := dbContext()
	defer cancel()

	token, err := scanRefreshToken(r.pool.QueryRow(ctx, getRefreshTokenByHashSQL, tokenHash).Scan)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrRefreshTokenNotFound
		}
		return nil, fmt.Errorf("failed to get refresh token: %w", err)
	}
	return token, nil
}

// MarkConsumed flags a refresh token as consumed during rotation. The row is
// retained (rather than deleted) so a replayed/stolen token can be detected and
// trigger family-wide revocation. Consumed rows are purged once expired.
func (r *PostgresRefreshTokenRepo) MarkConsumed(id string) error {
	ctx, cancel := dbContext()
	defer cancel()

	_, err := r.pool.Exec(ctx, markRefreshTokenConsumedSQL, id)
	if err != nil {
		return fmt.Errorf("failed to mark refresh token consumed: %w", err)
	}
	return nil
}

func (r *PostgresRefreshTokenRepo) Delete(id string) error {
	ctx, cancel := dbContext()
	defer cancel()

	_, err := r.pool.Exec(ctx, deleteRefreshTokenSQL, id)
	if err != nil {
		return fmt.Errorf("failed to delete refresh token: %w", err)
	}
	return nil
}

func (r *PostgresRefreshTokenRepo) DeleteByUserID(userID string) error {
	ctx, cancel := dbContext()
	defer cancel()

	_, err := r.pool.Exec(ctx, deleteRefreshTokensByUserSQL, userID)
	if err != nil {
		return fmt.Errorf("failed to delete refresh tokens for user: %w", err)
	}
	return nil
}

func (r *PostgresRefreshTokenRepo) DeleteExpired() error {
	ctx, cancel := dbContext()
	defer cancel()

	_, err := r.pool.Exec(ctx, deleteExpiredRefreshTokensSQL)
	if err != nil {
		return fmt.Errorf("failed to delete expired refresh tokens: %w", err)
	}
	return nil
}

func (r *PostgresRefreshTokenRepo) CountByUserID(userID string) (int, error) {
	ctx, cancel := dbContext()
	defer cancel()

	var count int
	err := r.pool.QueryRow(ctx, countRefreshTokensByUserSQL, userID).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("failed to count refresh tokens: %w", err)
	}
	return count, nil
}
