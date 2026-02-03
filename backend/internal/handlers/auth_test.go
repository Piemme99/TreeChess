package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"golang.org/x/crypto/bcrypt"

	"github.com/treechess/backend/internal/models"
	"github.com/treechess/backend/internal/repository"
	"github.com/treechess/backend/internal/repository/mocks"
	"github.com/treechess/backend/internal/services"
)

const testJWTSecret = "test-secret-key-32-chars-long!!!"

func newTestAuthHandler(userRepo repository.UserRepository) *AuthHandler {
	authSvc := services.NewAuthService(userRepo, testJWTSecret, 24*time.Hour)
	return NewAuthHandler(authSvc)
}

func TestRegisterHandler_Success(t *testing.T) {
	mockRepo := &mocks.MockUserRepo{
		CreateFunc: func(email, username, passwordHash string) (*models.User, error) {
			return &models.User{ID: "user-123", Username: username, Email: &email}, nil
		},
	}
	handler := newTestAuthHandler(mockRepo)

	e := echo.New()
	body := `{"email":"test@example.com","username":"testuser","password":"password123"}`
	req := httptest.NewRequest(http.MethodPost, "/api/auth/register", strings.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)

	err := handler.RegisterHandler(c)

	require.NoError(t, err)
	assert.Equal(t, http.StatusCreated, rec.Code)

	var resp models.AuthResponse
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &resp))
	assert.NotEmpty(t, resp.Token)
	assert.Equal(t, "testuser", resp.User.Username)
}

func TestRegisterHandler_MissingFields(t *testing.T) {
	handler := newTestAuthHandler(&mocks.MockUserRepo{})

	tests := []struct {
		name string
		body string
	}{
		{"missing email", `{"username":"testuser","password":"password123"}`},
		{"missing username", `{"email":"test@example.com","password":"password123"}`},
		{"missing password", `{"email":"test@example.com","username":"testuser"}`},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			e := echo.New()
			req := httptest.NewRequest(http.MethodPost, "/api/auth/register", strings.NewReader(tt.body))
			req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
			rec := httptest.NewRecorder()
			c := e.NewContext(req, rec)

			handler.RegisterHandler(c)

			assert.Equal(t, http.StatusBadRequest, rec.Code)
		})
	}
}

func TestRegisterHandler_InvalidUsername(t *testing.T) {
	handler := newTestAuthHandler(&mocks.MockUserRepo{})

	e := echo.New()
	body := `{"email":"test@example.com","username":"ab","password":"password123"}`
	req := httptest.NewRequest(http.MethodPost, "/api/auth/register", strings.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)

	handler.RegisterHandler(c)

	assert.Equal(t, http.StatusBadRequest, rec.Code)
}

func TestRegisterHandler_InvalidEmail(t *testing.T) {
	handler := newTestAuthHandler(&mocks.MockUserRepo{})

	e := echo.New()
	body := `{"email":"not-an-email","username":"testuser","password":"password123"}`
	req := httptest.NewRequest(http.MethodPost, "/api/auth/register", strings.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)

	handler.RegisterHandler(c)

	assert.Equal(t, http.StatusBadRequest, rec.Code)
}

func TestRegisterHandler_PasswordTooShort(t *testing.T) {
	handler := newTestAuthHandler(&mocks.MockUserRepo{})

	e := echo.New()
	body := `{"email":"test@example.com","username":"testuser","password":"short"}`
	req := httptest.NewRequest(http.MethodPost, "/api/auth/register", strings.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)

	handler.RegisterHandler(c)

	assert.Equal(t, http.StatusBadRequest, rec.Code)
}

func TestRegisterHandler_UsernameExists(t *testing.T) {
	mockRepo := &mocks.MockUserRepo{
		CreateFunc: func(email, username, passwordHash string) (*models.User, error) {
			return nil, repository.ErrUsernameExists
		},
	}
	handler := newTestAuthHandler(mockRepo)

	e := echo.New()
	body := `{"email":"test@example.com","username":"existing","password":"password123"}`
	req := httptest.NewRequest(http.MethodPost, "/api/auth/register", strings.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)

	handler.RegisterHandler(c)

	assert.Equal(t, http.StatusConflict, rec.Code)
}

