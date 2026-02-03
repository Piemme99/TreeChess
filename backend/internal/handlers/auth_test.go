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
		CreateFunc: func(username, passwordHash string) (*models.User, error) {
			return &models.User{ID: "user-123", Username: username}, nil
		},
	}
	handler := newTestAuthHandler(mockRepo)

	e := echo.New()
	body := `{"username":"testuser","password":"password123"}`
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
		{"missing username", `{"password":"password123"}`},
		{"missing password", `{"username":"testuser"}`},
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
	body := `{"username":"ab","password":"password123"}`
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
	body := `{"username":"testuser","password":"short"}`
	req := httptest.NewRequest(http.MethodPost, "/api/auth/register", strings.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)

	handler.RegisterHandler(c)

	assert.Equal(t, http.StatusBadRequest, rec.Code)
}

func TestRegisterHandler_UsernameExists(t *testing.T) {
	mockRepo := &mocks.MockUserRepo{
		CreateFunc: func(username, passwordHash string) (*models.User, error) {
			return nil, repository.ErrUsernameExists
		},
	}
	handler := newTestAuthHandler(mockRepo)

	e := echo.New()
	body := `{"username":"existing","password":"password123"}`
	req := httptest.NewRequest(http.MethodPost, "/api/auth/register", strings.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)

	handler.RegisterHandler(c)

	assert.Equal(t, http.StatusConflict, rec.Code)
}

func TestLoginHandler_Success(t *testing.T) {
	hash, _ := bcrypt.GenerateFromPassword([]byte("password123"), bcrypt.MinCost)
	mockRepo := &mocks.MockUserRepo{
		GetByUsernameFunc: func(username string) (*models.User, error) {
			return &models.User{ID: "user-123", Username: username, PasswordHash: string(hash)}, nil
		},
	}
	handler := newTestAuthHandler(mockRepo)

	e := echo.New()
	body := `{"username":"testuser","password":"password123"}`
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
		GetByUsernameFunc: func(username string) (*models.User, error) {
			return nil, repository.ErrUserNotFound
		},
	}
	handler := newTestAuthHandler(mockRepo)

	e := echo.New()
	body := `{"username":"nonexistent","password":"password123"}`
	req := httptest.NewRequest(http.MethodPost, "/api/auth/login", strings.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)

	handler.LoginHandler(c)

	assert.Equal(t, http.StatusUnauthorized, rec.Code)
}

func TestLoginHandler_MissingFields(t *testing.T) {
	handler := newTestAuthHandler(&mocks.MockUserRepo{})

	e := echo.New()
	body := `{"username":"testuser"}`
	req := httptest.NewRequest(http.MethodPost, "/api/auth/login", strings.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)

	handler.LoginHandler(c)

	assert.Equal(t, http.StatusBadRequest, rec.Code)
}

func TestLoginHandler_OAuthOnly(t *testing.T) {
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
	handler := newTestAuthHandler(mockRepo)

	e := echo.New()
	body := `{"username":"oauthuser","password":"anypass123"}`
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
