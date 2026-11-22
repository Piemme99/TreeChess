package services

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/kumquat/backend/internal/models"
	"github.com/kumquat/backend/internal/repository"
	"github.com/kumquat/backend/internal/repository/mocks"
)

const testJWTSecret = "test-secret-key-32-chars-long!!!"

func newTestAuthService(userRepo repository.UserRepository) *AuthService {
	return NewAuthService(userRepo, testJWTSecret, 24*time.Hour)
}

func TestAuthService_ValidateToken_Roundtrip(t *testing.T) {
	mockRepo := &mocks.MockUserRepo{
		GetByIDFunc: func(_ context.Context, id string) (*models.User, error) {
			return &models.User{ID: id, Username: "testuser"}, nil
		},
	}
	svc := newTestAuthService(mockRepo)

	user := &models.User{ID: "user-123", Username: "testuser"}
	token, err := svc.generateToken(user)
	require.NoError(t, err)

	userID, err := svc.ValidateToken(context.Background(), token)

	require.NoError(t, err)
	assert.Equal(t, "user-123", userID)
}

func TestAuthService_ValidateToken_InvalidString(t *testing.T) {
	svc := newTestAuthService(&mocks.MockUserRepo{})

	_, err := svc.ValidateToken(context.Background(), "not-a-valid-jwt-token")

	assert.ErrorIs(t, err, ErrUnauthorized)
}

func TestAuthService_ValidateToken_DeletedUser(t *testing.T) {
	mockRepo := &mocks.MockUserRepo{
		GetByIDFunc: func(_ context.Context, id string) (*models.User, error) {
			return nil, repository.ErrUserNotFound
		},
	}
	svc := newTestAuthService(mockRepo)

	user := &models.User{ID: "user-123", Username: "testuser"}
	token, err := svc.generateToken(user)
	require.NoError(t, err)

	_, err = svc.ValidateToken(context.Background(), token)

	assert.ErrorIs(t, err, ErrUnauthorized)
}

func TestAuthService_ValidateToken_Expired(t *testing.T) {
	mockRepo := &mocks.MockUserRepo{}
	// Create service with 0 expiry so token is immediately expired
	svc := NewAuthService(mockRepo, testJWTSecret, -1*time.Hour)

	user := &models.User{ID: "user-123", Username: "testuser"}
	token, err := svc.generateToken(user)
	require.NoError(t, err)

	_, err = svc.ValidateToken(context.Background(), token)

	assert.ErrorIs(t, err, ErrUnauthorized)
}

func TestAuthService_GetUserByID(t *testing.T) {
	mockRepo := &mocks.MockUserRepo{
		GetByIDFunc: func(_ context.Context, id string) (*models.User, error) {
			return &models.User{ID: id, Username: "testuser"}, nil
		},
	}
	svc := newTestAuthService(mockRepo)

	user, err := svc.GetUserByID(context.Background(), "user-123")

	require.NoError(t, err)
	assert.Equal(t, "user-123", user.ID)
}

func TestAuthService_GetUserByID_NotFound(t *testing.T) {
	mockRepo := &mocks.MockUserRepo{
		GetByIDFunc: func(_ context.Context, id string) (*models.User, error) {
			return nil, repository.ErrUserNotFound
		},
	}
	svc := newTestAuthService(mockRepo)

	_, err := svc.GetUserByID(context.Background(), "nonexistent")

	assert.ErrorIs(t, err, repository.ErrUserNotFound)
}

func TestAuthService_CheckDeletionUsername_WrongOrEmptyUsername(t *testing.T) {
	mockUserRepo := &mocks.MockUserRepo{
		GetByIDFunc: func(_ context.Context, id string) (*models.User, error) {
			return &models.User{ID: id, Username: "lichessuser"}, nil
		},
	}
	svc := newTestAuthService(mockUserRepo)

	for _, typed := range []string{"", "someoneelse", "LichessUser"} {
		_, err := svc.CheckDeletionUsername(context.Background(), "user-123", typed)
		assert.ErrorIs(t, err, ErrUsernameMismatch, typed)
	}
	user, err := svc.CheckDeletionUsername(context.Background(), "user-123", "lichessuser")
	require.NoError(t, err)
	assert.Equal(t, "user-123", user.ID)
}

func lichessUser(id, lichessID string) *models.User {
	provider := "lichess"
	return &models.User{ID: id, Username: "lichessuser", OAuthProvider: &provider, OAuthID: &lichessID}
}

