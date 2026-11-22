package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/labstack/echo/v5"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/kumquat/backend/internal/models"
	"github.com/kumquat/backend/internal/repository"
	"github.com/kumquat/backend/internal/repository/mocks"
	"github.com/kumquat/backend/internal/services"
)

const testJWTSecret = "test-secret-key-32-chars-long!!!"

func newTestAuthHandler(userRepo repository.UserRepository) *AuthHandler {
	authSvc := services.NewAuthService(userRepo, testJWTSecret, 24*time.Hour)
	return NewAuthHandler(authSvc, false)
}

func TestMeHandler_Success(t *testing.T) {
	mockRepo := &mocks.MockUserRepo{
		GetByIDFunc: func(_ context.Context, id string) (*models.User, error) {
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
		GetByIDFunc: func(_ context.Context, id string) (*models.User, error) {
			return nil, repository.ErrUserNotFound
		},
	}
	handler := newTestAuthHandler(mockRepo)

	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/api/auth/me", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.Set("userID", "nonexistent")

	_ = handler.MeHandler(c)

	assert.Equal(t, http.StatusUnauthorized, rec.Code)
}
