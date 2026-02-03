package services

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"golang.org/x/crypto/bcrypt"

	"github.com/treechess/backend/internal/models"
	"github.com/treechess/backend/internal/repository"
	"github.com/treechess/backend/internal/repository/mocks"
)

const testJWTSecret = "test-secret-key-32-chars-long!!!"

func newTestAuthService(userRepo repository.UserRepository) *AuthService {
	return NewAuthService(userRepo, testJWTSecret, 24*time.Hour)
}

func TestAuthService_Register_Success(t *testing.T) {
	mockRepo := &mocks.MockUserRepo{
		CreateFunc: func(username, passwordHash string) (*models.User, error) {
			return &models.User{
				ID:       "user-123",
				Username: username,
			}, nil
		},
	}
	svc := newTestAuthService(mockRepo)

	resp, err := svc.Register("testuser", "password123")

	require.NoError(t, err)
	require.NotNil(t, resp)
	assert.NotEmpty(t, resp.Token)
	assert.Equal(t, "testuser", resp.User.Username)
}

func TestAuthService_Register_InvalidUsername(t *testing.T) {
	svc := newTestAuthService(&mocks.MockUserRepo{})

	tests := []struct {
		name     string
		username string
	}{
		{"too short", "ab"},
		{"special chars", "user@name"},
		{"spaces", "user name"},
		{"empty", ""},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := svc.Register(tt.username, "password123")
			assert.ErrorIs(t, err, ErrInvalidUsername)
		})
	}
}

func TestAuthService_Register_PasswordTooShort(t *testing.T) {
	svc := newTestAuthService(&mocks.MockUserRepo{})

	_, err := svc.Register("validuser", "short")

	assert.ErrorIs(t, err, ErrPasswordTooShort)
}

func TestAuthService_Register_UsernameExists(t *testing.T) {
	mockRepo := &mocks.MockUserRepo{
		CreateFunc: func(username, passwordHash string) (*models.User, error) {
			return nil, repository.ErrUsernameExists
		},
	}
	svc := newTestAuthService(mockRepo)

	_, err := svc.Register("existinguser", "password123")

	assert.ErrorIs(t, err, repository.ErrUsernameExists)
}

func TestAuthService_Login_Success(t *testing.T) {
	hash, _ := bcrypt.GenerateFromPassword([]byte("password123"), bcrypt.MinCost)
	mockRepo := &mocks.MockUserRepo{
		GetByUsernameFunc: func(username string) (*models.User, error) {
			return &models.User{
				ID:           "user-123",
				Username:     username,
				PasswordHash: string(hash),
			}, nil
		},
	}
	svc := newTestAuthService(mockRepo)

	resp, err := svc.Login("testuser", "password123")

	require.NoError(t, err)
	require.NotNil(t, resp)
	assert.NotEmpty(t, resp.Token)
	assert.Equal(t, "testuser", resp.User.Username)
}

func TestAuthService_Login_UserNotFound(t *testing.T) {
	mockRepo := &mocks.MockUserRepo{
		GetByUsernameFunc: func(username string) (*models.User, error) {
			return nil, repository.ErrUserNotFound
		},
	}
	svc := newTestAuthService(mockRepo)

	_, err := svc.Login("nonexistent", "password123")

	assert.ErrorIs(t, err, ErrInvalidCredentials)
}

func TestAuthService_Login_WrongPassword(t *testing.T) {
	hash, _ := bcrypt.GenerateFromPassword([]byte("correctpassword"), bcrypt.MinCost)
	mockRepo := &mocks.MockUserRepo{
		GetByUsernameFunc: func(username string) (*models.User, error) {
			return &models.User{
				ID:           "user-123",
				Username:     username,
				PasswordHash: string(hash),
			}, nil
		},
	}
	svc := newTestAuthService(mockRepo)

	_, err := svc.Login("testuser", "wrongpassword")

	assert.ErrorIs(t, err, ErrInvalidCredentials)
}

