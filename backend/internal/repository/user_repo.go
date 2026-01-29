package repository

import (
	"errors"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/treechess/backend/internal/models"
)

const (
	createUserSQL = `
		INSERT INTO users (id, username, password_hash)
		VALUES ($1, $2, $3)
		RETURNING id, username, password_hash, created_at
	`
	getUserByUsernameSQL = `
		SELECT id, username, password_hash, created_at
		FROM users WHERE username = $1
	`
	getUserByIDSQL = `
		SELECT id, username, password_hash, created_at
		FROM users WHERE id = $1
	`
	checkUserExistsSQL = `
		SELECT EXISTS(SELECT 1 FROM users WHERE username = $1)
	`
)

type PostgresUserRepo struct {
	pool *pgxpool.Pool
}

func NewPostgresUserRepo(pool *pgxpool.Pool) *PostgresUserRepo {
	return &PostgresUserRepo{pool: pool}
}

func (r *PostgresUserRepo) Create(username, passwordHash string) (*models.User, error) {
	ctx, cancel := dbContext()
	defer cancel()

	id := uuid.New().String()
	var user models.User
	err := r.pool.QueryRow(ctx, createUserSQL, id, username, passwordHash).Scan(
		&user.ID, &user.Username, &user.PasswordHash, &user.CreatedAt,
	)
	if err != nil {
		if isDuplicateKeyError(err) {
			return nil, ErrUsernameExists
		}
		return nil, fmt.Errorf("failed to create user: %w", err)
	}
	return &user, nil
}

func (r *PostgresUserRepo) GetByUsername(username string) (*models.User, error) {
	ctx, cancel := dbContext()
	defer cancel()

	var user models.User
	err := r.pool.QueryRow(ctx, getUserByUsernameSQL, username).Scan(
		&user.ID, &user.Username, &user.PasswordHash, &user.CreatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrUserNotFound
		}
		return nil, fmt.Errorf("failed to get user by username: %w", err)
	}
	return &user, nil
}

func (r *PostgresUserRepo) GetByID(id string) (*models.User, error) {
	ctx, cancel := dbContext()
	defer cancel()

	var user models.User
	err := r.pool.QueryRow(ctx, getUserByIDSQL, id).Scan(
		&user.ID, &user.Username, &user.PasswordHash, &user.CreatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrUserNotFound
		}
		return nil, fmt.Errorf("failed to get user by ID: %w", err)
	}
	return &user, nil
}

func (r *PostgresUserRepo) Exists(username string) (bool, error) {
	ctx, cancel := dbContext()
	defer cancel()

	var exists bool
	err := r.pool.QueryRow(ctx, checkUserExistsSQL, username).Scan(&exists)
	if err != nil {
		return false, fmt.Errorf("failed to check user existence: %w", err)
	}
	return exists, nil
}

// isDuplicateKeyError checks if the error is a PostgreSQL unique constraint violation
func isDuplicateKeyError(err error) bool {
	if err == nil {
		return false
	}
	errStr := err.Error()
	return strings.Contains(errStr, "23505") || strings.Contains(errStr, "duplicate key")
}
