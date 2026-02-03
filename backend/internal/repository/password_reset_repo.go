package repository

import (
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/treechess/backend/internal/models"
)

const (
	passwordResetColumns = `id, user_id, token_hash, expires_at, used_at, created_at`

	createPasswordResetSQL = `
		INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at)
		VALUES ($1, $2, $3, $4)
		RETURNING ` + passwordResetColumns

	getPasswordResetByHashSQL = `
		SELECT ` + passwordResetColumns + `
		FROM password_reset_tokens
		WHERE token_hash = $1
	`

	markPasswordResetUsedSQL = `
		UPDATE password_reset_tokens
		SET used_at = NOW()
		WHERE id = $1
	`

	deletePasswordResetByUserSQL = `
		DELETE FROM password_reset_tokens
		WHERE user_id = $1
	`

	countRecentPasswordResetSQL = `
		SELECT COUNT(*)
		FROM password_reset_tokens
		WHERE user_id = $1 AND created_at >= $2
	`
)

type PostgresPasswordResetRepo struct {
	pool *pgxpool.Pool
}

func NewPostgresPasswordResetRepo(pool *pgxpool.Pool) *PostgresPasswordResetRepo {
	return &PostgresPasswordResetRepo{pool: pool}
}

func scanPasswordResetToken(scan func(dest ...any) error) (*models.PasswordResetToken, error) {
	var token models.PasswordResetToken
	err := scan(
		&token.ID, &token.UserID, &token.TokenHash,
		&token.ExpiresAt, &token.UsedAt, &token.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &token, nil
}

func (r *PostgresPasswordResetRepo) Create(userID, tokenHash string, expiresAt time.Time) (*models.PasswordResetToken, error) {
	ctx, cancel := dbContext()
	defer cancel()

	id := uuid.New().String()
	token, err := scanPasswordResetToken(r.pool.QueryRow(ctx, createPasswordResetSQL, id, userID, tokenHash, expiresAt).Scan)
	if err != nil {
		return nil, fmt.Errorf("failed to create password reset token: %w", err)
	}
	return token, nil
}

func (r *PostgresPasswordResetRepo) GetByTokenHash(tokenHash string) (*models.PasswordResetToken, error) {
	ctx, cancel := dbContext()
	defer cancel()

	token, err := scanPasswordResetToken(r.pool.QueryRow(ctx, getPasswordResetByHashSQL, tokenHash).Scan)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrResetTokenNotFound
		}
		return nil, fmt.Errorf("failed to get password reset token: %w", err)
	}
	return token, nil
}

func (r *PostgresPasswordResetRepo) MarkUsed(id string) error {
	ctx, cancel := dbContext()
	defer cancel()

	_, err := r.pool.Exec(ctx, markPasswordResetUsedSQL, id)
	if err != nil {
		return fmt.Errorf("failed to mark password reset token as used: %w", err)
	}
	return nil
}

func (r *PostgresPasswordResetRepo) DeleteByUserID(userID string) error {
	ctx, cancel := dbContext()
	defer cancel()

	_, err := r.pool.Exec(ctx, deletePasswordResetByUserSQL, userID)
	if err != nil {
		return fmt.Errorf("failed to delete password reset tokens: %w", err)
	}
	return nil
}

func (r *PostgresPasswordResetRepo) CountRecentByUserID(userID string, since time.Time) (int, error) {
	ctx, cancel := dbContext()
	defer cancel()

	var count int
	err := r.pool.QueryRow(ctx, countRecentPasswordResetSQL, userID, since).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("failed to count recent password reset tokens: %w", err)
	}
	return count, nil
}