func TestAuthService_DeleteAccountConfirmedByLichess_OnlyTheLinkedLichessAccountConfirms(t *testing.T) {
	cases := map[string]struct {
		lichessID string
		deleted   bool
	}{
		"the linked account":  {"lichess-abc", true},
		"another account":     {"lichess-xyz", false},
		"no account returned": {"", false},
	}
	for name, tc := range cases {
		t.Run(name, func(t *testing.T) {
			deleted := ""
			mockUserRepo := &mocks.MockUserRepo{
				GetByIDFunc: func(_ context.Context, id string) (*models.User, error) { return lichessUser(id, "lichess-abc"), nil },
				DeleteFunc: func(_ context.Context, id string) error {
					deleted = id
					return nil
				},
			}
			svc := newTestAuthService(mockUserRepo)

			err := svc.DeleteAccountConfirmedByLichess(context.Background(), "user-123", tc.lichessID)

			if tc.deleted {
				require.NoError(t, err)
				assert.Equal(t, "user-123", deleted)
			} else {
				assert.ErrorIs(t, err, ErrDeletionNotConfirmed)
				assert.Empty(t, deleted)
			}
		})
	}
}

func TestAuthService_DeleteLegacyAccount_NeedsTheAccountsLiveRefreshCookie(t *testing.T) {
	live := &models.RefreshToken{ID: "rt-1", UserID: "user-123", ExpiresAt: time.Now().Add(time.Hour)}
	cases := map[string]struct {
		user    *models.User
		refresh string
		stored  *models.RefreshToken
		deleted bool
	}{
		"its live refresh cookie":       {&models.User{ID: "user-123"}, "raw", live, true},
		"no refresh cookie":             {&models.User{ID: "user-123"}, "", live, false},
		"an unknown refresh cookie":     {&models.User{ID: "user-123"}, "raw", nil, false},
		"another user's refresh cookie": {&models.User{ID: "user-123"}, "raw", &models.RefreshToken{UserID: "user-456", ExpiresAt: live.ExpiresAt}, false},
		"a consumed refresh cookie":     {&models.User{ID: "user-123"}, "raw", &models.RefreshToken{UserID: "user-123", Consumed: true, ExpiresAt: live.ExpiresAt}, false},
		"an expired refresh cookie":     {&models.User{ID: "user-123"}, "raw", &models.RefreshToken{UserID: "user-123", ExpiresAt: time.Now().Add(-time.Hour)}, false},
		"a Lichess account":             {lichessUser("user-123", "lichess-abc"), "raw", live, false},
	}
	for name, tc := range cases {
		t.Run(name, func(t *testing.T) {
			deleted := ""
			mockUserRepo := &mocks.MockUserRepo{
				GetByIDFunc: func(_ context.Context, _ string) (*models.User, error) { return tc.user, nil },
				DeleteFunc: func(_ context.Context, id string) error {
					deleted = id
					return nil
				},
			}
			svc := newTestAuthService(mockUserRepo)
			svc.WithRefreshTokens(&mocks.MockRefreshTokenRepo{
				GetByTokenHashFunc: func(_ context.Context, tokenHash string) (*models.RefreshToken, error) {
					if tc.stored == nil || tokenHash != hashToken("raw") {
						return nil, repository.ErrRefreshTokenNotFound
					}
					return tc.stored, nil
				},
			})

			err := svc.DeleteLegacyAccount(context.Background(), "user-123", tc.refresh)

			if tc.deleted {
				require.NoError(t, err)
				assert.Equal(t, "user-123", deleted)
			} else {
				assert.ErrorIs(t, err, ErrDeletionNotConfirmed)
				assert.Empty(t, deleted)
			}
		})
	}
}

func TestAuthService_RefreshTokens_Success_MarksConsumed(t *testing.T) {
	email := "refresh@example.com"
	mockUserRepo := &mocks.MockUserRepo{
		GetByIDFunc: func(_ context.Context, id string) (*models.User, error) {
			return &models.User{ID: id, Username: "refresher", Email: &email}, nil
		},
	}

	var consumedID string
	deleteCalled := false
	revokeCalled := false
	mockRefreshRepo := &mocks.MockRefreshTokenRepo{
		GetByTokenHashFunc: func(_ context.Context, hash string) (*models.RefreshToken, error) {
			return &models.RefreshToken{
				ID:        "token-1",
				UserID:    "user-123",
				TokenHash: hash,
				ExpiresAt: time.Now().Add(24 * time.Hour),
				Consumed:  false,
			}, nil
		},
		MarkConsumedFunc: func(_ context.Context, id string) error {
			consumedID = id
			return nil
		},
		DeleteFunc: func(_ context.Context, id string) error {
			deleteCalled = true
			return nil
		},
		DeleteByUserIDFunc: func(_ context.Context, userID string) error {
			revokeCalled = true
			return nil
		},
	}

	svc := newTestAuthService(mockUserRepo)
	svc.WithRefreshTokens(mockRefreshRepo)

	resp, err := svc.RefreshTokens(context.Background(), "raw-refresh-token")

	require.NoError(t, err)
	require.NotNil(t, resp)
	assert.NotEmpty(t, resp.Token)
	assert.NotEmpty(t, resp.RefreshToken)
	// Happy path consumes (not deletes) the old token and does not revoke the family.
	assert.Equal(t, "token-1", consumedID, "old token should be marked consumed")
	assert.False(t, deleteCalled, "old token should not be hard-deleted on rotation")
	assert.False(t, revokeCalled, "family should not be revoked on the happy path")
}

