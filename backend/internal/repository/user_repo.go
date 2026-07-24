package repository

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kumquat/backend/config"
	"github.com/kumquat/backend/internal/crypto"
	"github.com/kumquat/backend/internal/models"
)

const (
	userColumns = `id, username, email, password_hash, oauth_provider, oauth_id, lichess_username, chesscom_username, lichess_access_token, last_lichess_sync_at, last_chesscom_sync_at, time_format_prefs, password_changed_at, created_at`

	createUserSQL = `
		INSERT INTO users (id, username, email, password_hash)
		VALUES ($1, $2, LOWER($3), $4)
		RETURNING ` + userColumns + `
	`
	getUserByUsernameSQL = `
		SELECT ` + userColumns + `
		FROM users WHERE username = $1
	`
	getUserByEmailSQL = `
		SELECT ` + userColumns + `
		FROM users WHERE LOWER(email) = LOWER($1)
	`
	getUserByIDSQL = `
		SELECT ` + userColumns + `
		FROM users WHERE id = $1
	`
	checkUserExistsSQL = `
		SELECT EXISTS(SELECT 1 FROM users WHERE username = $1)
	`
	checkEmailExistsSQL = `
		SELECT EXISTS(SELECT 1 FROM users WHERE LOWER(email) = LOWER($1))
	`
	findByOAuthSQL = `
		SELECT ` + userColumns + `
		FROM users WHERE oauth_provider = $1 AND oauth_id = $2
	`
	createOAuthUserSQL = `
		INSERT INTO users (id, username, oauth_provider, oauth_id, lichess_username)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING ` + userColumns + `
	`
	updateProfileSQL = `
		UPDATE users SET lichess_username = $2, chesscom_username = $3, time_format_prefs = $4
		WHERE id = $1
		RETURNING ` + userColumns + `
	`
	updateSyncTimestampsSQL = `
		UPDATE users SET last_lichess_sync_at = COALESCE($2, last_lichess_sync_at), last_chesscom_sync_at = COALESCE($3, last_chesscom_sync_at)
		WHERE id = $1
	`
	resetSyncTimestampsSQL = `
		UPDATE users SET last_lichess_sync_at = NULL, last_chesscom_sync_at = NULL
		WHERE id = $1
	`

	updateLichessTokenSQL = `
		UPDATE users SET lichess_access_token = $2
		WHERE id = $1
	`

	updatePasswordSQL = `
		UPDATE users SET password_hash = $2, password_changed_at = NOW()
		WHERE id = $1
	`

	// lichessTokenKeyInfo is the HKDF info label used to derive the AES key that
	// encrypts the Lichess access token at rest. It is intentionally distinct from
	// the OAuth cookie label so the two keys are independent (key separation).
	lichessTokenKeyInfo = "lichess-token-encryption"
)

type PostgresUserRepo struct {
	pool *pgxpool.Pool
	// encryptKey is the 32-byte AES-256 key used to encrypt the Lichess access
	// token before it is written, and to decrypt it after it is read.
	encryptKey []byte
}

// NewPostgresUserRepo builds a user repository. jwtSecret is used to derive the
// key that encrypts the stored Lichess access token at rest.
func NewPostgresUserRepo(pool *pgxpool.Pool, jwtSecret string) *PostgresUserRepo {
	key, err := crypto.DeriveKey(jwtSecret, lichessTokenKeyInfo)
	if err != nil {
		panic("failed to derive Lichess token encryption key: " + err.Error())
	}
	return &PostgresUserRepo{pool: pool, encryptKey: key}
}

func (r *PostgresUserRepo) scanUser(scan func(dest ...any) error) (*models.User, error) {
	var user models.User
	var passwordHash *string
	err := scan(
		&user.ID, &user.Username, &user.Email, &passwordHash, &user.OAuthProvider, &user.OAuthID,
		&user.LichessUsername, &user.ChesscomUsername, &user.LichessAccessToken,
		&user.LastLichessSyncAt, &user.LastChesscomSyncAt, &user.TimeFormatPrefs,
		&user.PasswordChangedAt, &user.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	if passwordHash != nil {
		user.PasswordHash = *passwordHash
	}
	if user.LichessAccessToken != nil {
		decrypted := r.decryptToken(*user.LichessAccessToken)
		user.LichessAccessToken = &decrypted
	}
	return &user, nil
}

// decryptToken returns the plaintext Lichess access token from its stored form.
// Tokens are stored AES-256-GCM encrypted (base64), but pre-existing rows may
// still hold a plaintext token from before encryption was introduced. If the
// stored value is not valid ciphertext, it is returned as-is; such rows get
// re-encrypted on the next UpdateLichessToken.
func (r *PostgresUserRepo) decryptToken(stored string) string {
	if stored == "" {
		return ""
	}
	plaintext, err := crypto.Decrypt(r.encryptKey, stored)
	if err != nil {
		return stored
	}
	return string(plaintext)
}

func (r *PostgresUserRepo) Create(ctx context.Context, email, username, passwordHash string) (*models.User, error) {
	ctx, cancel := dbContext(ctx)
	defer cancel()

	id := uuid.New().String()
	user, err := r.scanUser(r.pool.QueryRow(ctx, createUserSQL, id, username, email, passwordHash).Scan)
	if err != nil {
		if isDuplicateKeyError(err) {
			if isDuplicateEmailError(err) {
				return nil, ErrEmailExists
			}
			return nil, ErrUsernameExists
		}
		return nil, fmt.Errorf("failed to create user: %w", err)
	}
	return user, nil
}

func (r *PostgresUserRepo) GetByUsername(ctx context.Context, username string) (*models.User, error) {
	ctx, cancel := dbContext(ctx)
	defer cancel()

	user, err := r.scanUser(r.pool.QueryRow(ctx, getUserByUsernameSQL, username).Scan)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrUserNotFound
		}
		return nil, fmt.Errorf("failed to get user by username: %w", err)
	}
	return user, nil
}