func TestRegisterHandler_EmailExists(t *testing.T) {
	mockRepo := &mocks.MockUserRepo{
		CreateFunc: func(email, username, passwordHash string) (*models.User, error) {
			return nil, repository.ErrEmailExists
		},
	}
	handler := newTestAuthHandler(mockRepo)

	e := echo.New()
	body := `{"email":"existing@example.com","username":"newuser","password":"password123"}`
	req := httptest.NewRequest(http.MethodPost, "/api/auth/register", strings.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)

	handler.RegisterHandler(c)

	assert.Equal(t, http.StatusConflict, rec.Code)
}

func TestLoginHandler_Success(t *testing.T) {
	hash, _ := bcrypt.GenerateFromPassword([]byte("password123"), bcrypt.MinCost)
	email := "test@example.com"
	mockRepo := &mocks.MockUserRepo{
		GetByEmailFunc: func(e string) (*models.User, error) {
			return &models.User{ID: "user-123", Username: "testuser", Email: &email, PasswordHash: string(hash)}, nil
		},
	}
	handler := newTestAuthHandler(mockRepo)

	e := echo.New()
	body := `{"email":"test@example.com","password":"password123"}`
	req := httptest.NewRequest(http.MethodPost, "/api/auth/login", strings.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)

	err := handler.LoginHandler(c)

	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, rec.Code)

	var resp models.AuthResponse
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &resp))
	assert.NotEmpty(t, resp.Token)
}

func TestLoginHandler_InvalidCredentials(t *testing.T) {
	mockRepo := &mocks.MockUserRepo{
		GetByEmailFunc: func(email string) (*models.User, error) {
			return nil, repository.ErrUserNotFound
		},
	}
	handler := newTestAuthHandler(mockRepo)

	e := echo.New()
	body := `{"email":"nonexistent@example.com","password":"password123"}`
	req := httptest.NewRequest(http.MethodPost, "/api/auth/login", strings.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)

	handler.LoginHandler(c)

	assert.Equal(t, http.StatusUnauthorized, rec.Code)
}

func TestLoginHandler_MissingFields(t *testing.T) {
	handler := newTestAuthHandler(&mocks.MockUserRepo{})

	tests := []struct {
		name string
		body string
	}{
		{"missing email", `{"password":"password123"}`},
		{"missing password", `{"email":"test@example.com"}`},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			e := echo.New()
			req := httptest.NewRequest(http.MethodPost, "/api/auth/login", strings.NewReader(tt.body))
			req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
			rec := httptest.NewRecorder()
			c := e.NewContext(req, rec)

			handler.LoginHandler(c)

			assert.Equal(t, http.StatusBadRequest, rec.Code)
		})
	}
}

func TestLoginHandler_OAuthOnly(t *testing.T) {
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
	handler := newTestAuthHandler(mockRepo)

	e := echo.New()
	body := `{"email":"oauth@example.com","password":"anypass123"}`
	req := httptest.NewRequest(http.MethodPost, "/api/auth/login", strings.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)

	handler.LoginHandler(c)

	assert.Equal(t, http.StatusBadRequest, rec.Code)
}

func TestMeHandler_Success(t *testing.T) {
	mockRepo := &mocks.MockUserRepo{
		GetByIDFunc: func(id string) (*models.User, error) {
			return &models.User{ID: id, Username: "testuser"}, nil
		},
	}
	handler := newTestAuthHandler(mockRepo)

	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/api/auth/me", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.Set("userID", "user-123")

	err := handler.MeHandler(c)

	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, rec.Code)

	var user models.User
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &user))
	assert.Equal(t, "testuser", user.Username)
}

