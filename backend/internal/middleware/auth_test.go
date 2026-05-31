package middleware

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/labstack/echo/v5"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// mockTokenValidator is a lightweight mock for testing JWTAuth middleware.
type mockTokenValidator struct {
	validateFunc func(token string) (string, error)
}

func (m *mockTokenValidator) ValidateToken(_ context.Context, token string) (string, error) {
	return m.validateFunc(token)
}

func validValidator() *mockTokenValidator {
	return &mockTokenValidator{
		validateFunc: func(token string) (string, error) {
			if token == "valid-token" {
				return "user-123", nil
			}
			return "", errors.New("invalid token")
		},
	}
}

func TestJWTAuth_ValidToken(t *testing.T) {
	validator := validValidator()

	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/api/test", nil)
	req.Header.Set("Authorization", "Bearer valid-token")
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)

	middleware := JWTAuth(validator)
	handler := middleware(func(c *echo.Context) error {
		userID := c.Get("userID").(string)
		assert.Equal(t, "user-123", userID)
		return c.String(http.StatusOK, "ok")
	})

	err := handler(c)

	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, rec.Code)
}

func TestJWTAuth_MissingToken(t *testing.T) {
	validator := validValidator()

	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/api/test", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)

	middleware := JWTAuth(validator)
	handler := middleware(func(c *echo.Context) error {
		t.Fatal("should not reach handler")
		return nil
	})

	err := handler(c)

	require.NoError(t, err)
	assert.Equal(t, http.StatusUnauthorized, rec.Code)
}

func TestJWTAuth_InvalidToken(t *testing.T) {
	validator := validValidator()

	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/api/test", nil)
	req.Header.Set("Authorization", "Bearer invalid-token")
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)

	middleware := JWTAuth(validator)
	handler := middleware(func(c *echo.Context) error {
		t.Fatal("should not reach handler")
		return nil
	})

	err := handler(c)

	require.NoError(t, err)
	assert.Equal(t, http.StatusUnauthorized, rec.Code)
}

func TestJWTAuth_QueryParamFallback(t *testing.T) {
	validator := validValidator()

	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/api/test?token=valid-token", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)

	middleware := JWTAuth(validator)
	handler := middleware(func(c *echo.Context) error {
		userID := c.Get("userID").(string)
		assert.Equal(t, "user-123", userID)
		return c.String(http.StatusOK, "ok")
	})

	err := handler(c)

	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, rec.Code)
}

func TestJWTAuth_BearerPrefixStripping(t *testing.T) {
	validator := validValidator()

	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/api/test", nil)
	req.Header.Set("Authorization", "Bearer valid-token")
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)

	mw := JWTAuth(validator)
	handler := mw(func(c *echo.Context) error {
		return c.String(http.StatusOK, "ok")
	})

	err := handler(c)

	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, rec.Code)
}