func (r *PostgresUserRepo) GetByEmail(ctx context.Context, email string) (*models.User, error) {
	ctx, cancel := dbContext(ctx)
	defer cancel()

	user, err := r.scanUser(r.pool.QueryRow(ctx, getUserByEmailSQL, email).Scan)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrUserNotFound
		}
		return nil, fmt.Errorf("failed to get user by email: %w", err)
	}
	return user, nil
}

func (r *PostgresUserRepo) GetByID(ctx context.Context, id string) (*models.User, error) {
	ctx, cancel := dbContext(ctx)
	defer cancel()

	user, err := r.scanUser(r.pool.QueryRow(ctx, getUserByIDSQL, id).Scan)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrUserNotFound
		}
		return nil, fmt.Errorf("failed to get user by ID: %w", err)
	}
	return user, nil
}

func (r *PostgresUserRepo) FindByOAuth(ctx context.Context, provider, oauthID string) (*models.User, error) {
	ctx, cancel := dbContext(ctx)
	defer cancel()

	user, err := r.scanUser(r.pool.QueryRow(ctx, findByOAuthSQL, provider, oauthID).Scan)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrUserNotFound
		}
		return nil, fmt.Errorf("failed to find user by OAuth: %w", err)
	}
	return user, nil
}

func (r *PostgresUserRepo) CreateOAuth(ctx context.Context, provider, oauthID, username string) (*models.User, error) {
	ctx, cancel := dbContext(ctx)
	defer cancel()

	// For Lichess OAuth, auto-populate lichess_username
	var lichessUsername *string
	if provider == "lichess" {
		lichessUsername = &username
	}

	id := uuid.New().String()
	user, err := r.scanUser(r.pool.QueryRow(ctx, createOAuthUserSQL, id, username, provider, oauthID, lichessUsername).Scan)
	if err != nil {
		if isDuplicateKeyError(err) {
			if isDuplicateOAuthError(err) {
				// Concurrent creation for the same provider account (OAuth callback
				// double-submit): the account exists now, so return it instead of
				// misreporting a username conflict.
				return r.FindByOAuth(ctx, provider, oauthID)
			}
			return nil, ErrUsernameExists
		}
		return nil, fmt.Errorf("failed to create OAuth user: %w", err)
	}
	return user, nil
}

func (r *PostgresUserRepo) UpdateProfile(ctx context.Context, userID string, lichess, chesscom *string, timeFormatPrefs []string) (*models.User, error) {
	ctx, cancel := dbContext(ctx)
	defer cancel()

	user, err := r.scanUser(r.pool.QueryRow(ctx, updateProfileSQL, userID, lichess, chesscom, timeFormatPrefs).Scan)
	if err != nil {
		return nil, fmt.Errorf("failed to update profile: %w", err)
	}
	return user, nil
}

func (r *PostgresUserRepo) UpdateSyncTimestamps(ctx context.Context, userID string, lichessSyncAt, chesscomSyncAt *time.Time) error {
	ctx, cancel := dbContext(ctx)
	defer cancel()

	_, err := r.pool.Exec(ctx, updateSyncTimestampsSQL, userID, lichessSyncAt, chesscomSyncAt)
	if err != nil {
		return fmt.Errorf("failed to update sync timestamps: %w", err)
	}
	return nil
}

func (r *PostgresUserRepo) ResetSyncTimestamps(ctx context.Context, userID string) error {
	ctx, cancel := dbContext(ctx)
	defer cancel()

	_, err := r.pool.Exec(ctx, resetSyncTimestampsSQL, userID)
	if err != nil {
		return fmt.Errorf("failed to reset sync timestamps: %w", err)
	}
	return nil
}