func TestMeHandler_NotFound(t *testing.T) {
	mockRepo := &mocks.MockUserRepo{
		GetByIDFunc: func(id string) (*models.User, error) {
			return nil, repository.ErrUserNotFound
		},
	}
	handler := newTestAuthHandler(mockRepo)

	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/api/auth/me", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.Set("userID", "nonexistent")

	handler.MeHandler(c)

	assert.Equal(t, http.StatusUnauthorized, rec.Code)
}

func TestUpdateProfileHandler_Success(t *testing.T) {
	lichess := "lichessuser"
	mockRepo := &mocks.MockUserRepo{
		UpdateProfileFunc: func(userID string, l, c *string, timeFormatPrefs []string) (*models.User, error) {
			return &models.User{
				ID:              userID,
				Username:        "testuser",
				LichessUsername: l,
			}, nil
		},
	}
	handler := newTestAuthHandler(mockRepo)

	e := echo.New()
	body := `{"lichessUsername":"` + lichess + `"}`
	req := httptest.NewRequest(http.MethodPut, "/api/auth/profile", strings.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.Set("userID", "user-123")

	err := handler.UpdateProfileHandler(c)

	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, rec.Code)
}

func TestUpdateProfileHandler_NotFound(t *testing.T) {
	mockRepo := &mocks.MockUserRepo{
		UpdateProfileFunc: func(userID string, l, c *string, timeFormatPrefs []string) (*models.User, error) {
			return nil, repository.ErrUserNotFound
		},
	}
	handler := newTestAuthHandler(mockRepo)

	e := echo.New()
	body := `{}`
	req := httptest.NewRequest(http.MethodPut, "/api/auth/profile", strings.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.Set("userID", "nonexistent")

	handler.UpdateProfileHandler(c)

	assert.Equal(t, http.StatusUnauthorized, rec.Code)
}

// Helper to create auth handler with password reset support
func newTestAuthHandlerWithPasswordReset(
	userRepo repository.UserRepository,
	resetRepo repository.PasswordResetRepository,
	emailSvc services.EmailSender,
) *AuthHandler {
	authSvc := services.NewAuthService(userRepo, testJWTSecret, 24*time.Hour)
	authSvc.WithPasswordReset(resetRepo, emailSvc, 1)
	return NewAuthHandler(authSvc)
}

// --- ForgotPasswordHandler Tests ---

func TestForgotPasswordHandler_Success(t *testing.T) {
	email := "test@example.com"
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
			return &models.PasswordResetToken{ID: "reset-123"}, nil
		},
	}
	mockEmailSvc := &mocks.MockEmailService{}

	handler := newTestAuthHandlerWithPasswordReset(mockUserRepo, mockResetRepo, mockEmailSvc)

	e := echo.New()
	body := `{"email":"test@example.com"}`
	req := httptest.NewRequest(http.MethodPost, "/api/auth/forgot-password", strings.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)

	err := handler.ForgotPasswordHandler(c)

	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, rec.Code)

	var resp map[string]string
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &resp))
	assert.Contains(t, resp["message"], "If an account with that email exists")
}

func TestForgotPasswordHandler_NonexistentEmail(t *testing.T) {
	// Should still return 200 to prevent email enumeration
	mockUserRepo := &mocks.MockUserRepo{
		GetByEmailFunc: func(e string) (*models.User, error) {
			return nil, repository.ErrUserNotFound
		},
	}
	mockResetRepo := &mocks.MockPasswordResetRepo{}
	mockEmailSvc := &mocks.MockEmailService{}

	handler := newTestAuthHandlerWithPasswordReset(mockUserRepo, mockResetRepo, mockEmailSvc)

	e := echo.New()
	body := `{"email":"nonexistent@example.com"}`
	req := httptest.NewRequest(http.MethodPost, "/api/auth/forgot-password", strings.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)

	err := handler.ForgotPasswordHandler(c)

	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, rec.Code)
}

func TestForgotPasswordHandler_MissingEmail(t *testing.T) {
	handler := newTestAuthHandler(&mocks.MockUserRepo{})

	e := echo.New()
	body := `{}`
	req := httptest.NewRequest(http.MethodPost, "/api/auth/forgot-password", strings.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)

	handler.ForgotPasswordHandler(c)

	assert.Equal(t, http.StatusBadRequest, rec.Code)
}

