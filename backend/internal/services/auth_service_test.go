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
	email := "test@example.com"
	mockRepo := &mocks.MockUserRepo{
		CreateFunc: func(e, username, passwordHash string) (*models.User, error) {
			return &models.User{
				ID:       "user-123",
				Username: username,
				Email:    &e,
			}, nil
		},
	}
	svc := newTestAuthService(mockRepo)

	resp, err := svc.Register(email, "testuser", "password123")

	require.NoError(t, err)
	require.NotNil(t, resp)
	assert.NotEmpty(t, resp.Token)
	assert.Equal(t, "testuser", resp.User.Username)
	assert.Equal(t, &email, resp.User.Email)
}

func TestAuthService_Register_InvalidEmail(t *testing.T) {
	svc := newTestAuthService(&mocks.MockUserRepo{})

	tests := []struct {
		name  string
		email string
	}{
		{"no at sign", "testexample.com"},
		{"no domain", "test@"},
		{"no tld", "test@example"},
		{"empty", ""},
		{"spaces", "test @example.com"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := svc.Register(tt.email, "testuser", "password123")
			assert.ErrorIs(t, err, ErrInvalidEmail)
		})
	}
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
			_, err := svc.Register("test@example.com", tt.username, "password123")
			assert.ErrorIs(t, err, ErrInvalidUsername)
		})
	}
}

func TestAuthService_Register_PasswordTooShort(t *testing.T) {
	svc := newTestAuthService(&mocks.MockUserRepo{})

	_, err := svc.Register("test@example.com", "validuser", "short")

	assert.ErrorIs(t, err, ErrPasswordTooShort)
}

func TestAuthService_Register_UsernameExists(t *testing.T) {
	mockRepo := &mocks.MockUserRepo{
		CreateFunc: func(email, username, passwordHash string) (*models.User, error) {
			return nil, repository.ErrUsernameExists
		},
	}
	svc := newTestAuthService(mockRepo)

	_, err := svc.Register("test@example.com", "existinguser", "password123")

	assert.ErrorIs(t, err, repository.ErrUsernameExists)
}

func TestAuthService_Register_EmailExists(t *testing.T) {
	mockRepo := &mocks.MockUserRepo{
		CreateFunc: func(email, username, passwordHash string) (*models.User, error) {
			return nil, repository.ErrEmailExists
		},
	}
	svc := newTestAuthService(mockRepo)

	_, err := svc.Register("existing@example.com", "newuser", "password123")

	assert.ErrorIs(t, err, repository.ErrEmailExists)
}

func TestAuthService_Login_Success(t *testing.T) {
	hash, _ := bcrypt.GenerateFromPassword([]byte("password123"), bcrypt.MinCost)
	email := "test@example.com"
	mockRepo := &mocks.MockUserRepo{
		GetByEmailFunc: func(e string) (*models.User, error) {
			return &models.User{
				ID:           "user-123",
				Username:     "testuser",
				Email:        &email,
				PasswordHash: string(hash),
			}, nil
		},
	}
	svc := newTestAuthService(mockRepo)

	resp, err := svc.Login("test@example.com", "password123")

	require.NoError(t, err)
	require.NotNil(t, resp)
	assert.NotEmpty(t, resp.Token)
	assert.Equal(t, "testuser", resp.User.Username)
}

func TestAuthService_Login_UserNotFound(t *testing.T) {
	mockRepo := &mocks.MockUserRepo{
		GetByEmailFunc: func(email string) (*models.User, error) {
			return nil, repository.ErrUserNotFound
		},
	}
	svc := newTestAuthService(mockRepo)

	_, err := svc.Login("nonexistent@example.com", "password123")

	assert.ErrorIs(t, err, ErrInvalidCredentials)
}

func TestAuthService_Login_WrongPassword(t *testing.T) {
	hash, _ := bcrypt.GenerateFromPassword([]byte("correctpassword"), bcrypt.MinCost)
	mockRepo := &mocks.MockUserRepo{
		GetByEmailFunc: func(email string) (*models.User, error) {
			return &models.User{
				ID:           "user-123",
				Username:     "testuser",
				PasswordHash: string(hash),
			}, nil
		},
	}
	svc := newTestAuthService(mockRepo)

	_, err := svc.Login("test@example.com", "wrongpassword")

	assert.ErrorIs(t, err, ErrInvalidCredentials)
}

