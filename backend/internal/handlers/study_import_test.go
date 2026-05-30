package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/labstack/echo/v5"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/kumquat/backend/internal/models"
	"github.com/kumquat/backend/internal/repository/mocks"
	"github.com/kumquat/backend/internal/services"
	smocks "github.com/kumquat/backend/internal/services/mocks"
)

func newTestStudyImportHandler(lichess *smocks.MockLichessService, repSvc *smocks.MockRepertoireService, userRepo *mocks.MockUserRepo) *StudyImportHandler {
	svc := services.NewStudyImportService(lichess, repSvc, nil, userRepo)
	return NewStudyImportHandler(svc)
}

func TestPreviewStudyHandler_Success(t *testing.T) {
	pgnData := `[Event "Study: Chapter 1"]
[Orientation "White"]

1. e4 e5 *
`
	mockLichess := &smocks.MockLichessService{
		FetchStudyPGNFunc: func(studyID, authToken string) (string, error) {
			return pgnData, nil
		},
	}
	handler := newTestStudyImportHandler(mockLichess, &smocks.MockRepertoireService{}, &mocks.MockUserRepo{})

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
	handler := newTestStudyImportHandler(&smocks.MockLichessService{}, &smocks.MockRepertoireService{}, &mocks.MockUserRepo{})

	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/api/studies/preview", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.Set("userID", testUserID)

	_ = handler.PreviewStudyHandler(c)

	assert.Equal(t, http.StatusBadRequest, rec.Code)
}

func TestPreviewStudyHandler_InvalidURL(t *testing.T) {
	handler := newTestStudyImportHandler(&smocks.MockLichessService{}, &smocks.MockRepertoireService{}, &mocks.MockUserRepo{})

	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/api/studies/preview?url=not-a-valid-url", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.Set("userID", testUserID)

	_ = handler.PreviewStudyHandler(c)

	assert.Equal(t, http.StatusBadRequest, rec.Code)
}

func TestPreviewStudyHandler_NotFound(t *testing.T) {
	mockLichess := &smocks.MockLichessService{
		FetchStudyPGNFunc: func(studyID, authToken string) (string, error) {
			return "", services.ErrLichessStudyNotFound
		},
	}
	handler := newTestStudyImportHandler(mockLichess, &smocks.MockRepertoireService{}, &mocks.MockUserRepo{})

	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/api/studies/preview?url=https://lichess.org/study/abcdefgh", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.Set("userID", testUserID)

	_ = handler.PreviewStudyHandler(c)

	assert.Equal(t, http.StatusNotFound, rec.Code)
}

func TestPreviewStudyHandler_Forbidden(t *testing.T) {
	mockLichess := &smocks.MockLichessService{
		FetchStudyPGNFunc: func(studyID, authToken string) (string, error) {
			return "", services.ErrLichessStudyForbidden
		},
	}
	handler := newTestStudyImportHandler(mockLichess, &smocks.MockRepertoireService{}, &mocks.MockUserRepo{})

	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/api/studies/preview?url=https://lichess.org/study/abcdefgh", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.Set("userID", testUserID)

	_ = handler.PreviewStudyHandler(c)

	assert.Equal(t, http.StatusForbidden, rec.Code)
}

func TestPreviewStudyHandler_RateLimited(t *testing.T) {
	mockLichess := &smocks.MockLichessService{
		FetchStudyPGNFunc: func(studyID, authToken string) (string, error) {
			return "", services.ErrLichessRateLimited
		},
	}
	handler := newTestStudyImportHandler(mockLichess, &smocks.MockRepertoireService{}, &mocks.MockUserRepo{})

	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/api/studies/preview?url=https://lichess.org/study/abcdefgh", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.Set("userID", testUserID)

	_ = handler.PreviewStudyHandler(c)

	assert.Equal(t, http.StatusTooManyRequests, rec.Code)
}

