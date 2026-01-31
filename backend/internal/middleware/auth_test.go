package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/treechess/backend/internal/models"
	"github.com/treechess/backend/internal/repository/mocks"
	"github.com/treechess/backend/internal/services"
)

const testJWTSecret = "test-secret-key-32-chars-long!!!"

func newTestAuthService() *services.AuthService {
	return services.NewAuthService(&mocks.MockUserRepo{}, testJWTSecret, 24*time.Hour)
}

func generateTestToken(t *testing.T) string {
	authSvc := newTestAuthService()
	// Register a user to get a valid token
	mockRepo := &mocks.MockUserRepo{
		CreateFunc: func(username, passwordHash string) (*models.User, error) {
			return &models.User{ID: "user-123", Username: username}, nil
		},
	}
	svc := services.NewAuthService(mockRepo, testJWTSecret, 24*time.Hour)
	resp, err := svc.Register("testuser", "password123")
	require.NoError(t, err)
	_ = authSvc
	return resp.Token
}

func TestJWTAuth_ValidToken(t *testing.T) {
	token := generateTestToken(t)
	authSvc := newTestAuthService()

	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/api/test", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)

	middleware := JWTAuth(authSvc)
	handler := middleware(func(c echo.Context) error {
		userID := c.Get("userID").(string)
		assert.Equal(t, "user-123", userID)
		return c.String(http.StatusOK, "ok")
	})

	err := handler(c)

	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, rec.Code)
}

func TestJWTAuth_MissingToken(t *testing.T) {
	authSvc := newTestAuthService()

	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/api/test", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)

	middleware := JWTAuth(authSvc)
	handler := middleware(func(c echo.Context) error {
		t.Fatal("should not reach handler")
		return nil
	})

	err := handler(c)

	require.NoError(t, err)
	assert.Equal(t, http.StatusUnauthorized, rec.Code)
}

func TestJWTAuth_InvalidToken(t *testing.T) {
	authSvc := newTestAuthService()

	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/api/test", nil)
	req.Header.Set("Authorization", "Bearer invalid-token")
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)

	middleware := JWTAuth(authSvc)
	handler := middleware(func(c echo.Context) error {
		t.Fatal("should not reach handler")
		return nil
	})

	err := handler(c)

	require.NoError(t, err)
	assert.Equal(t, http.StatusUnauthorized, rec.Code)
}

func TestJWTAuth_QueryParamFallback(t *testing.T) {
	token := generateTestToken(t)
	authSvc := newTestAuthService()

	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/api/test?token="+token, nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)

	middleware := JWTAuth(authSvc)
	handler := middleware(func(c echo.Context) error {
		userID := c.Get("userID").(string)
		assert.Equal(t, "user-123", userID)
		return c.String(http.StatusOK, "ok")
	})

	err := handler(c)

	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, rec.Code)
}

func TestJWTAuth_BearerPrefixStripping(t *testing.T) {
	token := generateTestToken(t)
	authSvc := newTestAuthService()

	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/api/test", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)

	mw := JWTAuth(authSvc)
	handler := mw(func(c echo.Context) error {
		return c.String(http.StatusOK, "ok")
	})

	err := handler(c)

	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, rec.Code)
}