func TestAuthService_Login_OAuthOnly(t *testing.T) {
	provider := "lichess"
	mockRepo := &mocks.MockUserRepo{
		GetByEmailFunc: func(email string) (*models.User, error) {
			return &models.User{
				ID:            "user-123",
				Username:      "oauthuser",
				PasswordHash:  "",
				OAuthProvider: &provider,
			}, nil
		},
	}
	svc := newTestAuthService(mockRepo)

	_, err := svc.Login("oauth@example.com", "anypassword")

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
		CreateFunc: func(email, username, passwordHash string) (*models.User, error) {
			return &models.User{ID: "user-123", Username: username, Email: &email}, nil
		},
	}
	svc := newTestAuthService(mockRepo)

	validNames := []string{"abc", "user_name", "user-name", "User123", "a_b-c"}
	for _, name := range validNames {
		t.Run(name, func(t *testing.T) {
			resp, err := svc.Register("test@example.com", name, "password123")
			require.NoError(t, err)
			assert.NotNil(t, resp)
		})
	}
}

func TestAuthService_Register_ValidEmails(t *testing.T) {
	mockRepo := &mocks.MockUserRepo{
		CreateFunc: func(email, username, passwordHash string) (*models.User, error) {
			return &models.User{ID: "user-123", Username: username, Email: &email}, nil
		},
	}
	svc := newTestAuthService(mockRepo)

	validEmails := []string{
		"test@example.com",
		"user.name@example.com",
		"user+tag@example.com",
		"user_name@example.co.uk",
		"user123@example.org",
	}
	for _, email := range validEmails {
		t.Run(email, func(t *testing.T) {
			resp, err := svc.Register(email, "testuser", "password123")
			require.NoError(t, err)
			assert.NotNil(t, resp)
		})
	}
}

func TestAuthService_ChangePassword_Success(t *testing.T) {
	hash, _ := bcrypt.GenerateFromPassword([]byte("oldpassword123"), bcrypt.MinCost)
	mockUserRepo := &mocks.MockUserRepo{
		GetByIDFunc: func(id string) (*models.User, error) {
			return &models.User{
				ID:           "user-123",
				Username:     "testuser",
				PasswordHash: string(hash),
			}, nil
		},
		UpdatePasswordFunc: func(userID, passwordHash string) error {
			return nil
		},
	}
	svc := newTestAuthService(mockUserRepo)

	err := svc.ChangePassword("user-123", "oldpassword123", "newpassword123")

	require.NoError(t, err)
}

func TestAuthService_ChangePassword_IncorrectCurrent(t *testing.T) {
	hash, _ := bcrypt.GenerateFromPassword([]byte("correctpassword"), bcrypt.MinCost)
	mockUserRepo := &mocks.MockUserRepo{
		GetByIDFunc: func(id string) (*models.User, error) {
			return &models.User{
				ID:           "user-123",
				Username:     "testuser",
				PasswordHash: string(hash),
			}, nil
		},
	}
	svc := newTestAuthService(mockUserRepo)

	err := svc.ChangePassword("user-123", "wrongpassword", "newpassword123")

	assert.ErrorIs(t, err, ErrIncorrectPassword)
}

func TestAuthService_ChangePassword_NoPassword(t *testing.T) {
	provider := "lichess"
	mockUserRepo := &mocks.MockUserRepo{
		GetByIDFunc: func(id string) (*models.User, error) {
			return &models.User{
				ID:            "user-123",
				Username:      "oauthuser",
				PasswordHash:  "",
				OAuthProvider: &provider,
			}, nil
		},
	}
	svc := newTestAuthService(mockUserRepo)

	err := svc.ChangePassword("user-123", "anypassword", "newpassword123")

	assert.ErrorIs(t, err, ErrNoPassword)
}