func (r *PostgresUserRepo) UpdateLichessToken(ctx context.Context, userID, token string) error {
	ctx, cancel := dbContext(ctx)
	defer cancel()

	// Encrypt the token at rest. An empty token (e.g. on unlink) is stored as-is
	// so the column reads back empty without a spurious decrypt attempt.
	stored := token
	if token != "" {
		encrypted, err := crypto.Encrypt(r.encryptKey, []byte(token))
		if err != nil {
			return fmt.Errorf("failed to encrypt Lichess token: %w", err)
		}
		stored = encrypted
	}

	_, err := r.pool.Exec(ctx, updateLichessTokenSQL, userID, stored)
	if err != nil {
		return fmt.Errorf("failed to update Lichess token: %w", err)
	}
	return nil
}

func (r *PostgresUserRepo) Exists(ctx context.Context, username string) (bool, error) {
	ctx, cancel := dbContext(ctx)
	defer cancel()

	var exists bool
	err := r.pool.QueryRow(ctx, checkUserExistsSQL, username).Scan(&exists)
	if err != nil {
		return false, fmt.Errorf("failed to check user existence: %w", err)
	}
	return exists, nil
}

func (r *PostgresUserRepo) EmailExists(ctx context.Context, email string) (bool, error) {
	ctx, cancel := dbContext(ctx)
	defer cancel()

	var exists bool
	err := r.pool.QueryRow(ctx, checkEmailExistsSQL, email).Scan(&exists)
	if err != nil {
		return false, fmt.Errorf("failed to check email existence: %w", err)
	}
	return exists, nil
}

func (r *PostgresUserRepo) UpdatePassword(ctx context.Context, userID, passwordHash string) error {
	ctx, cancel := dbContext(ctx)
	defer cancel()

	_, err := r.pool.Exec(ctx, updatePasswordSQL, userID, passwordHash)
	if err != nil {
		return fmt.Errorf("failed to update password: %w", err)
	}
	return nil
}

func (r *PostgresUserRepo) Delete(ctx context.Context, id string) error {
	ctx, cancel := context.WithTimeout(ctx, config.UserDeleteDBTimeout)
	defer cancel()

	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	// Delete in order respecting FK constraints (no ON DELETE CASCADE on user_id)
	// 1. dismissed_mistakes (leaf table, only references users)
	if _, err := tx.Exec(ctx, `DELETE FROM dismissed_mistakes WHERE user_id = $1`, id); err != nil {
		return fmt.Errorf("failed to delete dismissed_mistakes: %w", err)
	}

	// 2. dismissed_gaps (leaf table, only references users)
	if _, err := tx.Exec(ctx, `DELETE FROM dismissed_gaps WHERE user_id = $1`, id); err != nil {
		return fmt.Errorf("failed to delete dismissed_gaps: %w", err)
	}

	// 3. analyses (cascades to game_fingerprints, viewed_games, engine_evals via analysis_id FK)
	if _, err := tx.Exec(ctx, `DELETE FROM analyses WHERE user_id = $1`, id); err != nil {
		return fmt.Errorf("failed to delete analyses: %w", err)
	}

	// 4. repertoires (references users and categories)
	if _, err := tx.Exec(ctx, `DELETE FROM repertoires WHERE user_id = $1`, id); err != nil {
		return fmt.Errorf("failed to delete repertoires: %w", err)
	}

	// 5. categories (references users; repertoires already deleted)
	if _, err := tx.Exec(ctx, `DELETE FROM categories WHERE user_id = $1`, id); err != nil {
		return fmt.Errorf("failed to delete categories: %w", err)
	}

	// 6. user row (password_reset_tokens cascade automatically via ON DELETE CASCADE)
	result, err := tx.Exec(ctx, `DELETE FROM users WHERE id = $1`, id)
	if err != nil {
		return fmt.Errorf("failed to delete user: %w", err)
	}
	if result.RowsAffected() == 0 {
		return ErrUserNotFound
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	return nil
}

// pgUniqueViolation is the SQLSTATE code for a unique-constraint violation.
const pgUniqueViolation = "23505"

// isDuplicateKeyError checks if the error is a PostgreSQL unique constraint violation.
// It uses errors.As to unwrap to the structured *pgconn.PgError and branches on the
// SQLSTATE code rather than matching on (locale-dependent) error text.
func isDuplicateKeyError(err error) bool {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		return pgErr.Code == pgUniqueViolation
	}
	return false
}

// isDuplicateEmailError checks if the duplicate key error is specifically for the
// email field by inspecting the violated constraint name (idx_users_email).
func isDuplicateEmailError(err error) bool {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		return pgErr.ConstraintName == "idx_users_email"
	}
	return false
}

// isDuplicateOAuthError checks if the duplicate key error is for the
// UNIQUE(oauth_provider, oauth_id) constraint on users.
func isDuplicateOAuthError(err error) bool {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		return pgErr.ConstraintName == "users_oauth_provider_oauth_id_key"
	}
	return false
}