// --- ResetPasswordHandler Tests ---

func TestResetPasswordHandler_Success(t *testing.T) {
	mockUserRepo := &mocks.MockUserRepo{
		UpdatePasswordFunc: func(userID, passwordHash string) error {
			return nil
		},
	}
	mockResetRepo := &mocks.MockPasswordResetRepo{
		GetByTokenHashFunc: func(hash string) (*models.PasswordResetToken, error) {
			return &models.PasswordResetToken{
				ID:        "reset-123",
				UserID:    "user-123",
				TokenHash: hash,
				ExpiresAt: time.Now().Add(1 * time.Hour),
				UsedAt:    nil,
			}, nil
		},
		MarkUsedFunc: func(id string) error {
			return nil
		},
		DeleteByUserIDFunc: func(userID string) error {
			return nil
		},
	}
	mockEmailSvc := &mocks.MockEmailService{}

	handler := newTestAuthHandlerWithPasswordReset(mockUserRepo, mockResetRepo, mockEmailSvc)

	e := echo.New()
	body := `{"token":"validtoken123","newPassword":"newpassword123"}`
	req := httptest.NewRequest(http.MethodPost, "/api/auth/reset-password", strings.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)

	err := handler.ResetPasswordHandler(c)

	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, rec.Code)

	var resp map[string]string
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &resp))
	assert.Contains(t, resp["message"], "reset successfully")
}

func TestResetPasswordHandler_InvalidToken(t *testing.T) {
	mockUserRepo := &mocks.MockUserRepo{}
	mockResetRepo := &mocks.MockPasswordResetRepo{
		GetByTokenHashFunc: func(hash string) (*models.PasswordResetToken, error) {
			return nil, repository.ErrResetTokenNotFound
		},
	}
	mockEmailSvc := &mocks.MockEmailService{}

	handler := newTestAuthHandlerWithPasswordReset(mockUserRepo, mockResetRepo, mockEmailSvc)

	e := echo.New()
	body := `{"token":"invalidtoken","newPassword":"newpassword123"}`
	req := httptest.NewRequest(http.MethodPost, "/api/auth/reset-password", strings.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)

	handler.ResetPasswordHandler(c)

	assert.Equal(t, http.StatusBadRequest, rec.Code)

	var resp map[string]string
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &resp))
	assert.Contains(t, resp["error"], "invalid")
}

func TestResetPasswordHandler_ExpiredToken(t *testing.T) {
	mockUserRepo := &mocks.MockUserRepo{}
	mockResetRepo := &mocks.MockPasswordResetRepo{
		GetByTokenHashFunc: func(hash string) (*models.PasswordResetToken, error) {
			return &models.PasswordResetToken{
				ID:        "reset-123",
				UserID:    "user-123",
				TokenHash: hash,
				ExpiresAt: time.Now().Add(-1 * time.Hour), // expired
				UsedAt:    nil,
			}, nil
		},
	}
	mockEmailSvc := &mocks.MockEmailService{}

	handler := newTestAuthHandlerWithPasswordReset(mockUserRepo, mockResetRepo, mockEmailSvc)

	e := echo.New()
	body := `{"token":"expiredtoken","newPassword":"newpassword123"}`
	req := httptest.NewRequest(http.MethodPost, "/api/auth/reset-password", strings.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)

	handler.ResetPasswordHandler(c)

	assert.Equal(t, http.StatusBadRequest, rec.Code)

	var resp map[string]string
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &resp))
	assert.Contains(t, resp["error"], "expired")
}