func TestAuthService_ChangePassword_ShortPassword(t *testing.T) {
	hash, _ := bcrypt.GenerateFromPassword([]byte("oldpassword123"), bcrypt.MinCost)
	mockUserRepo := &mocks.MockUserRepo{
		GetByIDFunc: func(id string) (*models.User, error) {
			return &models.User{
				ID:           "user-123",
				Username:     "testuser",
				PasswordHash: string(hash),
			}, nil
		},
	}
	svc := newTestAuthService(mockUserRepo)

	err := svc.ChangePassword("user-123", "oldpassword123", "short")

	assert.ErrorIs(t, err, ErrPasswordTooShort)
}

func TestAuthService_HasPassword(t *testing.T) {
	tests := []struct {
		name         string
		passwordHash string
		expected     bool
	}{
		{"has password", "somehash", true},
		{"no password", "", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockUserRepo := &mocks.MockUserRepo{
				GetByIDFunc: func(id string) (*models.User, error) {
					return &models.User{
						ID:           "user-123",
						Username:     "testuser",
						PasswordHash: tt.passwordHash,
					}, nil
				},
			}
			svc := newTestAuthService(mockUserRepo)

			result, err := svc.HasPassword("user-123")

			require.NoError(t, err)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestAuthService_ResetPassword_Success(t *testing.T) {
	// For this test, we need to use a known token and its hash
	// The raw token and hash must match what hashToken would produce
	rawToken := "testtoken123456789012345678901234567890123456789012345678901234"
	tokenHash := hashToken(rawToken)

	mockUserRepo := &mocks.MockUserRepo{
		UpdatePasswordFunc: func(userID, passwordHash string) error {
			return nil
		},
	}
	mockResetRepo := &mocks.MockPasswordResetRepo{
		GetByTokenHashFunc: func(hash string) (*models.PasswordResetToken, error) {
			if hash == tokenHash {
				return &models.PasswordResetToken{
					ID:        "reset-123",
					UserID:    "user-123",
					TokenHash: hash,
					ExpiresAt: time.Now().Add(1 * time.Hour),
					UsedAt:    nil,
				}, nil
			}
			return nil, repository.ErrResetTokenNotFound
		},
		MarkUsedFunc: func(id string) error {
			return nil
		},
		DeleteByUserIDFunc: func(userID string) error {
			return nil
		},
	}
	mockEmailSvc := &mocks.MockEmailService{}

	svc := newTestAuthService(mockUserRepo)
	svc.WithPasswordReset(mockResetRepo, mockEmailSvc, 1)

	err := svc.ResetPassword(rawToken, "newpassword123")

	require.NoError(t, err)
}

func TestAuthService_ResetPassword_Expired(t *testing.T) {
	rawToken := "testtoken123456789012345678901234567890123456789012345678901234"
	tokenHash := hashToken(rawToken)

	mockUserRepo := &mocks.MockUserRepo{}
	mockResetRepo := &mocks.MockPasswordResetRepo{
		GetByTokenHashFunc: func(hash string) (*models.PasswordResetToken, error) {
			if hash == tokenHash {
				return &models.PasswordResetToken{
					ID:        "reset-123",
					UserID:    "user-123",
					TokenHash: hash,
					ExpiresAt: time.Now().Add(-1 * time.Hour), // expired
					UsedAt:    nil,
				}, nil
			}
			return nil, repository.ErrResetTokenNotFound
		},
	}
	mockEmailSvc := &mocks.MockEmailService{}

	svc := newTestAuthService(mockUserRepo)
	svc.WithPasswordReset(mockResetRepo, mockEmailSvc, 1)

	err := svc.ResetPassword(rawToken, "newpassword123")

	assert.ErrorIs(t, err, ErrResetTokenExpired)
}

func TestAuthService_ResetPassword_AlreadyUsed(t *testing.T) {
	rawToken := "testtoken123456789012345678901234567890123456789012345678901234"
	tokenHash := hashToken(rawToken)
	usedAt := time.Now().Add(-30 * time.Minute)

	mockUserRepo := &mocks.MockUserRepo{}
	mockResetRepo := &mocks.MockPasswordResetRepo{
		GetByTokenHashFunc: func(hash string) (*models.PasswordResetToken, error) {
			if hash == tokenHash {
				return &models.PasswordResetToken{
					ID:        "reset-123",
					UserID:    "user-123",
					TokenHash: hash,
					ExpiresAt: time.Now().Add(1 * time.Hour),
					UsedAt:    &usedAt,
				}, nil
			}
			return nil, repository.ErrResetTokenNotFound
		},
	}
	mockEmailSvc := &mocks.MockEmailService{}

	svc := newTestAuthService(mockUserRepo)
	svc.WithPasswordReset(mockResetRepo, mockEmailSvc, 1)

	err := svc.ResetPassword(rawToken, "newpassword123")

	assert.ErrorIs(t, err, ErrResetTokenUsed)
}

func TestAuthService_ResetPassword_Invalid(t *testing.T) {
	mockUserRepo := &mocks.MockUserRepo{}
	mockResetRepo := &mocks.MockPasswordResetRepo{
		GetByTokenHashFunc: func(hash string) (*models.PasswordResetToken, error) {
			return nil, repository.ErrResetTokenNotFound
		},
	}
	mockEmailSvc := &mocks.MockEmailService{}

	svc := newTestAuthService(mockUserRepo)
	svc.WithPasswordReset(mockResetRepo, mockEmailSvc, 1)

	err := svc.ResetPassword("invalidtoken", "newpassword123")

	assert.ErrorIs(t, err, ErrResetTokenInvalid)
}

func TestAuthService_RequestPasswordReset_Success(t *testing.T) {
	email := "test@example.com"
	emailSent := false

	mockUserRepo := &mocks.MockUserRepo{
		GetByEmailFunc: func(e string) (*models.User, error) {
			return &models.User{
				ID:           "user-123",
				Username:     "testuser",
				Email:        &email,
				PasswordHash: "somehash",
			}, nil
		},
	}
	mockResetRepo := &mocks.MockPasswordResetRepo{
		CountRecentByUserIDFunc: func(userID string, since time.Time) (int, error) {
			return 0, nil
		},
		CreateFunc: func(userID, tokenHash string, expiresAt time.Time) (*models.PasswordResetToken, error) {
			return &models.PasswordResetToken{
				ID:        "reset-123",
				UserID:    userID,
				TokenHash: tokenHash,
				ExpiresAt: expiresAt,
			}, nil
		},
	}
	mockEmailSvc := &mocks.MockEmailService{
		SendPasswordResetEmailFunc: func(toEmail, token string) error {
			emailSent = true
			assert.Equal(t, email, toEmail)
			assert.NotEmpty(t, token)
			return nil
		},
	}

	svc := newTestAuthService(mockUserRepo)
	svc.WithPasswordReset(mockResetRepo, mockEmailSvc, 1)

	err := svc.RequestPasswordReset(email)

	require.NoError(t, err)
	assert.True(t, emailSent)
}

func TestAuthService_RequestPasswordReset_UserNotFound(t *testing.T) {
	mockUserRepo := &mocks.MockUserRepo{
		GetByEmailFunc: func(e string) (*models.User, error) {
			return nil, repository.ErrUserNotFound
		},
	}
	mockResetRepo := &mocks.MockPasswordResetRepo{}
	mockEmailSvc := &mocks.MockEmailService{}

	svc := newTestAuthService(mockUserRepo)
	svc.WithPasswordReset(mockResetRepo, mockEmailSvc, 1)

	// Should return nil (no error) to prevent email enumeration
	err := svc.RequestPasswordReset("nonexistent@example.com")

	require.NoError(t, err)
}

func TestAuthService_RequestPasswordReset_OAuthOnly(t *testing.T) {
	email := "oauth@example.com"
	provider := "lichess"

	mockUserRepo := &mocks.MockUserRepo{
		GetByEmailFunc: func(e string) (*models.User, error) {
			return &models.User{
				ID:            "user-123",
				Username:      "oauthuser",
				Email:         &email,
				PasswordHash:  "",
				OAuthProvider: &provider,
			}, nil
		},
	}
	mockResetRepo := &mocks.MockPasswordResetRepo{}
	mockEmailSvc := &mocks.MockEmailService{}

	svc := newTestAuthService(mockUserRepo)
	svc.WithPasswordReset(mockResetRepo, mockEmailSvc, 1)

	// Should return nil (no error) - silently fail for OAuth-only users
	err := svc.RequestPasswordReset(email)

	require.NoError(t, err)
}
