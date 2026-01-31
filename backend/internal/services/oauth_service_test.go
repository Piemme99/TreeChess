package services

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/treechess/backend/internal/models"
	"github.com/treechess/backend/internal/repository"
	"github.com/treechess/backend/internal/repository/mocks"
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
		FindByOAuthFunc: func(provider, oauthID string) (*models.User, error) {
			return existingUser, nil
		},
	}
	oauthSvc, _ := newTestOAuthService(mockRepo)

	resp, isNew, err := oauthSvc.FindOrCreateUser("lichess", "oauth-123", "lichessplayer")

	require.NoError(t, err)
	assert.False(t, isNew)
	assert.Equal(t, "user-123", resp.User.ID)
	assert.NotEmpty(t, resp.Token)
}

func TestOAuthService_FindOrCreateUser_NewUser(t *testing.T) {
	mockRepo := &mocks.MockUserRepo{
		FindByOAuthFunc: func(provider, oauthID string) (*models.User, error) {
			return nil, repository.ErrUserNotFound
		},
		ExistsFunc: func(username string) (bool, error) {
			return false, nil
		},
		CreateOAuthFunc: func(provider, oauthID, username string) (*models.User, error) {
			return &models.User{ID: "new-user", Username: username}, nil
		},
	}
	oauthSvc, _ := newTestOAuthService(mockRepo)

	resp, isNew, err := oauthSvc.FindOrCreateUser("lichess", "oauth-new", "newplayer")

	require.NoError(t, err)
	assert.True(t, isNew)
	assert.Equal(t, "newplayer", resp.User.Username)
	assert.NotEmpty(t, resp.Token)
}

func TestOAuthService_FindOrCreateUser_UsernameCollision(t *testing.T) {
	callCount := 0
	mockRepo := &mocks.MockUserRepo{
		FindByOAuthFunc: func(provider, oauthID string) (*models.User, error) {
			return nil, repository.ErrUserNotFound
		},
		ExistsFunc: func(username string) (bool, error) {
			callCount++
			// First call with original name returns true (collision),
			// second call with suffixed name returns false
			return callCount <= 1, nil
		},
		CreateOAuthFunc: func(provider, oauthID, username string) (*models.User, error) {
			return &models.User{ID: "new-user", Username: username}, nil
		},
	}
	oauthSvc, _ := newTestOAuthService(mockRepo)

	resp, isNew, err := oauthSvc.FindOrCreateUser("lichess", "oauth-new", "player")

	require.NoError(t, err)
	assert.True(t, isNew)
	assert.Equal(t, "player_1", resp.User.Username)
}

func TestOAuthService_FindOrCreateUser_FindError(t *testing.T) {
	mockRepo := &mocks.MockUserRepo{
		FindByOAuthFunc: func(provider, oauthID string) (*models.User, error) {
			return nil, assert.AnError
		},
	}
	oauthSvc, _ := newTestOAuthService(mockRepo)

	_, _, err := oauthSvc.FindOrCreateUser("lichess", "oauth-123", "player")

	assert.Error(t, err)
	assert.Contains(t, err.Error(), "failed to find OAuth user")
}

func TestOAuthService_FindOrCreateUser_ExistsCheckError(t *testing.T) {
	mockRepo := &mocks.MockUserRepo{
		FindByOAuthFunc: func(provider, oauthID string) (*models.User, error) {
			return nil, repository.ErrUserNotFound
		},
		ExistsFunc: func(username string) (bool, error) {
			return false, assert.AnError
		},
	}
	oauthSvc, _ := newTestOAuthService(mockRepo)

	_, _, err := oauthSvc.FindOrCreateUser("lichess", "oauth-new", "player")

	assert.Error(t, err)
	assert.Contains(t, err.Error(), "failed to check username")
}
