package repository

import (
	"context"
	"time"

	"github.com/kumquat/backend/internal/models"
)

// UserRepository defines the interface for user data operations
type UserRepository interface {
	Create(ctx context.Context, email, username, passwordHash string) (*models.User, error)
	GetByUsername(ctx context.Context, username string) (*models.User, error)
	GetByEmail(ctx context.Context, email string) (*models.User, error)
	GetByID(ctx context.Context, id string) (*models.User, error)
	Exists(ctx context.Context, username string) (bool, error)
	EmailExists(ctx context.Context, email string) (bool, error)
	FindByOAuth(ctx context.Context, provider, oauthID string) (*models.User, error)
	CreateOAuth(ctx context.Context, provider, oauthID, username string) (*models.User, error)
	UpdateProfile(ctx context.Context, userID string, lichess, chesscom *string, timeFormatPrefs []string) (*models.User, error)
	UpdateLichessToken(ctx context.Context, userID, token string) error
	UpdatePassword(ctx context.Context, userID, passwordHash string) error
	Delete(ctx context.Context, id string) error
}

// OpeningExplorerCacheRepository persists Lichess Opening Explorer responses
// across users so a popular FEN is fetched from upstream at most once per
// TTL window.
type OpeningExplorerCacheRepository interface {
	Get(ctx context.Context, cacheKey string) (payload []byte, found bool, err error)
	Put(ctx context.Context, cacheKey string, payload []byte, expiresAt time.Time) error
	DeleteExpired(ctx context.Context) error
}

// RefreshTokenRepository defines the interface for refresh token operations
type RefreshTokenRepository interface {
	Create(ctx context.Context, userID, tokenHash string, expiresAt time.Time) (*models.RefreshToken, error)
	GetByTokenHash(ctx context.Context, tokenHash string) (*models.RefreshToken, error)
	MarkConsumed(ctx context.Context, id string) error
	Delete(ctx context.Context, id string) error
	DeleteByUserID(ctx context.Context, userID string) error
	DeleteExpired(ctx context.Context) error
	CountByUserID(ctx context.Context, userID string) (int, error)
}

// PasswordResetRepository defines the interface for password reset token operations
type PasswordResetRepository interface {
	Create(ctx context.Context, userID, tokenHash string, expiresAt time.Time) (*models.PasswordResetToken, error)
	GetByTokenHash(ctx context.Context, tokenHash string) (*models.PasswordResetToken, error)
	MarkUsed(ctx context.Context, id string) error
	DeleteByUserID(ctx context.Context, userID string) error
	DeleteExpired(ctx context.Context) error
	CountRecentByUserID(ctx context.Context, userID string, since time.Time) (int, error)
}
