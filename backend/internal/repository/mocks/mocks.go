package mocks

import (
	"context"
	"time"

	"github.com/kumquat/backend/internal/models"
	"github.com/kumquat/backend/internal/repository"
)

// --- Repository mocks ---

// MockUserRepo is a mock implementation of UserRepository for testing
type MockUserRepo struct {
	CreateFunc             func(ctx context.Context, email, username, passwordHash string) (*models.User, error)
	GetByUsernameFunc      func(ctx context.Context, username string) (*models.User, error)
	GetByEmailFunc         func(ctx context.Context, email string) (*models.User, error)
	GetByIDFunc            func(ctx context.Context, id string) (*models.User, error)
	ExistsFunc             func(ctx context.Context, username string) (bool, error)
	EmailExistsFunc        func(ctx context.Context, email string) (bool, error)
	FindByOAuthFunc        func(ctx context.Context, provider, oauthID string) (*models.User, error)
	CreateOAuthFunc        func(ctx context.Context, provider, oauthID, username string) (*models.User, error)
	UpdateProfileFunc      func(ctx context.Context, userID string, lichess, chesscom *string, timeFormatPrefs []string) (*models.User, error)
	UpdateLichessTokenFunc func(ctx context.Context, userID, token string) error
	UpdatePasswordFunc     func(ctx context.Context, userID, passwordHash string) error
	DeleteFunc             func(ctx context.Context, id string) error
}

func (m *MockUserRepo) Create(ctx context.Context, email, username, passwordHash string) (*models.User, error) {
	if m.CreateFunc != nil {
		return m.CreateFunc(ctx, email, username, passwordHash)
	}
	return nil, nil
}

func (m *MockUserRepo) GetByUsername(ctx context.Context, username string) (*models.User, error) {
	if m.GetByUsernameFunc != nil {
		return m.GetByUsernameFunc(ctx, username)
	}
	return nil, nil
}

func (m *MockUserRepo) GetByEmail(ctx context.Context, email string) (*models.User, error) {
	if m.GetByEmailFunc != nil {
		return m.GetByEmailFunc(ctx, email)
	}
	return nil, nil
}

func (m *MockUserRepo) GetByID(ctx context.Context, id string) (*models.User, error) {
	if m.GetByIDFunc != nil {
		return m.GetByIDFunc(ctx, id)
	}
	return nil, nil
}

func (m *MockUserRepo) Exists(ctx context.Context, username string) (bool, error) {
	if m.ExistsFunc != nil {
		return m.ExistsFunc(ctx, username)
	}
	return false, nil
}

func (m *MockUserRepo) EmailExists(ctx context.Context, email string) (bool, error) {
	if m.EmailExistsFunc != nil {
		return m.EmailExistsFunc(ctx, email)
	}
	return false, nil
}

func (m *MockUserRepo) FindByOAuth(ctx context.Context, provider, oauthID string) (*models.User, error) {
	if m.FindByOAuthFunc != nil {
		return m.FindByOAuthFunc(ctx, provider, oauthID)
	}
	return nil, nil
}

func (m *MockUserRepo) CreateOAuth(ctx context.Context, provider, oauthID, username string) (*models.User, error) {
	if m.CreateOAuthFunc != nil {
		return m.CreateOAuthFunc(ctx, provider, oauthID, username)
	}
	return nil, nil
}

func (m *MockUserRepo) UpdateProfile(ctx context.Context, userID string, lichess, chesscom *string, timeFormatPrefs []string) (*models.User, error) {
	if m.UpdateProfileFunc != nil {
		return m.UpdateProfileFunc(ctx, userID, lichess, chesscom, timeFormatPrefs)
	}
	return nil, nil
}

func (m *MockUserRepo) UpdateLichessToken(ctx context.Context, userID, token string) error {
	if m.UpdateLichessTokenFunc != nil {
		return m.UpdateLichessTokenFunc(ctx, userID, token)
	}
	return nil
}

func (m *MockUserRepo) UpdatePassword(ctx context.Context, userID, passwordHash string) error {
	if m.UpdatePasswordFunc != nil {
		return m.UpdatePasswordFunc(ctx, userID, passwordHash)
	}
	return nil
}

func (m *MockUserRepo) Delete(ctx context.Context, id string) error {
	if m.DeleteFunc != nil {
		return m.DeleteFunc(ctx, id)
	}
	return nil
}

// MockPasswordResetRepo is a mock implementation of PasswordResetRepository for testing
type MockPasswordResetRepo struct {
	CreateFunc              func(ctx context.Context, userID, tokenHash string, expiresAt time.Time) (*models.PasswordResetToken, error)
	GetByTokenHashFunc      func(ctx context.Context, tokenHash string) (*models.PasswordResetToken, error)
	MarkUsedFunc            func(ctx context.Context, id string) error
	DeleteByUserIDFunc      func(ctx context.Context, userID string) error
	DeleteExpiredFunc       func(ctx context.Context) error
	CountRecentByUserIDFunc func(ctx context.Context, userID string, since time.Time) (int, error)
}

func (m *MockPasswordResetRepo) Create(ctx context.Context, userID, tokenHash string, expiresAt time.Time) (*models.PasswordResetToken, error) {
	if m.CreateFunc != nil {
		return m.CreateFunc(ctx, userID, tokenHash, expiresAt)
	}
	return &models.PasswordResetToken{
		ID:        "reset-123",
		UserID:    userID,
		TokenHash: tokenHash,
		ExpiresAt: expiresAt,
	}, nil
}

