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

	"github.com/treechess/backend/internal/models"
	"github.com/treechess/backend/internal/repository"
	"github.com/treechess/backend/internal/repository/mocks"
	"github.com/treechess/backend/internal/services"

	"github.com/treechess/backend/config"
)

func newTestVideoHandler(mockRepo *mocks.MockVideoRepo) *VideoHandler {
	treeSvc := services.NewTreeBuilderService()
	cfg := config.Config{}
	videoSvc := services.NewVideoService(mockRepo, cfg, treeSvc)
	repertoireSvc := newTestRepertoireService()
	return NewVideoHandler(videoSvc, repertoireSvc)
}

func TestVideoSubmitHandler_MissingURL(t *testing.T) {
	e := echo.New()
	body := `{}`
	req := httptest.NewRequest(http.MethodPost, "/api/video-imports", strings.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	setTestUserID(c)

	handler := newTestVideoHandler(&mocks.MockVideoRepo{})

	err := handler.SubmitHandler(c)

	require.NoError(t, err)
	assert.Equal(t, http.StatusBadRequest, rec.Code)

	var response map[string]string
	err = json.Unmarshal(rec.Body.Bytes(), &response)
	require.NoError(t, err)
	assert.Contains(t, response["error"], "youtubeUrl is required")
}

func TestVideoSubmitHandler_InvalidURL(t *testing.T) {
	e := echo.New()
	body := `{"youtubeUrl":"not-a-youtube-url"}`
	req := httptest.NewRequest(http.MethodPost, "/api/video-imports", strings.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	setTestUserID(c)

	handler := newTestVideoHandler(&mocks.MockVideoRepo{})

	err := handler.SubmitHandler(c)

	require.NoError(t, err)
	assert.Equal(t, http.StatusBadRequest, rec.Code)

	var response map[string]string
	err = json.Unmarshal(rec.Body.Bytes(), &response)
	require.NoError(t, err)
	assert.Contains(t, response["error"], "invalid YouTube URL")
}

func TestVideoSubmitHandler_ValidURL(t *testing.T) {
	e := echo.New()
	body := `{"youtubeUrl":"https://www.youtube.com/watch?v=dQw4w9WgXcQ"}`
	req := httptest.NewRequest(http.MethodPost, "/api/video-imports", strings.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	setTestUserID(c)

	mockRepo := &mocks.MockVideoRepo{
		CreateImportFunc: func(userID string, youtubeURL, youtubeID, title string) (*models.VideoImport, error) {
			return &models.VideoImport{
				ID:         "test-import-id",
				YouTubeURL: youtubeURL,
				YouTubeID:  youtubeID,
				Status:     models.VideoStatusPending,
				CreatedAt:  time.Now(),
			}, nil
		},
		// The processVideo goroutine will call these - provide stubs to prevent panics
		UpdateImportStatusFunc: func(id string, status models.VideoImportStatus, progress int, errorMsg *string) error {
			return nil
		},
	}
	handler := newTestVideoHandler(mockRepo)

	err := handler.SubmitHandler(c)

	require.NoError(t, err)
	assert.Equal(t, http.StatusCreated, rec.Code)

	var response models.VideoImport
	err = json.Unmarshal(rec.Body.Bytes(), &response)
	require.NoError(t, err)
	assert.Equal(t, "test-import-id", response.ID)
	assert.Equal(t, "dQw4w9WgXcQ", response.YouTubeID)
}

func TestVideoListHandler_Empty(t *testing.T) {
	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/api/video-imports", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	setTestUserID(c)

	mockRepo := &mocks.MockVideoRepo{
		GetAllImportsFunc: func(userID string) ([]models.VideoImport, error) {
			return nil, nil
		},
	}
	handler := newTestVideoHandler(mockRepo)

	err := handler.ListHandler(c)

	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, rec.Code)

	var response []models.VideoImport
	err = json.Unmarshal(rec.Body.Bytes(), &response)
	require.NoError(t, err)
	assert.Len(t, response, 0)
}

func TestVideoListHandler_WithResults(t *testing.T) {
	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/api/video-imports", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	setTestUserID(c)

	mockRepo := &mocks.MockVideoRepo{
		GetAllImportsFunc: func(userID string) ([]models.VideoImport, error) {
			return []models.VideoImport{
				{ID: "id-1", YouTubeID: "abc", Title: "Chess Video", Status: models.VideoStatusCompleted},
				{ID: "id-2", YouTubeID: "def", Title: "Another Video", Status: models.VideoStatusPending},
			}, nil
		},
	}
	handler := newTestVideoHandler(mockRepo)

	err := handler.ListHandler(c)

	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, rec.Code)

	var response []models.VideoImport
	err = json.Unmarshal(rec.Body.Bytes(), &response)
	require.NoError(t, err)
	assert.Len(t, response, 2)
}

func TestVideoGetHandler_InvalidID(t *testing.T) {
	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/api/video-imports/not-a-uuid", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.SetParamNames("id")
	c.SetParamValues("not-a-uuid")
	setTestUserID(c)

	handler := newTestVideoHandler(&mocks.MockVideoRepo{})

	err := handler.GetHandler(c)

	require.NoError(t, err)
	assert.Equal(t, http.StatusBadRequest, rec.Code)
}

func TestVideoGetHandler_NotFound(t *testing.T) {
	e := echo.New()
	validUUID := "123e4567-e89b-12d3-a456-426614174000"
	req := httptest.NewRequest(http.MethodGet, "/api/video-imports/"+validUUID, nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.SetParamNames("id")
	c.SetParamValues(validUUID)
	setTestUserID(c)

	mockRepo := &mocks.MockVideoRepo{
		BelongsToUserFunc: func(id string, userID string) (bool, error) {
			return true, nil
		},
		GetImportByIDFunc: func(id string) (*models.VideoImport, error) {
			return nil, repository.ErrVideoImportNotFound
		},
	}
	handler := newTestVideoHandler(mockRepo)

	err := handler.GetHandler(c)

	require.NoError(t, err)
	assert.Equal(t, http.StatusNotFound, rec.Code)
}

func TestVideoGetHandler_Found(t *testing.T) {
	e := echo.New()
	validUUID := "123e4567-e89b-12d3-a456-426614174000"
	req := httptest.NewRequest(http.MethodGet, "/api/video-imports/"+validUUID, nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.SetParamNames("id")
	c.SetParamValues(validUUID)
	setTestUserID(c)

	mockRepo := &mocks.MockVideoRepo{
		BelongsToUserFunc: func(id string, userID string) (bool, error) {
			return true, nil
		},
		GetImportByIDFunc: func(id string) (*models.VideoImport, error) {
			return &models.VideoImport{
				ID:        id,
				YouTubeID: "abc123",
				Title:     "Test Video",
				Status:    models.VideoStatusCompleted,
			}, nil
		},
	}
	handler := newTestVideoHandler(mockRepo)

	err := handler.GetHandler(c)

	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, rec.Code)

	var response models.VideoImport
	err = json.Unmarshal(rec.Body.Bytes(), &response)
	require.NoError(t, err)
	assert.Equal(t, validUUID, response.ID)
	assert.Equal(t, "Test Video", response.Title)
}

func TestVideoDeleteHandler_InvalidID(t *testing.T) {
	e := echo.New()
	req := httptest.NewRequest(http.MethodDelete, "/api/video-imports/not-a-uuid", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.SetParamNames("id")
	c.SetParamValues("not-a-uuid")
	setTestUserID(c)

	handler := newTestVideoHandler(&mocks.MockVideoRepo{})

	err := handler.DeleteHandler(c)

	require.NoError(t, err)
	assert.Equal(t, http.StatusBadRequest, rec.Code)
}

func TestVideoDeleteHandler_NotFound(t *testing.T) {
	e := echo.New()
	validUUID := "123e4567-e89b-12d3-a456-426614174000"
	req := httptest.NewRequest(http.MethodDelete, "/api/video-imports/"+validUUID, nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.SetParamNames("id")
	c.SetParamValues(validUUID)
	setTestUserID(c)

	mockRepo := &mocks.MockVideoRepo{
		BelongsToUserFunc: func(id string, userID string) (bool, error) {
			return true, nil
		},
		DeleteImportFunc: func(id string) error {
			return repository.ErrVideoImportNotFound
		},
	}
	handler := newTestVideoHandler(mockRepo)

	err := handler.DeleteHandler(c)

	require.NoError(t, err)
	assert.Equal(t, http.StatusNotFound, rec.Code)
}

func TestVideoDeleteHandler_Success(t *testing.T) {
	e := echo.New()
	validUUID := "123e4567-e89b-12d3-a456-426614174000"
	req := httptest.NewRequest(http.MethodDelete, "/api/video-imports/"+validUUID, nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.SetParamNames("id")
	c.SetParamValues(validUUID)
	setTestUserID(c)

	mockRepo := &mocks.MockVideoRepo{
		BelongsToUserFunc: func(id string, userID string) (bool, error) {
			return true, nil
		},
		DeleteImportFunc: func(id string) error {
			return nil
		},
	}
	handler := newTestVideoHandler(mockRepo)

	err := handler.DeleteHandler(c)

	require.NoError(t, err)
	assert.Equal(t, http.StatusNoContent, rec.Code)
}

func TestVideoTreeHandler_InvalidID(t *testing.T) {
	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/api/video-imports/not-a-uuid/tree", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.SetParamNames("id")
	c.SetParamValues("not-a-uuid")
	setTestUserID(c)

	handler := newTestVideoHandler(&mocks.MockVideoRepo{})

	err := handler.TreeHandler(c)

	require.NoError(t, err)
	assert.Equal(t, http.StatusBadRequest, rec.Code)
}

func TestVideoTreeHandler_NoPositions(t *testing.T) {
	e := echo.New()
	validUUID := "123e4567-e89b-12d3-a456-426614174000"
	req := httptest.NewRequest(http.MethodGet, "/api/video-imports/"+validUUID+"/tree", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.SetParamNames("id")
	c.SetParamValues(validUUID)
	setTestUserID(c)

	mockRepo := &mocks.MockVideoRepo{
		BelongsToUserFunc: func(id string, userID string) (bool, error) {
			return true, nil
		},
		GetPositionsByImportIDFunc: func(importID string) ([]models.VideoPosition, error) {
			return nil, nil
		},
	}
	handler := newTestVideoHandler(mockRepo)

	err := handler.TreeHandler(c)

	require.NoError(t, err)
	assert.Equal(t, http.StatusInternalServerError, rec.Code)
}

func TestVideoTreeHandler_WithPositions(t *testing.T) {
	e := echo.New()
	validUUID := "123e4567-e89b-12d3-a456-426614174000"
	req := httptest.NewRequest(http.MethodGet, "/api/video-imports/"+validUUID+"/tree", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.SetParamNames("id")
	c.SetParamValues(validUUID)
	setTestUserID(c)

	mockRepo := &mocks.MockVideoRepo{
		BelongsToUserFunc: func(id string, userID string) (bool, error) {
			return true, nil
		},
		GetPositionsByImportIDFunc: func(importID string) ([]models.VideoPosition, error) {
			return []models.VideoPosition{
				{FEN: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -", FrameIndex: 0, TimestampSeconds: 0},
				{FEN: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3", FrameIndex: 1, TimestampSeconds: 1},
			}, nil
		},
	}
	handler := newTestVideoHandler(mockRepo)

	err := handler.TreeHandler(c)

	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, rec.Code)

	var response map[string]interface{}
	err = json.Unmarshal(rec.Body.Bytes(), &response)
	require.NoError(t, err)
	assert.NotNil(t, response["treeData"])
	assert.NotNil(t, response["color"])
}

func TestVideoSearchByFENHandler_MissingFEN(t *testing.T) {
	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/api/video-positions/search", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	setTestUserID(c)

	handler := newTestVideoHandler(&mocks.MockVideoRepo{})

	err := handler.SearchByFENHandler(c)

	require.NoError(t, err)
	assert.Equal(t, http.StatusBadRequest, rec.Code)

	var response map[string]string
	err = json.Unmarshal(rec.Body.Bytes(), &response)
	require.NoError(t, err)
	assert.Contains(t, response["error"], "fen parameter is required")
}

func TestVideoSearchByFENHandler_NoResults(t *testing.T) {
	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/api/video-positions/search?fen=test", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	setTestUserID(c)

	mockRepo := &mocks.MockVideoRepo{
		SearchPositionsByFENFunc: func(userID string, fen string) ([]models.VideoSearchResult, error) {
			return nil, nil
		},
	}
	handler := newTestVideoHandler(mockRepo)

	err := handler.SearchByFENHandler(c)

	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, rec.Code)

	var response []models.VideoSearchResult
	err = json.Unmarshal(rec.Body.Bytes(), &response)
	require.NoError(t, err)
	assert.Len(t, response, 0)
}

func TestVideoSearchByFENHandler_WithResults(t *testing.T) {
	e := echo.New()
	fen := "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR+b+KQkq+e3"
	req := httptest.NewRequest(http.MethodGet, "/api/video-positions/search?fen="+fen, nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	setTestUserID(c)

	mockRepo := &mocks.MockVideoRepo{
		SearchPositionsByFENFunc: func(userID string, f string) ([]models.VideoSearchResult, error) {
			return []models.VideoSearchResult{
				{
					VideoImport: models.VideoImport{
						ID:        "vi-1",
						YouTubeID: "abc",
						Title:     "Chess Lesson",
						Status:    models.VideoStatusCompleted,
					},
					Positions: []models.VideoPosition{
						{ID: "vp-1", FEN: f, TimestampSeconds: 42.0},
					},
				},
			}, nil
		},
	}
	handler := newTestVideoHandler(mockRepo)

	err := handler.SearchByFENHandler(c)

	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, rec.Code)

	var response []models.VideoSearchResult
	err = json.Unmarshal(rec.Body.Bytes(), &response)
	require.NoError(t, err)
	assert.Len(t, response, 1)
	assert.Equal(t, "Chess Lesson", response[0].VideoImport.Title)
	assert.Len(t, response[0].Positions, 1)
}

func TestVideoSaveHandler_InvalidID(t *testing.T) {
	e := echo.New()
	body := `{"name":"Test","color":"white","treeData":{}}`
	req := httptest.NewRequest(http.MethodPost, "/api/video-imports/not-a-uuid/save", strings.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.SetParamNames("id")
	c.SetParamValues("not-a-uuid")
	setTestUserID(c)

	handler := newTestVideoHandler(&mocks.MockVideoRepo{})

	err := handler.SaveHandler(c)

	require.NoError(t, err)
	assert.Equal(t, http.StatusBadRequest, rec.Code)
}

func TestVideoSaveHandler_NotCompleted(t *testing.T) {
	e := echo.New()
	validUUID := "123e4567-e89b-12d3-a456-426614174000"
	body := `{"name":"Test","color":"white","treeData":{}}`
	req := httptest.NewRequest(http.MethodPost, "/api/video-imports/"+validUUID+"/save", strings.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.SetParamNames("id")
	c.SetParamValues(validUUID)
	setTestUserID(c)

	mockRepo := &mocks.MockVideoRepo{
		BelongsToUserFunc: func(id string, userID string) (bool, error) {
			return true, nil
		},
		GetImportByIDFunc: func(id string) (*models.VideoImport, error) {
			return &models.VideoImport{
				ID:     id,
				Status: models.VideoStatusRecognizing,
			}, nil
		},
	}
	handler := newTestVideoHandler(mockRepo)

	err := handler.SaveHandler(c)

	require.NoError(t, err)
	assert.Equal(t, http.StatusBadRequest, rec.Code)

	var response map[string]string
	err = json.Unmarshal(rec.Body.Bytes(), &response)
	require.NoError(t, err)
	assert.Contains(t, response["error"], "not yet completed")
}

func TestVideoSaveHandler_MissingName(t *testing.T) {
	e := echo.New()
	validUUID := "123e4567-e89b-12d3-a456-426614174000"
	body := `{"color":"white","treeData":{}}`
	req := httptest.NewRequest(http.MethodPost, "/api/video-imports/"+validUUID+"/save", strings.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.SetParamNames("id")
	c.SetParamValues(validUUID)
	setTestUserID(c)

	mockRepo := &mocks.MockVideoRepo{
		BelongsToUserFunc: func(id string, userID string) (bool, error) {
			return true, nil
		},
		GetImportByIDFunc: func(id string) (*models.VideoImport, error) {
			return &models.VideoImport{
				ID:     id,
				Status: models.VideoStatusCompleted,
			}, nil
		},
	}
	handler := newTestVideoHandler(mockRepo)

	err := handler.SaveHandler(c)

	require.NoError(t, err)
	assert.Equal(t, http.StatusBadRequest, rec.Code)
}

func TestVideoSaveHandler_InvalidColor(t *testing.T) {
	e := echo.New()
	validUUID := "123e4567-e89b-12d3-a456-426614174000"
	body := `{"name":"Test","color":"invalid","treeData":{}}`
	req := httptest.NewRequest(http.MethodPost, "/api/video-imports/"+validUUID+"/save", strings.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.SetParamNames("id")
	c.SetParamValues(validUUID)
	setTestUserID(c)

	mockRepo := &mocks.MockVideoRepo{
		BelongsToUserFunc: func(id string, userID string) (bool, error) {
			return true, nil
		},
		GetImportByIDFunc: func(id string) (*models.VideoImport, error) {
			return &models.VideoImport{
				ID:     id,
				Status: models.VideoStatusCompleted,
			}, nil
		},
	}
	handler := newTestVideoHandler(mockRepo)

	err := handler.SaveHandler(c)

	require.NoError(t, err)
	assert.Equal(t, http.StatusBadRequest, rec.Code)

	var response map[string]string
	err = json.Unmarshal(rec.Body.Bytes(), &response)
	require.NoError(t, err)
	assert.Contains(t, response["error"], "color must be")
}