func TestAuthService_RefreshTokens_ReuseDetected_RevokesFamily(t *testing.T) {
	mockUserRepo := &mocks.MockUserRepo{
		GetByIDFunc: func(_ context.Context, id string) (*models.User, error) {
			t.Fatalf("user should not be fetched when reuse is detected")
			return nil, nil
		},
	}

	revokedUserID := ""
	consumedCalled := false
	mockRefreshRepo := &mocks.MockRefreshTokenRepo{
		GetByTokenHashFunc: func(_ context.Context, hash string) (*models.RefreshToken, error) {
			// An already-consumed token presented again => reuse/theft.
			return &models.RefreshToken{
				ID:        "token-1",
				UserID:    "user-123",
				TokenHash: hash,
				ExpiresAt: time.Now().Add(24 * time.Hour),
				Consumed:  true,
			}, nil
		},
		MarkConsumedFunc: func(_ context.Context, id string) error {
			consumedCalled = true
			return nil
		},
		DeleteByUserIDFunc: func(_ context.Context, userID string) error {
			revokedUserID = userID
			return nil
		},
	}

	svc := newTestAuthService(mockUserRepo)
	svc.WithRefreshTokens(mockRefreshRepo)

	resp, err := svc.RefreshTokens(context.Background(), "stolen-refresh-token")

	require.ErrorIs(t, err, ErrUnauthorized)
	assert.Nil(t, resp)
	assert.Equal(t, "user-123", revokedUserID, "replaying a consumed token must revoke the whole family")
	assert.False(t, consumedCalled, "reuse path must not re-consume the token")
}

func TestAuthService_RefreshTokens_ConcurrentRotationLoss_RevokesFamily(t *testing.T) {
	mockUserRepo := &mocks.MockUserRepo{
		GetByIDFunc: func(_ context.Context, id string) (*models.User, error) {
			t.Fatalf("user should not be fetched when the rotation race is lost")
			return nil, nil
		},
	}

	revokedUserID := ""
	mockRefreshRepo := &mocks.MockRefreshTokenRepo{
		GetByTokenHashFunc: func(_ context.Context, hash string) (*models.RefreshToken, error) {
			// Read sees the token as unconsumed...
			return &models.RefreshToken{
				ID:        "token-1",
				UserID:    "user-123",
				TokenHash: hash,
				ExpiresAt: time.Now().Add(24 * time.Hour),
				Consumed:  false,
			}, nil
		},
		MarkConsumedFunc: func(_ context.Context, id string) error {
			// ...but a concurrent rotation consumed it first: the conditional
			// UPDATE matches no row.
			return repository.ErrRefreshTokenNotFound
		},
		DeleteByUserIDFunc: func(_ context.Context, userID string) error {
			revokedUserID = userID
			return nil
		},
	}

	svc := newTestAuthService(mockUserRepo)
	svc.WithRefreshTokens(mockRefreshRepo)

	resp, err := svc.RefreshTokens(context.Background(), "raced-refresh-token")

	require.ErrorIs(t, err, ErrUnauthorized)
	assert.Nil(t, resp)
	assert.Equal(t, "user-123", revokedUserID, "losing the consume race must revoke the whole family")
}

func TestAuthService_RefreshTokens_UnknownToken_NoRevocation(t *testing.T) {
	revokeCalled := false
	mockRefreshRepo := &mocks.MockRefreshTokenRepo{
		GetByTokenHashFunc: func(_ context.Context, hash string) (*models.RefreshToken, error) {
			return nil, repository.ErrRefreshTokenNotFound
		},
		DeleteByUserIDFunc: func(_ context.Context, userID string) error {
			revokeCalled = true
			return nil
		},
	}

	svc := newTestAuthService(&mocks.MockUserRepo{})
	svc.WithRefreshTokens(mockRefreshRepo)

	resp, err := svc.RefreshTokens(context.Background(), "never-issued-token")

	require.ErrorIs(t, err, ErrUnauthorized)
	assert.Nil(t, resp)
	assert.False(t, revokeCalled, "an unknown token must not trigger family revocation")
}

func TestAuthService_RefreshTokens_Expired(t *testing.T) {
	deletedID := ""
	mockRefreshRepo := &mocks.MockRefreshTokenRepo{
		GetByTokenHashFunc: func(_ context.Context, hash string) (*models.RefreshToken, error) {
			return &models.RefreshToken{
				ID:        "token-1",
				UserID:    "user-123",
				TokenHash: hash,
				ExpiresAt: time.Now().Add(-1 * time.Hour),
				Consumed:  false,
			}, nil
		},
		DeleteFunc: func(_ context.Context, id string) error {
			deletedID = id
			return nil
		},
	}

	svc := newTestAuthService(&mocks.MockUserRepo{})
	svc.WithRefreshTokens(mockRefreshRepo)

	resp, err := svc.RefreshTokens(context.Background(), "expired-token")

	require.ErrorIs(t, err, ErrUnauthorized)
	assert.Nil(t, resp)
	assert.Equal(t, "token-1", deletedID, "expired token should be cleaned up")
}