func (m *MockPasswordResetRepo) GetByTokenHash(ctx context.Context, tokenHash string) (*models.PasswordResetToken, error) {
	if m.GetByTokenHashFunc != nil {
		return m.GetByTokenHashFunc(ctx, tokenHash)
	}
	return nil, repository.ErrResetTokenNotFound
}

func (m *MockPasswordResetRepo) MarkUsed(ctx context.Context, id string) error {
	if m.MarkUsedFunc != nil {
		return m.MarkUsedFunc(ctx, id)
	}
	return nil
}

func (m *MockPasswordResetRepo) DeleteByUserID(ctx context.Context, userID string) error {
	if m.DeleteByUserIDFunc != nil {
		return m.DeleteByUserIDFunc(ctx, userID)
	}
	return nil
}

func (m *MockPasswordResetRepo) DeleteExpired(ctx context.Context) error {
	if m.DeleteExpiredFunc != nil {
		return m.DeleteExpiredFunc(ctx)
	}
	return nil
}

func (m *MockPasswordResetRepo) CountRecentByUserID(ctx context.Context, userID string, since time.Time) (int, error) {
	if m.CountRecentByUserIDFunc != nil {
		return m.CountRecentByUserIDFunc(ctx, userID, since)
	}
	return 0, nil
}

// MockRefreshTokenRepo is a mock implementation of RefreshTokenRepository for testing
type MockRefreshTokenRepo struct {
	CreateFunc         func(ctx context.Context, userID, tokenHash string, expiresAt time.Time) (*models.RefreshToken, error)
	GetByTokenHashFunc func(ctx context.Context, tokenHash string) (*models.RefreshToken, error)
	MarkConsumedFunc   func(ctx context.Context, id string) error
	DeleteFunc         func(ctx context.Context, id string) error
	DeleteByUserIDFunc func(ctx context.Context, userID string) error
	DeleteExpiredFunc  func(ctx context.Context) error
	CountByUserIDFunc  func(ctx context.Context, userID string) (int, error)
}

func (m *MockRefreshTokenRepo) Create(ctx context.Context, userID, tokenHash string, expiresAt time.Time) (*models.RefreshToken, error) {
	if m.CreateFunc != nil {
		return m.CreateFunc(ctx, userID, tokenHash, expiresAt)
	}
	return &models.RefreshToken{
		ID:        "refresh-123",
		UserID:    userID,
		TokenHash: tokenHash,
		ExpiresAt: expiresAt,
	}, nil
}

func (m *MockRefreshTokenRepo) GetByTokenHash(ctx context.Context, tokenHash string) (*models.RefreshToken, error) {
	if m.GetByTokenHashFunc != nil {
		return m.GetByTokenHashFunc(ctx, tokenHash)
	}
	return nil, repository.ErrRefreshTokenNotFound
}

func (m *MockRefreshTokenRepo) MarkConsumed(ctx context.Context, id string) error {
	if m.MarkConsumedFunc != nil {
		return m.MarkConsumedFunc(ctx, id)
	}
	return nil
}

func (m *MockRefreshTokenRepo) Delete(ctx context.Context, id string) error {
	if m.DeleteFunc != nil {
		return m.DeleteFunc(ctx, id)
	}
	return nil
}

func (m *MockRefreshTokenRepo) DeleteByUserID(ctx context.Context, userID string) error {
	if m.DeleteByUserIDFunc != nil {
		return m.DeleteByUserIDFunc(ctx, userID)
	}
	return nil
}

func (m *MockRefreshTokenRepo) DeleteExpired(ctx context.Context) error {
	if m.DeleteExpiredFunc != nil {
		return m.DeleteExpiredFunc(ctx)
	}
	return nil
}

func (m *MockRefreshTokenRepo) CountByUserID(ctx context.Context, userID string) (int, error) {
	if m.CountByUserIDFunc != nil {
		return m.CountByUserIDFunc(ctx, userID)
	}
	return 0, nil
}

// MockOpeningExplorerCacheRepo is a mock implementation of
// OpeningExplorerCacheRepository for testing.
type MockOpeningExplorerCacheRepo struct {
	GetFunc           func(ctx context.Context, cacheKey string) ([]byte, bool, error)
	PutFunc           func(ctx context.Context, cacheKey string, payload []byte, expiresAt time.Time) error
	DeleteExpiredFunc func(ctx context.Context) error
}

func (m *MockOpeningExplorerCacheRepo) Get(ctx context.Context, cacheKey string) ([]byte, bool, error) {
	if m.GetFunc != nil {
		return m.GetFunc(ctx, cacheKey)
	}
	return nil, false, nil
}

func (m *MockOpeningExplorerCacheRepo) Put(ctx context.Context, cacheKey string, payload []byte, expiresAt time.Time) error {
	if m.PutFunc != nil {
		return m.PutFunc(ctx, cacheKey, payload, expiresAt)
	}
	return nil
}

func (m *MockOpeningExplorerCacheRepo) DeleteExpired(ctx context.Context) error {
	if m.DeleteExpiredFunc != nil {
		return m.DeleteExpiredFunc(ctx)
	}
	return nil
}