func TestResetPasswordHandler_UsedToken(t *testing.T) {
	usedAt := time.Now().Add(-30 * time.Minute)
	mockUserRepo := &mocks.MockUserRepo{}
	mockResetRepo := &mocks.MockPasswordResetRepo{
		GetByTokenHashFunc: func(hash string) (*models.PasswordResetToken, error) {
			return &models.PasswordResetToken{
				ID:        "reset-123",
				UserID:    "user-123",
				TokenHash: hash,
				ExpiresAt: time.Now().Add(1 * time.Hour),
				UsedAt:    &usedAt,
			}, nil
		},
	}
	mockEmailSvc := &mocks.MockEmailService{}

	handler := newTestAuthHandlerWithPasswordReset(mockUserRepo, mockResetRepo, mockEmailSvc)

	e := echo.New()
	body := `{"token":"usedtoken","newPassword":"newpassword123"}`
	req := httptest.NewRequest(http.MethodPost, "/api/auth/reset-password", strings.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)

	handler.ResetPasswordHandler(c)

	assert.Equal(t, http.StatusBadRequest, rec.Code)

	var resp map[string]string
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &resp))
	assert.Contains(t, resp["error"], "already been used")
}

func TestResetPasswordHandler_ShortPassword(t *testing.T) {
	mockUserRepo := &mocks.MockUserRepo{}
	mockResetRepo := &mocks.MockPasswordResetRepo{
		GetByTokenHashFunc: func(hash string) (*models.PasswordResetToken, error) {
			return &models.PasswordResetToken{
				ID:        "reset-123",
				UserID:    "user-123",
				TokenHash: hash,
				ExpiresAt: time.Now().Add(1 * time.Hour),
				UsedAt:    nil,
			}, nil
		},
	}
	mockEmailSvc := &mocks.MockEmailService{}

	handler := newTestAuthHandlerWithPasswordReset(mockUserRepo, mockResetRepo, mockEmailSvc)

	e := echo.New()
	body := `{"token":"validtoken","newPassword":"short"}`
	req := httptest.NewRequest(http.MethodPost, "/api/auth/reset-password", strings.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)

	handler.ResetPasswordHandler(c)

	assert.Equal(t, http.StatusBadRequest, rec.Code)

	var resp map[string]string
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &resp))
	assert.Contains(t, resp["error"], "8 characters")
}

func TestResetPasswordHandler_MissingFields(t *testing.T) {
	handler := newTestAuthHandler(&mocks.MockUserRepo{})

	tests := []struct {
		name string
		body string
	}{
		{"missing token", `{"newPassword":"newpassword123"}`},
		{"missing newPassword", `{"token":"sometoken"}`},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			e := echo.New()
			req := httptest.NewRequest(http.MethodPost, "/api/auth/reset-password", strings.NewReader(tt.body))
			req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
			rec := httptest.NewRecorder()
			c := e.NewContext(req, rec)

			handler.ResetPasswordHandler(c)

			assert.Equal(t, http.StatusBadRequest, rec.Code)
		})
	}
}

// --- ChangePasswordHandler Tests ---

func TestChangePasswordHandler_Success(t *testing.T) {
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
	handler := newTestAuthHandler(mockUserRepo)

	e := echo.New()
	body := `{"currentPassword":"oldpassword123","newPassword":"newpassword123"}`
	req := httptest.NewRequest(http.MethodPost, "/api/auth/change-password", strings.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.Set("userID", "user-123")

	err := handler.ChangePasswordHandler(c)

	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, rec.Code)

	var resp map[string]string
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &resp))
	assert.Contains(t, resp["message"], "changed successfully")
}

func TestChangePasswordHandler_IncorrectCurrent(t *testing.T) {
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
	handler := newTestAuthHandler(mockUserRepo)

	e := echo.New()
	body := `{"currentPassword":"wrongpassword","newPassword":"newpassword123"}`
	req := httptest.NewRequest(http.MethodPost, "/api/auth/change-password", strings.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.Set("userID", "user-123")

	handler.ChangePasswordHandler(c)

	assert.Equal(t, http.StatusBadRequest, rec.Code)

	var resp map[string]string
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &resp))
	assert.Contains(t, resp["error"], "incorrect")
}