func TestAuthService_Login_OAuthOnly(t *testing.T) {
	provider := "lichess"
	mockRepo := &mocks.MockUserRepo{
		GetByUsernameFunc: func(username string) (*models.User, error) {
			return &models.User{
				ID:            "user-123",
				Username:      username,
				PasswordHash:  "",
				OAuthProvider: &provider,
			}, nil
		},
	}
	svc := newTestAuthService(mockRepo)

	_, err := svc.Login("oauthuser", "anypassword")

	assert.ErrorIs(t, err, ErrOAuthOnly)
}

func TestAuthService_ValidateToken_Roundtrip(t *testing.T) {
	mockRepo := &mocks.MockUserRepo{}
	svc := newTestAuthService(mockRepo)

	user := &models.User{ID: "user-123", Username: "testuser"}
	token, err := svc.generateToken(user)
	require.NoError(t, err)

	userID, err := svc.ValidateToken(token)

	require.NoError(t, err)
	assert.Equal(t, "user-123", userID)
}

func TestAuthService_ValidateToken_InvalidString(t *testing.T) {
	svc := newTestAuthService(&mocks.MockUserRepo{})

	_, err := svc.ValidateToken("not-a-valid-jwt-token")

	assert.ErrorIs(t, err, ErrUnauthorized)
}

func TestAuthService_ValidateToken_Expired(t *testing.T) {
	mockRepo := &mocks.MockUserRepo{}
	// Create service with 0 expiry so token is immediately expired
	svc := NewAuthService(mockRepo, testJWTSecret, -1*time.Hour)

	user := &models.User{ID: "user-123", Username: "testuser"}
	token, err := svc.generateToken(user)
	require.NoError(t, err)

	_, err = svc.ValidateToken(token)

	assert.ErrorIs(t, err, ErrUnauthorized)
}

func TestAuthService_GetUserByID(t *testing.T) {
	mockRepo := &mocks.MockUserRepo{
		GetByIDFunc: func(id string) (*models.User, error) {
			return &models.User{ID: id, Username: "testuser"}, nil
		},
	}
	svc := newTestAuthService(mockRepo)

	user, err := svc.GetUserByID("user-123")

	require.NoError(t, err)
	assert.Equal(t, "user-123", user.ID)
}

func TestAuthService_GetUserByID_NotFound(t *testing.T) {
	mockRepo := &mocks.MockUserRepo{
		GetByIDFunc: func(id string) (*models.User, error) {
			return nil, repository.ErrUserNotFound
		},
	}
	svc := newTestAuthService(mockRepo)

	_, err := svc.GetUserByID("nonexistent")

	assert.ErrorIs(t, err, repository.ErrUserNotFound)
}

func TestAuthService_UpdateProfile(t *testing.T) {
	lichess := "lichessuser"
	mockRepo := &mocks.MockUserRepo{
		UpdateProfileFunc: func(userID string, l, c *string, timeFormatPrefs []string) (*models.User, error) {
			return &models.User{
				ID:               userID,
				Username:         "testuser",
				LichessUsername:  l,
				ChesscomUsername: c,
			}, nil
		},
	}
	svc := newTestAuthService(mockRepo)

	user, err := svc.UpdateProfile("user-123", models.UpdateProfileRequest{
		LichessUsername: &lichess,
	})

	require.NoError(t, err)
	assert.Equal(t, &lichess, user.LichessUsername)
}

func TestAuthService_Register_ValidUsernames(t *testing.T) {
	mockRepo := &mocks.MockUserRepo{
		CreateFunc: func(username, passwordHash string) (*models.User, error) {
			return &models.User{ID: "user-123", Username: username}, nil
		},
	}
	svc := newTestAuthService(mockRepo)

	validNames := []string{"abc", "user_name", "user-name", "User123", "a_b-c"}
	for _, name := range validNames {
		t.Run(name, func(t *testing.T) {
			resp, err := svc.Register(name, "password123")
			require.NoError(t, err)
			assert.NotNil(t, resp)
		})
	}
}