func TestImportStudyHandler_Success(t *testing.T) {
	pgnData := `[Event "Study: Chapter 1"]
[Orientation "White"]

1. e4 e5 *
`
	mockLichess := &smocks.MockLichessService{
		FetchStudyPGNFunc: func(studyID, authToken string) (string, error) {
			return pgnData, nil
		},
	}
	mockRepSvc := &smocks.MockRepertoireService{
		CreateRepertoireFunc: func(userID, name string, color models.Color) (*models.Repertoire, error) {
			return &models.Repertoire{ID: "rep-1", Name: name, Color: color}, nil
		},
		SaveTreeFunc: func(userID, repertoireID string, treeData models.RepertoireNode) (*models.Repertoire, error) {
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
	handler := newTestStudyImportHandler(&smocks.MockLichessService{}, &smocks.MockRepertoireService{}, &mocks.MockUserRepo{})

	e := echo.New()
	body := `{"chapters":[0]}`
	req := httptest.NewRequest(http.MethodPost, "/api/studies/import", strings.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.Set("userID", testUserID)

	_ = handler.ImportStudyHandler(c)

	assert.Equal(t, http.StatusBadRequest, rec.Code)
}

func TestImportStudyHandler_NoChapters(t *testing.T) {
	handler := newTestStudyImportHandler(&smocks.MockLichessService{}, &smocks.MockRepertoireService{}, &mocks.MockUserRepo{})

	e := echo.New()
	body := `{"studyUrl":"https://lichess.org/study/abcdefgh","chapters":[]}`
	req := httptest.NewRequest(http.MethodPost, "/api/studies/import", strings.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.Set("userID", testUserID)

	_ = handler.ImportStudyHandler(c)

	assert.Equal(t, http.StatusBadRequest, rec.Code)
}

func TestImportStudyHandler_NameConflict_Returns409(t *testing.T) {
	pgnData := `[Event "Sicilian Study: Najdorf"]
[Orientation "White"]

1. e4 c5 *
`
	mockLichess := &smocks.MockLichessService{
		FetchStudyPGNFunc: func(studyID, authToken string) (string, error) { return pgnData, nil },
	}
	mockRepSvc := &smocks.MockRepertoireService{
		ListRepertoiresFunc: func(userID string, color *models.Color) ([]models.Repertoire, error) {
			return []models.Repertoire{{ID: "existing-1", Name: "Najdorf", Color: models.ColorWhite}}, nil
		},
		CreateRepertoireFunc: func(userID, name string, color models.Color) (*models.Repertoire, error) {
			t.Fatalf("create should not be called when conflict aborts the import")
			return nil, nil
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
	require.Equal(t, http.StatusConflict, rec.Code)

	var resp struct {
		Error     string                          `json:"error"`
		Type      string                          `json:"type"`
		Conflicts []models.RepertoireNameConflict `json:"conflicts"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &resp))
	assert.Equal(t, "name-conflict", resp.Type)
	assert.Contains(t, resp.Error, "Najdorf")
	require.Len(t, resp.Conflicts, 1)
	assert.Equal(t, "Najdorf", resp.Conflicts[0].TargetName)
	assert.Equal(t, "existing-1", resp.Conflicts[0].ExistingID)
	assert.Equal(t, "white", resp.Conflicts[0].ExistingColor)
}

func TestImportStudyHandler_AutoSuffixSucceeds(t *testing.T) {
	pgnData := `[Event "Sicilian Study: Najdorf"]
[Orientation "White"]

1. e4 c5 *
`
	mockLichess := &smocks.MockLichessService{
		FetchStudyPGNFunc: func(studyID, authToken string) (string, error) { return pgnData, nil },
	}
	var createdName string
	mockRepSvc := &smocks.MockRepertoireService{
		ListRepertoiresFunc: func(userID string, color *models.Color) ([]models.Repertoire, error) {
			return []models.Repertoire{{ID: "existing-1", Name: "Najdorf", Color: models.ColorWhite}}, nil
		},
		CreateRepertoireFunc: func(userID, name string, color models.Color) (*models.Repertoire, error) {
			createdName = name
			return &models.Repertoire{ID: "rep-1", Name: name, Color: color}, nil
		},
		SaveTreeFunc: func(userID, repertoireID string, treeData models.RepertoireNode) (*models.Repertoire, error) {
			return &models.Repertoire{ID: repertoireID, TreeData: treeData}, nil
		},
	}
	handler := newTestStudyImportHandler(mockLichess, mockRepSvc, &mocks.MockUserRepo{})

	e := echo.New()
	body := `{"studyUrl":"https://lichess.org/study/abcdefgh","chapters":[0],"renameStrategy":"auto-suffix"}`
	req := httptest.NewRequest(http.MethodPost, "/api/studies/import", strings.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.Set("userID", testUserID)

	err := handler.ImportStudyHandler(c)
	require.NoError(t, err)
	assert.Equal(t, http.StatusCreated, rec.Code)
	assert.Equal(t, "Najdorf (2)", createdName)
}

func TestImportStudyHandler_LimitReached(t *testing.T) {
	pgnData := `[Event "Study: Chapter"]
[Orientation "White"]

1. e4 e5 *
`
	mockLichess := &smocks.MockLichessService{
		FetchStudyPGNFunc: func(studyID, authToken string) (string, error) {
			return pgnData, nil
		},
	}
	mockRepSvc := &smocks.MockRepertoireService{
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

	_ = handler.ImportStudyHandler(c)

	assert.Equal(t, http.StatusBadRequest, rec.Code)
}

func doBrowseStudies(t *testing.T, capturedPage *int, pageQuery string) *httptest.ResponseRecorder {
	t.Helper()
	mockLichess := &smocks.MockLichessService{
		BrowseAllStudiesFunc: func(sort string, page int, authToken string) (*models.LichessStudySearchResponse, error) {
			*capturedPage = page
			return &models.LichessStudySearchResponse{}, nil
		},
	}
	handler := newTestStudyImportHandler(mockLichess, &smocks.MockRepertoireService{}, &mocks.MockUserRepo{})

	e := echo.New()
	target := "/api/studies/browse"
	if pageQuery != "" {
		target += "?page=" + pageQuery
	}
	req := httptest.NewRequest(http.MethodGet, target, nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.Set("userID", testUserID)
	require.NoError(t, handler.BrowseStudiesHandler(c))
	return rec
}

func TestBrowseStudiesHandler_CapsLargePage(t *testing.T) {
	var page int
	rec := doBrowseStudies(t, &page, "100000")
	assert.Equal(t, http.StatusOK, rec.Code)
	assert.Equal(t, 100, page, "page must be capped at 100")
}

func TestBrowseStudiesHandler_DefaultsToOne(t *testing.T) {
	var page int
	rec := doBrowseStudies(t, &page, "")
	assert.Equal(t, http.StatusOK, rec.Code)
	assert.Equal(t, 1, page, "missing page must default to 1")
}

func TestBrowseStudiesHandler_RejectsNonPositivePageToDefault(t *testing.T) {
	var page int
	rec := doBrowseStudies(t, &page, "0")
	assert.Equal(t, http.StatusOK, rec.Code)
	assert.Equal(t, 1, page, "page below the minimum must fall back to the default")
}
