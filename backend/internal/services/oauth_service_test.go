package services

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/kumquat/backend/internal/models"
	"github.com/kumquat/backend/internal/repository"
	"github.com/kumquat/backend/internal/repository/mocks"
)

func newTestOAuthService(userRepo repository.UserRepository) (*OAuthService, *AuthService) {
	authSvc := NewAuthService(userRepo, testJWTSecret, 24*time.Hour)
	oauthSvc := NewOAuthService(userRepo, authSvc, "test-client-id", "http://localhost:8080/callback")
	return oauthSvc, authSvc
}

func TestOAuthService_GenerateAuthURL(t *testing.T) {
	oauthSvc, _ := newTestOAuthService(&mocks.MockUserRepo{})

	authURL, state, codeVerifier, err := oauthSvc.GenerateAuthURL()

	require.NoError(t, err)
	assert.NotEmpty(t, authURL)
	assert.NotEmpty(t, state)
	assert.NotEmpty(t, codeVerifier)
	assert.Contains(t, authURL, "lichess.org/oauth")
	assert.Contains(t, authURL, "code_challenge_method=S256")
	assert.Contains(t, authURL, "code_challenge=")
}

func TestOAuthService_GenerateAuthURL_StateNonEmpty(t *testing.T) {
	oauthSvc, _ := newTestOAuthService(&mocks.MockUserRepo{})

	_, state1, _, _ := oauthSvc.GenerateAuthURL()
	_, state2, _, _ := oauthSvc.GenerateAuthURL()

	// States should be different (random)
	assert.NotEqual(t, state1, state2)
}

func TestOAuthService_FindOrCreateUser_ExistingUser(t *testing.T) {
	existingUser := &models.User{ID: "user-123", Username: "lichessplayer"}
	mockRepo := &mocks.MockUserRepo{
		FindByOAuthFunc: func(_ context.Context, provider, oauthID string) (*models.User, error) {
			return existingUser, nil
		},
	}
	oauthSvc, _ := newTestOAuthService(mockRepo)

	resp, isNew, err := oauthSvc.FindOrCreateUser(context.Background(), "lichess", "oauth-123", "lichessplayer")

	require.NoError(t, err)
	assert.False(t, isNew)
	assert.Equal(t, "user-123", resp.User.ID)
	assert.NotEmpty(t, resp.Token)
}

func TestOAuthService_FindOrCreateUser_NewUser(t *testing.T) {
	mockRepo := &mocks.MockUserRepo{
		FindByOAuthFunc: func(_ context.Context, provider, oauthID string) (*models.User, error) {
			return nil, repository.ErrUserNotFound
		},
		ExistsFunc: func(_ context.Context, username string) (bool, error) {
			return false, nil
		},
		CreateOAuthFunc: func(_ context.Context, provider, oauthID, username string) (*models.User, error) {
			return &models.User{ID: "new-user", Username: username}, nil
		},
	}
	oauthSvc, _ := newTestOAuthService(mockRepo)

	resp, isNew, err := oauthSvc.FindOrCreateUser(context.Background(), "lichess", "oauth-new", "newplayer")

	require.NoError(t, err)
	assert.True(t, isNew)
	assert.Equal(t, "newplayer", resp.User.Username)
	assert.NotEmpty(t, resp.Token)
}

// TestOAuthService_FindOrCreateUser_WrappedNotFound ensures a wrapped
// ErrUserNotFound from FindByOAuth is still treated as "no existing user" (and a
// new account is created), rather than being misclassified as a hard failure.
// This fails if the sentinel is compared with != instead of errors.Is.
func TestOAuthService_FindOrCreateUser_WrappedNotFound(t *testing.T) {
	mockRepo := &mocks.MockUserRepo{
		FindByOAuthFunc: func(_ context.Context, provider, oauthID string) (*models.User, error) {
			return nil, fmt.Errorf("lookup failed: %w", repository.ErrUserNotFound)
		},
		ExistsFunc: func(_ context.Context, username string) (bool, error) {
			return false, nil
		},
		CreateOAuthFunc: func(_ context.Context, provider, oauthID, username string) (*models.User, error) {
			return &models.User{ID: "new-user", Username: username}, nil
		},
	}
	oauthSvc, _ := newTestOAuthService(mockRepo)

	resp, isNew, err := oauthSvc.FindOrCreateUser(context.Background(), "lichess", "oauth-new", "newplayer")

	require.NoError(t, err)
	assert.True(t, isNew)
	assert.Equal(t, "newplayer", resp.User.Username)
}

func TestOAuthService_FindOrCreateUser_UsernameCollision(t *testing.T) {
	callCount := 0
	mockRepo := &mocks.MockUserRepo{
		FindByOAuthFunc: func(_ context.Context, provider, oauthID string) (*models.User, error) {
			return nil, repository.ErrUserNotFound
		},
		ExistsFunc: func(_ context.Context, username string) (bool, error) {
			callCount++
			// First call with original name returns true (collision),
			// second call with suffixed name returns false
			return callCount <= 1, nil
		},
		CreateOAuthFunc: func(_ context.Context, provider, oauthID, username string) (*models.User, error) {
			return &models.User{ID: "new-user", Username: username}, nil
		},
	}
	oauthSvc, _ := newTestOAuthService(mockRepo)

	resp, isNew, err := oauthSvc.FindOrCreateUser(context.Background(), "lichess", "oauth-new", "player")

	require.NoError(t, err)
	assert.True(t, isNew)
	assert.Equal(t, "player_1", resp.User.Username)
}

func TestOAuthService_FindOrCreateUser_FindError(t *testing.T) {
	mockRepo := &mocks.MockUserRepo{
		FindByOAuthFunc: func(_ context.Context, provider, oauthID string) (*models.User, error) {
			return nil, assert.AnError
		},
	}
	oauthSvc, _ := newTestOAuthService(mockRepo)

	_, _, err := oauthSvc.FindOrCreateUser(context.Background(), "lichess", "oauth-123", "player")

	assert.Error(t, err)
	assert.Contains(t, err.Error(), "failed to find OAuth user")
}

func TestOAuthService_FindOrCreateUser_ExistsCheckError(t *testing.T) {
	mockRepo := &mocks.MockUserRepo{
		FindByOAuthFunc: func(_ context.Context, provider, oauthID string) (*models.User, error) {
			return nil, repository.ErrUserNotFound
		},
		ExistsFunc: func(_ context.Context, username string) (bool, error) {
			return false, assert.AnError
		},
	}
	oauthSvc, _ := newTestOAuthService(mockRepo)

	_, _, err := oauthSvc.FindOrCreateUser(context.Background(), "lichess", "oauth-new", "player")

	assert.Error(t, err)
	assert.Contains(t, err.Error(), "failed to check username")
}
