package repository

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"strings"

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
	updateLichessTokenSQL = `
		UPDATE users SET lichess_access_token = $2
		WHERE id = $1
	`
	selectStoredLichessTokensSQL = `
		SELECT id, lichess_access_token FROM users
		WHERE lichess_access_token IS NOT NULL AND lichess_access_token <> ''
	`
	replaceLichessTokenSQL = `
		UPDATE users SET lichess_access_token = $3
		WHERE id = $1 AND lichess_access_token = $2
	`

	// lichessOAuthTokenPrefix starts every access token Lichess issues through
	// OAuth: it tells a legacy plaintext token from an unreadable ciphertext.
	lichessOAuthTokenPrefix = "lio_"

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

func (r *PostgresUserRepo) scanUser(ctx context.Context, scan func(dest ...any) error) (*models.User, error) {
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
		stored := *user.LichessAccessToken
		token, err := r.decryptToken(stored)
		if err != nil {
			slog.Error("stored Lichess token does not decrypt, unlinking it", "user_id", user.ID, "error", err)
			r.clearLichessToken(ctx, user.ID, stored)
			user.LichessAccessToken = nil
		} else {
			user.LichessAccessToken = &token
		}
	}
	return &user, nil
}

// decryptToken returns the plaintext Lichess access token from its stored form
// (AES-256-GCM, base64). A value that does not decrypt is an error, never
// returned as-is: it is either a legacy plaintext token or a ciphertext under
// another key.
func (r *PostgresUserRepo) decryptToken(stored string) (string, error) {
	if stored == "" {
		return "", nil
	}
	plaintext, err := crypto.Decrypt(r.encryptKey, stored)
	if err != nil {
		return "", err
	}
	return string(plaintext), nil
}

// clearLichessToken unlinks a token that no longer decrypts. It only clears the
// value that was read, so a token re-linked in the meantime survives.
func (r *PostgresUserRepo) clearLichessToken(ctx context.Context, userID, stored string) {
	if _, err := r.pool.Exec(ctx, replaceLichessTokenSQL, userID, stored, nil); err != nil {
		slog.Error("failed to clear undecryptable Lichess token", "user_id", userID, "error", err)
	}
}

// migrateStoredToken decides what a stored token becomes at startup. A value
// that decrypts is kept (changed is false). A plaintext Lichess OAuth token
// (prefix lio_) is encrypted. Anything else is cleared (replacement nil): it is
// most likely a ciphertext under a previous key, which nothing can recover.
func (r *PostgresUserRepo) migrateStoredToken(stored string) (replacement *string, changed bool, err error) {
	if _, err := r.decryptToken(stored); err == nil {
		return nil, false, nil
	}
	if !strings.HasPrefix(stored, lichessOAuthTokenPrefix) {
		return nil, true, nil
	}
	encrypted, err := crypto.Encrypt(r.encryptKey, []byte(stored))
	if err != nil {
		return nil, false, fmt.Errorf("failed to encrypt Lichess token: %w", err)
	}
	return &encrypted, true, nil
}

// EncryptLegacyLichessTokens encrypts the Lichess tokens still stored in
// plaintext and clears those that cannot be decrypted. It runs at startup and
// is idempotent: rows already encrypted under the current key are left alone,
// so an interrupted run is finished by the next one.
func (r *PostgresUserRepo) EncryptLegacyLichessTokens(ctx context.Context) error {
	ctx, cancel := context.WithTimeout(ctx, config.MigrationDBTimeout)
	defer cancel()

	rows, err := r.pool.Query(ctx, selectStoredLichessTokensSQL)
	if err != nil {
		return fmt.Errorf("failed to list stored Lichess tokens: %w", err)
	}
	type storedToken struct{ userID, value string }
	tokens, err := pgx.CollectRows(rows, func(row pgx.CollectableRow) (storedToken, error) {
		var t storedToken
		err := row.Scan(&t.userID, &t.value)
		return t, err
	})
	if err != nil {
		return fmt.Errorf("failed to read stored Lichess tokens: %w", err)
	}

	encrypted, cleared := 0, 0
	for _, t := range tokens {
		replacement, changed, err := r.migrateStoredToken(t.value)
		if err != nil {
			return err
		}
		if !changed {
			continue
		}
		tag, err := r.pool.Exec(ctx, replaceLichessTokenSQL, t.userID, t.value, replacement)
		if err != nil {
			return fmt.Errorf("failed to rewrite stored Lichess token: %w", err)
		}
		if tag.RowsAffected() == 0 {
			continue
		}
		if replacement == nil {
			cleared++
			slog.Error("cleared a stored Lichess token that does not decrypt", "user_id", t.userID)
		} else {
			encrypted++
		}
	}
	if encrypted > 0 || cleared > 0 {
		slog.Info("stored Lichess tokens migrated", "encrypted", encrypted, "cleared", cleared)
	}
	return nil
}

func (r *PostgresUserRepo) Create(ctx context.Context, email, username, passwordHash string) (*models.User, error) {
	ctx, cancel := dbContext(ctx)
	defer cancel()

	id := uuid.New().String()
	user, err := r.scanUser(ctx, r.pool.QueryRow(ctx, createUserSQL, id, username, email, passwordHash).Scan)
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

	user, err := r.scanUser(ctx, r.pool.QueryRow(ctx, getUserByUsernameSQL, username).Scan)
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

	user, err := r.scanUser(ctx, r.pool.QueryRow(ctx, getUserByEmailSQL, email).Scan)
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

	user, err := r.scanUser(ctx, r.pool.QueryRow(ctx, getUserByIDSQL, id).Scan)
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

	user, err := r.scanUser(ctx, r.pool.QueryRow(ctx, findByOAuthSQL, provider, oauthID).Scan)
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
	user, err := r.scanUser(ctx, r.pool.QueryRow(ctx, createOAuthUserSQL, id, username, provider, oauthID, lichessUsername).Scan)
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

	user, err := r.scanUser(ctx, r.pool.QueryRow(ctx, updateProfileSQL, userID, lichess, chesscom, timeFormatPrefs).Scan)
	if err != nil {
		return nil, fmt.Errorf("failed to update profile: %w", err)
	}
	return user, nil
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

	// Les jetons et les tables v2 (parties, état du joueur) partent en cascade.
	result, err := r.pool.Exec(ctx, `DELETE FROM users WHERE id = $1`, id)
	if err != nil {
		return fmt.Errorf("failed to delete user: %w", err)
	}
	if result.RowsAffected() == 0 {
		return ErrUserNotFound
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
