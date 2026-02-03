package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/labstack/echo/v4"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/treechess/backend/internal/models"
	"github.com/treechess/backend/internal/repository/mocks"
	"github.com/treechess/backend/internal/services"
)

func newTestStudyImportHandler(lichess *mocks.MockLichessService, repSvc *mocks.MockRepertoireService, userRepo *mocks.MockUserRepo) *StudyImportHandler {
	svc := services.NewStudyImportService(lichess, repSvc, nil, userRepo)
	return NewStudyImportHandler(svc)
}

func TestPreviewStudyHandler_Success(t *testing.T) {
	pgnData := `[Event "Study: Chapter 1"]
[Orientation "White"]

1. e4 e5 *
`
	mockLichess := &mocks.MockLichessService{
		FetchStudyPGNFunc: func(studyID, authToken string) (string, error) {
			return pgnData, nil
		},
	}
	handler := newTestStudyImportHandler(mockLichess, &mocks.MockRepertoireService{}, &mocks.MockUserRepo{})

	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/api/studies/preview?url=https://lichess.org/study/abcdefgh", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.Set("userID", testUserID)

	err := handler.PreviewStudyHandler(c)

	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, rec.Code)

	var info models.StudyInfo
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &info))
	assert.Equal(t, "abcdefgh", info.StudyID)
	assert.Len(t, info.Chapters, 1)
}

func TestPreviewStudyHandler_MissingURL(t *testing.T) {
	handler := newTestStudyImportHandler(&mocks.MockLichessService{}, &mocks.MockRepertoireService{}, &mocks.MockUserRepo{})

	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/api/studies/preview", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.Set("userID", testUserID)

	handler.PreviewStudyHandler(c)

	assert.Equal(t, http.StatusBadRequest, rec.Code)
}

func TestPreviewStudyHandler_InvalidURL(t *testing.T) {
	handler := newTestStudyImportHandler(&mocks.MockLichessService{}, &mocks.MockRepertoireService{}, &mocks.MockUserRepo{})

	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/api/studies/preview?url=not-a-valid-url", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.Set("userID", testUserID)

	handler.PreviewStudyHandler(c)

	assert.Equal(t, http.StatusBadRequest, rec.Code)
}

func TestPreviewStudyHandler_NotFound(t *testing.T) {
	mockLichess := &mocks.MockLichessService{
		FetchStudyPGNFunc: func(studyID, authToken string) (string, error) {
			return "", services.ErrLichessStudyNotFound
		},
	}
	handler := newTestStudyImportHandler(mockLichess, &mocks.MockRepertoireService{}, &mocks.MockUserRepo{})

	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/api/studies/preview?url=https://lichess.org/study/abcdefgh", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.Set("userID", testUserID)

	handler.PreviewStudyHandler(c)

	assert.Equal(t, http.StatusNotFound, rec.Code)
}

func TestPreviewStudyHandler_Forbidden(t *testing.T) {
	mockLichess := &mocks.MockLichessService{
		FetchStudyPGNFunc: func(studyID, authToken string) (string, error) {
			return "", services.ErrLichessStudyForbidden
		},
	}
	handler := newTestStudyImportHandler(mockLichess, &mocks.MockRepertoireService{}, &mocks.MockUserRepo{})

	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/api/studies/preview?url=https://lichess.org/study/abcdefgh", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.Set("userID", testUserID)

	handler.PreviewStudyHandler(c)

	assert.Equal(t, http.StatusForbidden, rec.Code)
}

func TestPreviewStudyHandler_RateLimited(t *testing.T) {
	mockLichess := &mocks.MockLichessService{
		FetchStudyPGNFunc: func(studyID, authToken string) (string, error) {
			return "", services.ErrLichessRateLimited
		},
	}
	handler := newTestStudyImportHandler(mockLichess, &mocks.MockRepertoireService{}, &mocks.MockUserRepo{})

	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/api/studies/preview?url=https://lichess.org/study/abcdefgh", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.Set("userID", testUserID)

	handler.PreviewStudyHandler(c)

	assert.Equal(t, http.StatusTooManyRequests, rec.Code)
}

func TestImportStudyHandler_Success(t *testing.T) {
	pgnData := `[Event "Study: Chapter 1"]
[Orientation "White"]

1. e4 e5 *
`
	mockLichess := &mocks.MockLichessService{
		FetchStudyPGNFunc: func(studyID, authToken string) (string, error) {
			return pgnData, nil
		},
	}
	mockRepSvc := &mocks.MockRepertoireService{
		CreateRepertoireFunc: func(userID, name string, color models.Color) (*models.Repertoire, error) {
			return &models.Repertoire{ID: "rep-1", Name: name, Color: color}, nil
		},
		SaveTreeFunc: func(repertoireID string, treeData models.RepertoireNode) (*models.Repertoire, error) {
			return &models.Repertoire{ID: repertoireID, TreeData: treeData}, nil
		},
	}
	handler := newTestStudyImportHandler(mockLichess, mockRepSvc, &mocks.MockUserRepo{})

	e := echo.New()
	body := `{"studyUrl":"https://lichess.org/study/abcdefgh","chapters":[0]}`
	req := httptest.NewRequest(http.MethodPost, "/api/studies/import", strings.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.Set("userID", testUserID)

	err := handler.ImportStudyHandler(c)

	require.NoError(t, err)
	assert.Equal(t, http.StatusCreated, rec.Code)
}

func TestImportStudyHandler_MissingURL(t *testing.T) {
	handler := newTestStudyImportHandler(&mocks.MockLichessService{}, &mocks.MockRepertoireService{}, &mocks.MockUserRepo{})

	e := echo.New()
	body := `{"chapters":[0]}`
	req := httptest.NewRequest(http.MethodPost, "/api/studies/import", strings.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.Set("userID", testUserID)

	handler.ImportStudyHandler(c)

	assert.Equal(t, http.StatusBadRequest, rec.Code)
}

func TestImportStudyHandler_NoChapters(t *testing.T) {
	handler := newTestStudyImportHandler(&mocks.MockLichessService{}, &mocks.MockRepertoireService{}, &mocks.MockUserRepo{})

	e := echo.New()
	body := `{"studyUrl":"https://lichess.org/study/abcdefgh","chapters":[]}`
	req := httptest.NewRequest(http.MethodPost, "/api/studies/import", strings.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.Set("userID", testUserID)

	handler.ImportStudyHandler(c)

	assert.Equal(t, http.StatusBadRequest, rec.Code)
}

func TestImportStudyHandler_LimitReached(t *testing.T) {
	pgnData := `[Event "Study: Chapter"]
[Orientation "White"]

1. e4 e5 *
`
	mockLichess := &mocks.MockLichessService{
		FetchStudyPGNFunc: func(studyID, authToken string) (string, error) {
			return pgnData, nil
		},
	}
	mockRepSvc := &mocks.MockRepertoireService{
		CreateRepertoireFunc: func(userID, name string, color models.Color) (*models.Repertoire, error) {
			return nil, fmt.Errorf("failed to create repertoire for chapter 0: %w", services.ErrLimitReached)
		},
	}
	handler := newTestStudyImportHandler(mockLichess, mockRepSvc, &mocks.MockUserRepo{})

	e := echo.New()
	body := `{"studyUrl":"https://lichess.org/study/abcdefgh","chapters":[0]}`
	req := httptest.NewRequest(http.MethodPost, "/api/studies/import", strings.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.Set("userID", testUserID)

	handler.ImportStudyHandler(c)

	assert.Equal(t, http.StatusBadRequest, rec.Code)
}