func TestChangePasswordHandler_NoPassword(t *testing.T) {
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
	handler := newTestAuthHandler(mockUserRepo)

	e := echo.New()
	body := `{"currentPassword":"anypassword","newPassword":"newpassword123"}`
	req := httptest.NewRequest(http.MethodPost, "/api/auth/change-password", strings.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.Set("userID", "user-123")

	handler.ChangePasswordHandler(c)

	assert.Equal(t, http.StatusBadRequest, rec.Code)

	var resp map[string]string
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &resp))
	assert.Contains(t, resp["error"], "does not have a password")
}

func TestChangePasswordHandler_ShortNewPassword(t *testing.T) {
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
	handler := newTestAuthHandler(mockUserRepo)

	e := echo.New()
	body := `{"currentPassword":"oldpassword123","newPassword":"short"}`
	req := httptest.NewRequest(http.MethodPost, "/api/auth/change-password", strings.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.Set("userID", "user-123")

	handler.ChangePasswordHandler(c)

	assert.Equal(t, http.StatusBadRequest, rec.Code)

	var resp map[string]string
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &resp))
	assert.Contains(t, resp["error"], "8 characters")
}

func TestChangePasswordHandler_MissingFields(t *testing.T) {
	handler := newTestAuthHandler(&mocks.MockUserRepo{})

	tests := []struct {
		name string
		body string
	}{
		{"missing currentPassword", `{"newPassword":"newpassword123"}`},
		{"missing newPassword", `{"currentPassword":"oldpassword123"}`},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			e := echo.New()
			req := httptest.NewRequest(http.MethodPost, "/api/auth/change-password", strings.NewReader(tt.body))
			req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
			rec := httptest.NewRecorder()
			c := e.NewContext(req, rec)
			c.Set("userID", "user-123")

			handler.ChangePasswordHandler(c)

			assert.Equal(t, http.StatusBadRequest, rec.Code)
		})
	}
}

func TestChangePasswordHandler_UserNotFound(t *testing.T) {
	mockUserRepo := &mocks.MockUserRepo{
		GetByIDFunc: func(id string) (*models.User, error) {
			return nil, repository.ErrUserNotFound
		},
	}
	handler := newTestAuthHandler(mockUserRepo)

	e := echo.New()
	body := `{"currentPassword":"oldpassword123","newPassword":"newpassword123"}`
	req := httptest.NewRequest(http.MethodPost, "/api/auth/change-password", strings.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.Set("userID", "nonexistent")

	handler.ChangePasswordHandler(c)

	assert.Equal(t, http.StatusUnauthorized, rec.Code)
}

// --- HasPasswordHandler Tests ---

func TestHasPasswordHandler_HasPassword(t *testing.T) {
	mockUserRepo := &mocks.MockUserRepo{
		GetByIDFunc: func(id string) (*models.User, error) {
			return &models.User{
				ID:           "user-123",
				Username:     "testuser",
				PasswordHash: "somehash",
			}, nil
		},
	}
	handler := newTestAuthHandler(mockUserRepo)

	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/api/auth/has-password", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.Set("userID", "user-123")

	err := handler.HasPasswordHandler(c)

	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, rec.Code)

	var resp models.HasPasswordResponse
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &resp))
	assert.True(t, resp.HasPassword)
}

func TestHasPasswordHandler_NoPassword(t *testing.T) {
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
	handler := newTestAuthHandler(mockUserRepo)

	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/api/auth/has-password", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.Set("userID", "user-123")

	err := handler.HasPasswordHandler(c)

	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, rec.Code)

	var resp models.HasPasswordResponse
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &resp))
	assert.False(t, resp.HasPassword)
}

func TestHasPasswordHandler_UserNotFound(t *testing.T) {
	mockUserRepo := &mocks.MockUserRepo{
		GetByIDFunc: func(id string) (*models.User, error) {
			return nil, repository.ErrUserNotFound
		},
	}
	handler := newTestAuthHandler(mockUserRepo)

	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/api/auth/has-password", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.Set("userID", "nonexistent")

	handler.HasPasswordHandler(c)

	assert.Equal(t, http.StatusUnauthorized, rec.Code)
}
