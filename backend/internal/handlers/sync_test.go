package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/labstack/echo/v5"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/kumquat/backend/internal/models"
	"github.com/kumquat/backend/internal/repository/mocks"
	"github.com/kumquat/backend/internal/services"
	smocks "github.com/kumquat/backend/internal/services/mocks"
)

func TestHandleSync_Success(t *testing.T) {
	lichessUser := "lichessplayer"
	user := &models.User{
		ID:              "user-1",
		LichessUsername: &lichessUser,
	}

	mockUserRepo := &mocks.MockUserRepo{
		GetByIDFunc:              func(_ context.Context, id string) (*models.User, error) { return user, nil },
		UpdateSyncTimestampsFunc: func(_ context.Context, userID string, l, c *time.Time) error { return nil },
	}
	mockLichess := &smocks.MockLichessService{
		FetchGamesFunc: func(username string, opts models.LichessImportOptions) (string, error) {
			return "pgn data", nil
		},
	}
	mockImport := &smocks.MockImportService{
		ParseAndAnalyzeFunc: func(_ context.Context, filename, username, userID, pgnData string) (*models.AnalysisSummary, []models.GameAnalysis, error) {
			return &models.AnalysisSummary{GameCount: 5}, nil, nil
		},
	}

	syncSvc := services.NewSyncService(mockUserRepo, mockImport, mockLichess, &smocks.MockChesscomService{})
	handler := NewSyncHandler(syncSvc)

	e := echo.New()
	req := httptest.NewRequest(http.MethodPost, "/api/sync", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.Set("userID", "user-1")

	err := handler.HandleSync(c)

	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, rec.Code)

	var result models.SyncResult
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &result))
	assert.Equal(t, 5, result.LichessGamesImported)
}

func TestHandleSync_Error(t *testing.T) {
	mockUserRepo := &mocks.MockUserRepo{
		GetByIDFunc: func(_ context.Context, id string) (*models.User, error) {
			return nil, fmt.Errorf("database error")
		},
	}

	syncSvc := services.NewSyncService(mockUserRepo, &smocks.MockImportService{}, &smocks.MockLichessService{}, &smocks.MockChesscomService{})
	handler := NewSyncHandler(syncSvc)

	e := echo.New()
	req := httptest.NewRequest(http.MethodPost, "/api/sync", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.Set("userID", "user-1")

	_ = handler.HandleSync(c)

	assert.Equal(t, http.StatusInternalServerError, rec.Code)
}

func TestHandleSync_Cooldown(t *testing.T) {
	lichessUser := "lichessplayer"
	recentSync := time.Now().Add(-1 * time.Minute)
	user := &models.User{
		ID:                "user-1",
		LichessUsername:   &lichessUser,
		LastLichessSyncAt: &recentSync,
	}

	mockUserRepo := &mocks.MockUserRepo{
		GetByIDFunc: func(_ context.Context, id string) (*models.User, error) { return user, nil },
	}

	syncSvc := services.NewSyncService(mockUserRepo, &smocks.MockImportService{}, &smocks.MockLichessService{}, &smocks.MockChesscomService{})
	handler := NewSyncHandler(syncSvc)

	e := echo.New()
	req := httptest.NewRequest(http.MethodPost, "/api/sync", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.Set("userID", "user-1")

	_ = handler.HandleSync(c)

	assert.Equal(t, http.StatusTooManyRequests, rec.Code)
}
