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
		RETURNING id, username, password_hash, oauth_provider, oauth_id, created_at
	`
	getUserByUsernameSQL = `
		SELECT id, username, password_hash, oauth_provider, oauth_id, created_at
		FROM users WHERE username = $1
	`
	getUserByIDSQL = `
		SELECT id, username, password_hash, oauth_provider, oauth_id, created_at
		FROM users WHERE id = $1
	`
	checkUserExistsSQL = `
		SELECT EXISTS(SELECT 1 FROM users WHERE username = $1)
	`
	findByOAuthSQL = `
		SELECT id, username, password_hash, oauth_provider, oauth_id, created_at
		FROM users WHERE oauth_provider = $1 AND oauth_id = $2
	`
	createOAuthUserSQL = `
		INSERT INTO users (id, username, oauth_provider, oauth_id)
		VALUES ($1, $2, $3, $4)
		RETURNING id, username, password_hash, oauth_provider, oauth_id, created_at
	`
)

type PostgresUserRepo struct {
	pool *pgxpool.Pool
}

func NewPostgresUserRepo(pool *pgxpool.Pool) *PostgresUserRepo {
	return &PostgresUserRepo{pool: pool}
}

func scanUser(scan func(dest ...any) error) (*models.User, error) {
	var user models.User
	var passwordHash *string
	err := scan(
		&user.ID, &user.Username, &passwordHash, &user.OAuthProvider, &user.OAuthID, &user.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	if passwordHash != nil {
		user.PasswordHash = *passwordHash
	}
	return &user, nil
}

func (r *PostgresUserRepo) Create(username, passwordHash string) (*models.User, error) {
	ctx, cancel := dbContext()
	defer cancel()

	id := uuid.New().String()
	user, err := scanUser(r.pool.QueryRow(ctx, createUserSQL, id, username, passwordHash).Scan)
	if err != nil {
		if isDuplicateKeyError(err) {
			return nil, ErrUsernameExists
		}
		return nil, fmt.Errorf("failed to create user: %w", err)
	}
	return user, nil
}

func (r *PostgresUserRepo) GetByUsername(username string) (*models.User, error) {
	ctx, cancel := dbContext()
	defer cancel()

	user, err := scanUser(r.pool.QueryRow(ctx, getUserByUsernameSQL, username).Scan)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrUserNotFound
		}
		return nil, fmt.Errorf("failed to get user by username: %w", err)
	}
	return user, nil
}

func (r *PostgresUserRepo) GetByID(id string) (*models.User, error) {
	ctx, cancel := dbContext()
	defer cancel()

	user, err := scanUser(r.pool.QueryRow(ctx, getUserByIDSQL, id).Scan)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrUserNotFound
		}
		return nil, fmt.Errorf("failed to get user by ID: %w", err)
	}
	return user, nil
}

func (r *PostgresUserRepo) FindByOAuth(provider, oauthID string) (*models.User, error) {
	ctx, cancel := dbContext()
	defer cancel()

	user, err := scanUser(r.pool.QueryRow(ctx, findByOAuthSQL, provider, oauthID).Scan)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrUserNotFound
		}
		return nil, fmt.Errorf("failed to find user by OAuth: %w", err)
	}
	return user, nil
}

func (r *PostgresUserRepo) CreateOAuth(provider, oauthID, username string) (*models.User, error) {
	ctx, cancel := dbContext()
	defer cancel()

	id := uuid.New().String()
	user, err := scanUser(r.pool.QueryRow(ctx, createOAuthUserSQL, id, username, provider, oauthID).Scan)
	if err != nil {
		if isDuplicateKeyError(err) {
			return nil, ErrUsernameExists
		}
		return nil, fmt.Errorf("failed to create OAuth user: %w", err)
	}
	return user, nil
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
