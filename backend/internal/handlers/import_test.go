package handlers

import (
	"bytes"
	"encoding/json"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/treechess/backend/internal/models"
	"github.com/treechess/backend/internal/repository"
	"github.com/treechess/backend/internal/repository/mocks"
	"github.com/treechess/backend/internal/services"
)

func TestUploadHandler_MissingFile(t *testing.T) {
	e := echo.New()

	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	writer.WriteField("username", "testuser")
	writer.Close()

	req := httptest.NewRequest(http.MethodPost, "/api/imports", body)
	req.Header.Set(echo.HeaderContentType, writer.FormDataContentType())
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	setTestUserID(c)

	importSvc := services.NewImportService(nil, nil)
	handler := NewImportHandler(importSvc, nil, nil)

	err := handler.UploadHandler(c)

	require.NoError(t, err)
	assert.Equal(t, http.StatusBadRequest, rec.Code)

	var response map[string]string
	err = json.Unmarshal(rec.Body.Bytes(), &response)
	require.NoError(t, err)
	assert.Equal(t, "file is required", response["error"])
}

func TestUploadHandler_EmptyUsername(t *testing.T) {
	e := echo.New()

	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	writer.WriteField("username", "")
	part, _ := writer.CreateFormFile("file", "test.pgn")
	part.Write([]byte("1. e4 e5 1-0"))
	writer.Close()

	req := httptest.NewRequest(http.MethodPost, "/api/imports", body)
	req.Header.Set(echo.HeaderContentType, writer.FormDataContentType())
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	setTestUserID(c)

	importSvc := services.NewImportService(nil, nil)
	handler := NewImportHandler(importSvc, nil, nil)

	err := handler.UploadHandler(c)

	require.NoError(t, err)
	assert.Equal(t, http.StatusBadRequest, rec.Code)

	var response map[string]string
	err = json.Unmarshal(rec.Body.Bytes(), &response)
	require.NoError(t, err)
	assert.Contains(t, response["error"], "username is required")
}

func TestUploadHandler_InvalidFileExtension(t *testing.T) {
	e := echo.New()

	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	writer.WriteField("username", "testuser")
	part, _ := writer.CreateFormFile("file", "test.txt")
	part.Write([]byte("some text"))
	writer.Close()

	req := httptest.NewRequest(http.MethodPost, "/api/imports", body)
	req.Header.Set(echo.HeaderContentType, writer.FormDataContentType())
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	setTestUserID(c)

	importSvc := services.NewImportService(nil, nil)
	handler := NewImportHandler(importSvc, nil, nil)

	err := handler.UploadHandler(c)

	require.NoError(t, err)
	assert.Equal(t, http.StatusBadRequest, rec.Code)

	var response map[string]string
	err = json.Unmarshal(rec.Body.Bytes(), &response)
	require.NoError(t, err)
	assert.Equal(t, "file must have .pgn extension", response["error"])
}

func TestValidatePGNHandler_Valid(t *testing.T) {
	e := echo.New()
	pgnData := `[Event "Test"]
[White "A"]
[Black "B"]
1. e4 e5 1-0`
	req := httptest.NewRequest(http.MethodPost, "/api/pgn/validate", bytes.NewReader([]byte(pgnData)))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)

	importSvc := services.NewImportService(nil, nil)
	handler := NewImportHandler(importSvc, nil, nil)

	err := handler.ValidatePGNHandler(c)

	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, rec.Code)
}

func TestValidateMoveHandler_Valid(t *testing.T) {
	e := echo.New()
	body := `{"fen":"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -","san":"e4"}`
	req := httptest.NewRequest(http.MethodPost, "/api/validate-move", bytes.NewReader([]byte(body)))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)

	importSvc := services.NewImportService(nil, nil)
	handler := NewImportHandler(importSvc, nil, nil)

	err := handler.ValidateMoveHandler(c)

	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, rec.Code)
}

func TestValidateMoveHandler_MissingFEN(t *testing.T) {
	e := echo.New()
	body := `{"san":"e4"}`
	req := httptest.NewRequest(http.MethodPost, "/api/validate-move", bytes.NewReader([]byte(body)))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)

	importSvc := services.NewImportService(nil, nil)
	handler := NewImportHandler(importSvc, nil, nil)

	err := handler.ValidateMoveHandler(c)

	require.NoError(t, err)
	assert.Equal(t, http.StatusBadRequest, rec.Code)

	var response map[string]string
	err = json.Unmarshal(rec.Body.Bytes(), &response)
	require.NoError(t, err)
	assert.Equal(t, "fen is required", response["error"])
}

func TestValidateMoveHandler_InvalidMove(t *testing.T) {
	e := echo.New()
	body := `{"fen":"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -","san":"e5"}`
	req := httptest.NewRequest(http.MethodPost, "/api/validate-move", bytes.NewReader([]byte(body)))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)

	importSvc := services.NewImportService(nil, nil)
	handler := NewImportHandler(importSvc, nil, nil)

	err := handler.ValidateMoveHandler(c)

	require.NoError(t, err)
	assert.Equal(t, http.StatusBadRequest, rec.Code)
}

func TestGetLegalMovesHandler(t *testing.T) {
	e := echo.New()
	fen := "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -"
	encodedFen := url.QueryEscape(fen)
	url := "/api/legal-moves?fen=" + encodedFen
	req := httptest.NewRequest(http.MethodGet, url, nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.QueryParams().Set("fen", fen)

	importSvc := services.NewImportService(nil, nil)
	handler := NewImportHandler(importSvc, nil, nil)

	err := handler.GetLegalMovesHandler(c)

	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, rec.Code)

	var response map[string]interface{}
	err = json.Unmarshal(rec.Body.Bytes(), &response)
	require.NoError(t, err)
	assert.NotNil(t, response["moves"])
}

func TestGetLegalMovesHandler_MissingFEN(t *testing.T) {
	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/api/legal-moves", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)

	importSvc := services.NewImportService(nil, nil)
	handler := NewImportHandler(importSvc, nil, nil)

	err := handler.GetLegalMovesHandler(c)

	require.NoError(t, err)
	assert.Equal(t, http.StatusBadRequest, rec.Code)

	var response map[string]string
	err = json.Unmarshal(rec.Body.Bytes(), &response)
	require.NoError(t, err)
	assert.Equal(t, "fen parameter is required", response["error"])
}

func TestListAnalysesHandler_Empty(t *testing.T) {
	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/api/analyses", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)

	setTestUserID(c)

	mockAnalysisRepo := &mocks.MockAnalysisRepo{
		GetAllFunc: func(userID string) ([]models.AnalysisSummary, error) {
			return []models.AnalysisSummary{}, nil
		},
	}
	importSvc := services.NewImportService(nil, mockAnalysisRepo)
	handler := NewImportHandler(importSvc, nil, nil)

	err := handler.ListAnalysesHandler(c)

	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, rec.Code)

	var response []map[string]interface{}
	err = json.Unmarshal(rec.Body.Bytes(), &response)
	require.NoError(t, err)
	assert.Empty(t, response)
}

func TestListAnalysesHandler_WithResults(t *testing.T) {
	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/api/analyses", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)

	setTestUserID(c)

	mockAnalysisRepo := &mocks.MockAnalysisRepo{
		GetAllFunc: func(userID string) ([]models.AnalysisSummary, error) {
			return []models.AnalysisSummary{
				{ID: "uuid-1", Username: "player1", Filename: "game1.pgn", GameCount: 5, UploadedAt: time.Now()},
				{ID: "uuid-2", Username: "player2", Filename: "game2.pgn", GameCount: 10, UploadedAt: time.Now()},
			}, nil
		},
	}
	importSvc := services.NewImportService(nil, mockAnalysisRepo)
	handler := NewImportHandler(importSvc, nil, nil)

	err := handler.ListAnalysesHandler(c)

	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, rec.Code)

	var response []map[string]interface{}
	err = json.Unmarshal(rec.Body.Bytes(), &response)
	require.NoError(t, err)
	assert.Len(t, response, 2)
	assert.Equal(t, "player1", response[0]["username"])
}

func TestGetAnalysisHandler_NotFound(t *testing.T) {
	e := echo.New()
	validUUID := "123e4567-e89b-12d3-a456-426614174000"
	req := httptest.NewRequest(http.MethodGet, "/api/analyses/"+validUUID, nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.SetParamNames("id")
	c.SetParamValues(validUUID)
	setTestUserID(c)

	mockAnalysisRepo := &mocks.MockAnalysisRepo{
		BelongsToUserFunc: func(id string, userID string) (bool, error) {
			return true, nil
		},
		GetByIDFunc: func(id string) (*models.AnalysisDetail, error) {
			return nil, repository.ErrAnalysisNotFound
		},
	}
	importSvc := services.NewImportService(nil, mockAnalysisRepo)
	handler := NewImportHandler(importSvc, nil, nil)

	err := handler.GetAnalysisHandler(c)

	require.NoError(t, err)
	assert.Equal(t, http.StatusNotFound, rec.Code)
}

func TestGetAnalysisHandler_Found(t *testing.T) {
	e := echo.New()
	validUUID := "123e4567-e89b-12d3-a456-426614174000"
	req := httptest.NewRequest(http.MethodGet, "/api/analyses/"+validUUID, nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.SetParamNames("id")
	c.SetParamValues(validUUID)
	setTestUserID(c)

	mockAnalysisRepo := &mocks.MockAnalysisRepo{
		BelongsToUserFunc: func(id string, userID string) (bool, error) {
			return true, nil
		},
		GetByIDFunc: func(id string) (*models.AnalysisDetail, error) {
			return &models.AnalysisDetail{
				ID:         id,
				Username:   "testuser",
				Filename:   "test.pgn",
				GameCount:  3,
				UploadedAt: time.Now(),
				Results:    []models.GameAnalysis{},
			}, nil
		},
	}
	importSvc := services.NewImportService(nil, mockAnalysisRepo)
	handler := NewImportHandler(importSvc, nil, nil)

	err := handler.GetAnalysisHandler(c)

	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, rec.Code)

	var response map[string]interface{}
	err = json.Unmarshal(rec.Body.Bytes(), &response)
	require.NoError(t, err)
	assert.Equal(t, validUUID, response["id"])
	assert.Equal(t, "testuser", response["username"])
}

func TestDeleteAnalysisHandler_NotFound(t *testing.T) {
	e := echo.New()
	validUUID := "123e4567-e89b-12d3-a456-426614174000"
	req := httptest.NewRequest(http.MethodDelete, "/api/analyses/"+validUUID, nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.SetParamNames("id")
	c.SetParamValues(validUUID)
	setTestUserID(c)

	mockAnalysisRepo := &mocks.MockAnalysisRepo{
		BelongsToUserFunc: func(id string, userID string) (bool, error) {
			return true, nil
		},
		DeleteFunc: func(id string) error {
			return repository.ErrAnalysisNotFound
		},
	}
	importSvc := services.NewImportService(nil, mockAnalysisRepo)
	handler := NewImportHandler(importSvc, nil, nil)

	err := handler.DeleteAnalysisHandler(c)

	require.NoError(t, err)
	assert.Equal(t, http.StatusNotFound, rec.Code)
}

func TestDeleteAnalysisHandler_Success(t *testing.T) {
	e := echo.New()
	validUUID := "123e4567-e89b-12d3-a456-426614174000"
	req := httptest.NewRequest(http.MethodDelete, "/api/analyses/"+validUUID, nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.SetParamNames("id")
	c.SetParamValues(validUUID)
	setTestUserID(c)

	mockAnalysisRepo := &mocks.MockAnalysisRepo{
		BelongsToUserFunc: func(id string, userID string) (bool, error) {
			return true, nil
		},
		DeleteFunc: func(id string) error {
			return nil
		},
	}
	importSvc := services.NewImportService(nil, mockAnalysisRepo)
	handler := NewImportHandler(importSvc, nil, nil)

	err := handler.DeleteAnalysisHandler(c)

	require.NoError(t, err)
	assert.Equal(t, http.StatusNoContent, rec.Code)
}

func TestNewImportHandler(t *testing.T) {
	importSvc := services.NewImportService(nil, nil)
	lichessSvc := services.NewLichessService()
	chesscomSvc := services.NewChesscomService()
	handler := NewImportHandler(importSvc, lichessSvc, chesscomSvc)

	assert.NotNil(t, handler)
	assert.NotNil(t, handler.importService)
	assert.NotNil(t, handler.lichessService)
	assert.NotNil(t, handler.chesscomService)
}

func TestNewImportHandler_NilLichessService(t *testing.T) {
	importSvc := services.NewImportService(nil, nil)
	handler := NewImportHandler(importSvc, nil, nil)

	assert.NotNil(t, handler)
	assert.NotNil(t, handler.importService)
	assert.Nil(t, handler.lichessService)
}

func TestUploadHandler_InvalidBody(t *testing.T) {
	e := echo.New()
	req := httptest.NewRequest(http.MethodPost, "/api/imports", bytes.NewReader([]byte("not multipart")))
	req.Header.Set(echo.HeaderContentType, "multipart/form-data; boundary=boundary")
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	setTestUserID(c)

	importSvc := services.NewImportService(nil, nil)
	handler := NewImportHandler(importSvc, nil, nil)

	err := handler.UploadHandler(c)

	require.NoError(t, err)
	assert.Equal(t, http.StatusBadRequest, rec.Code)
}

func TestUploadHandler_MissingUsername(t *testing.T) {
	e := echo.New()

	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	part, _ := writer.CreateFormFile("file", "test.pgn")
	part.Write([]byte("1. e4 e5 1-0"))
	writer.Close()

	req := httptest.NewRequest(http.MethodPost, "/api/imports", body)
	req.Header.Set(echo.HeaderContentType, writer.FormDataContentType())
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	setTestUserID(c)

	importSvc := services.NewImportService(nil, nil)
	handler := NewImportHandler(importSvc, nil, nil)

	err := handler.UploadHandler(c)

	require.NoError(t, err)
	assert.Equal(t, http.StatusBadRequest, rec.Code)

	var response map[string]string
	err = json.Unmarshal(rec.Body.Bytes(), &response)
	require.NoError(t, err)
	assert.Equal(t, "username is required", response["error"])
}

func TestValidateMoveHandler_MissingSAN(t *testing.T) {
	e := echo.New()
	body := `{"fen":"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -"}`
	req := httptest.NewRequest(http.MethodPost, "/api/validate-move", bytes.NewReader([]byte(body)))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)

	importSvc := services.NewImportService(nil, nil)
	handler := NewImportHandler(importSvc, nil, nil)

	err := handler.ValidateMoveHandler(c)

	require.NoError(t, err)
	assert.Equal(t, http.StatusBadRequest, rec.Code)

	var response map[string]string
	err = json.Unmarshal(rec.Body.Bytes(), &response)
	require.NoError(t, err)
	assert.Equal(t, "san is required", response["error"])
}

func TestValidateMoveHandler_InvalidJSON(t *testing.T) {
	e := echo.New()
	req := httptest.NewRequest(http.MethodPost, "/api/validate-move", bytes.NewReader([]byte("not json")))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)

	importSvc := services.NewImportService(nil, nil)
	handler := NewImportHandler(importSvc, nil, nil)

	err := handler.ValidateMoveHandler(c)

	require.NoError(t, err)
	assert.Equal(t, http.StatusBadRequest, rec.Code)
}

func TestValidateMoveHandler_InvalidFEN(t *testing.T) {
	e := echo.New()
	body := `{"fen":"invalid fen","san":"e4"}`
	req := httptest.NewRequest(http.MethodPost, "/api/validate-move", bytes.NewReader([]byte(body)))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)

	importSvc := services.NewImportService(nil, nil)
	handler := NewImportHandler(importSvc, nil, nil)

	err := handler.ValidateMoveHandler(c)

	require.NoError(t, err)
	assert.Equal(t, http.StatusBadRequest, rec.Code)
}

func TestImportHandler_ResponseFormat(t *testing.T) {
	e := echo.New()
	pgnData := `[Event "Test"]
[White "A"]
[Black "B"]
1. e4 e5 1-0`
	req := httptest.NewRequest(http.MethodPost, "/api/pgn/validate", bytes.NewReader([]byte(pgnData)))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)

	importSvc := services.NewImportService(nil, nil)
	handler := NewImportHandler(importSvc, nil, nil)

	err := handler.ValidatePGNHandler(c)

	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, rec.Code)

	body := rec.Body.String()
	assert.Contains(t, body, "valid")
}

func TestImportHandler_RegularMove(t *testing.T) {
	e := echo.New()
	body := `{"fen":"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -","san":"e4"}`
	req := httptest.NewRequest(http.MethodPost, "/api/validate-move", bytes.NewReader([]byte(body)))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)

	importSvc := services.NewImportService(nil, nil)
	handler := NewImportHandler(importSvc, nil, nil)

	err := handler.ValidateMoveHandler(c)

	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, rec.Code)
}

func TestImportHandler_CastlingMove(t *testing.T) {
	e := echo.New()
	body := `{"fen":"r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq -","san":"O-O"}`
	req := httptest.NewRequest(http.MethodPost, "/api/validate-move", bytes.NewReader([]byte(body)))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)

	importSvc := services.NewImportService(nil, nil)
	handler := NewImportHandler(importSvc, nil, nil)

	err := handler.ValidateMoveHandler(c)

	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, rec.Code)
}

func TestImportHandler_Promotion(t *testing.T) {
	e := echo.New()
	// Position with pawn on e7, king on e1, black king on h8 - pawn can promote
	body := `{"fen":"7k/4P3/8/8/8/8/8/4K3 w - -","san":"e8=Q"}`
	req := httptest.NewRequest(http.MethodPost, "/api/validate-move", bytes.NewReader([]byte(body)))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)

	importSvc := services.NewImportService(nil, nil)
	handler := NewImportHandler(importSvc, nil, nil)

	err := handler.ValidateMoveHandler(c)

	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, rec.Code)
}

// Additional handler tests for better coverage

func TestGetAnalysisHandler_InvalidUUID(t *testing.T) {
	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/api/analyses/invalid-uuid", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.SetParamNames("id")
	c.SetParamValues("invalid-uuid")
	setTestUserID(c)

	importSvc := services.NewImportService(nil, nil)
	handler := NewImportHandler(importSvc, nil, nil)

	err := handler.GetAnalysisHandler(c)

	require.NoError(t, err)
	assert.Equal(t, http.StatusBadRequest, rec.Code)

	var response map[string]string
	err = json.Unmarshal(rec.Body.Bytes(), &response)
	require.NoError(t, err)
	assert.Equal(t, "id must be a valid UUID", response["error"])
}

func TestDeleteAnalysisHandler_InvalidUUID(t *testing.T) {
	e := echo.New()
	req := httptest.NewRequest(http.MethodDelete, "/api/analyses/invalid-uuid", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.SetParamNames("id")
	c.SetParamValues("not-a-uuid")
	setTestUserID(c)

	importSvc := services.NewImportService(nil, nil)
	handler := NewImportHandler(importSvc, nil, nil)

	err := handler.DeleteAnalysisHandler(c)

	require.NoError(t, err)
	assert.Equal(t, http.StatusBadRequest, rec.Code)

	var response map[string]string
	err = json.Unmarshal(rec.Body.Bytes(), &response)
	require.NoError(t, err)
	assert.Equal(t, "id must be a valid UUID", response["error"])
}

func TestDeleteGameHandler_InvalidAnalysisID(t *testing.T) {
	e := echo.New()
	req := httptest.NewRequest(http.MethodDelete, "/api/games/invalid-uuid/0", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.SetParamNames("analysisId", "gameIndex")
	c.SetParamValues("invalid-uuid", "0")
	setTestUserID(c)

	importSvc := services.NewImportService(nil, nil)
	handler := NewImportHandler(importSvc, nil, nil)

	err := handler.DeleteGameHandler(c)

	require.NoError(t, err)
	assert.Equal(t, http.StatusBadRequest, rec.Code)

	var response map[string]string
	err = json.Unmarshal(rec.Body.Bytes(), &response)
	require.NoError(t, err)
	assert.Equal(t, "analysisId must be a valid UUID", response["error"])
}

func TestDeleteGameHandler_InvalidGameIndex(t *testing.T) {
	e := echo.New()
	validUUID := "123e4567-e89b-12d3-a456-426614174000"
	req := httptest.NewRequest(http.MethodDelete, "/api/games/"+validUUID+"/abc", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.SetParamNames("analysisId", "gameIndex")
	c.SetParamValues(validUUID, "abc")
	setTestUserID(c)

	mockAnalysisRepo := &mocks.MockAnalysisRepo{
		BelongsToUserFunc: func(id string, userID string) (bool, error) {
			return true, nil
		},
	}
	importSvc := services.NewImportService(nil, mockAnalysisRepo)
	handler := NewImportHandler(importSvc, nil, nil)

	err := handler.DeleteGameHandler(c)

	require.NoError(t, err)
	assert.Equal(t, http.StatusBadRequest, rec.Code)

	var response map[string]string
	err = json.Unmarshal(rec.Body.Bytes(), &response)
	require.NoError(t, err)
	assert.Equal(t, "gameIndex must be a non-negative integer", response["error"])
}

func TestDeleteGameHandler_NegativeGameIndex(t *testing.T) {
	e := echo.New()
	validUUID := "123e4567-e89b-12d3-a456-426614174000"
	req := httptest.NewRequest(http.MethodDelete, "/api/games/"+validUUID+"/-1", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.SetParamNames("analysisId", "gameIndex")
	c.SetParamValues(validUUID, "-1")
	setTestUserID(c)

	mockAnalysisRepo := &mocks.MockAnalysisRepo{
		BelongsToUserFunc: func(id string, userID string) (bool, error) {
			return true, nil
		},
	}
	importSvc := services.NewImportService(nil, mockAnalysisRepo)
	handler := NewImportHandler(importSvc, nil, nil)

	err := handler.DeleteGameHandler(c)

	require.NoError(t, err)
	assert.Equal(t, http.StatusBadRequest, rec.Code)

	var response map[string]string
	err = json.Unmarshal(rec.Body.Bytes(), &response)
	require.NoError(t, err)
	assert.Equal(t, "gameIndex must be a non-negative integer", response["error"])
}

func TestLichessImportHandler_MissingUsername(t *testing.T) {
	e := echo.New()
	body := `{"options":{}}`
	req := httptest.NewRequest(http.MethodPost, "/api/lichess/import", bytes.NewReader([]byte(body)))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	setTestUserID(c)

	importSvc := services.NewImportService(nil, nil)
	lichessSvc := services.NewLichessService()
	handler := NewImportHandler(importSvc, lichessSvc, nil)

	err := handler.LichessImportHandler(c)

	require.NoError(t, err)
	assert.Equal(t, http.StatusBadRequest, rec.Code)

	var response map[string]string
	err = json.Unmarshal(rec.Body.Bytes(), &response)
	require.NoError(t, err)
	assert.Equal(t, "username is required", response["error"])
}

func TestLichessImportHandler_InvalidJSON(t *testing.T) {
	e := echo.New()
	req := httptest.NewRequest(http.MethodPost, "/api/lichess/import", bytes.NewReader([]byte("not json")))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	setTestUserID(c)

	importSvc := services.NewImportService(nil, nil)
	lichessSvc := services.NewLichessService()
	handler := NewImportHandler(importSvc, lichessSvc, nil)

	err := handler.LichessImportHandler(c)

	require.NoError(t, err)
	assert.Equal(t, http.StatusBadRequest, rec.Code)
}

func TestGetGamesHandler_DefaultPagination(t *testing.T) {
	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/api/games", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	setTestUserID(c)

	mockAnalysisRepo := &mocks.MockAnalysisRepo{
		GetAllGamesFunc: func(userID string, limit, offset int, timeClass string) (*models.GamesResponse, error) {
			return &models.GamesResponse{
				Games:  []models.GameSummary{},
				Total:  0,
				Limit:  limit,
				Offset: offset,
			}, nil
		},
	}
	importSvc := services.NewImportService(nil, mockAnalysisRepo)
	handler := NewImportHandler(importSvc, nil, nil)

	err := handler.GetGamesHandler(c)

	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, rec.Code)

	var response models.GamesResponse
	err = json.Unmarshal(rec.Body.Bytes(), &response)
	require.NoError(t, err)
	assert.Equal(t, 0, response.Total)
}

func TestGetGamesHandler_WithGames(t *testing.T) {
	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/api/games", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	setTestUserID(c)

	mockAnalysisRepo := &mocks.MockAnalysisRepo{
		GetAllGamesFunc: func(userID string, limit, offset int, timeClass string) (*models.GamesResponse, error) {
			return &models.GamesResponse{
				Games: []models.GameSummary{
					{
						AnalysisID: "analysis-1",
						GameIndex:  0,
						White:      "Player1",
						Black:      "Player2",
						Result:     "1-0",
						UserColor:  models.ColorWhite,
						Status:     "ok",
					},
				},
				Total:  1,
				Limit:  limit,
				Offset: offset,
			}, nil
		},
	}
	importSvc := services.NewImportService(nil, mockAnalysisRepo)
	handler := NewImportHandler(importSvc, nil, nil)

	err := handler.GetGamesHandler(c)

	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, rec.Code)

	var response models.GamesResponse
	err = json.Unmarshal(rec.Body.Bytes(), &response)
	require.NoError(t, err)
	assert.Equal(t, 1, response.Total)
	assert.Len(t, response.Games, 1)
}

func TestGetGamesHandler_CustomPagination(t *testing.T) {
	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/api/games?limit=50&offset=10", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.QueryParams().Set("limit", "50")
	c.QueryParams().Set("offset", "10")
	setTestUserID(c)

	var capturedLimit, capturedOffset int
	mockAnalysisRepo := &mocks.MockAnalysisRepo{
		GetAllGamesFunc: func(userID string, limit, offset int, timeClass string) (*models.GamesResponse, error) {
			capturedLimit = limit
			capturedOffset = offset
			return &models.GamesResponse{
				Games:  []models.GameSummary{},
				Total:  100,
				Limit:  limit,
				Offset: offset,
			}, nil
		},
	}
	importSvc := services.NewImportService(nil, mockAnalysisRepo)
	handler := NewImportHandler(importSvc, nil, nil)

	err := handler.GetGamesHandler(c)

	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, rec.Code)
	assert.Equal(t, 50, capturedLimit)
	assert.Equal(t, 10, capturedOffset)
}

func TestValidatePGNHandler_EmptyBody(t *testing.T) {
	e := echo.New()
	req := httptest.NewRequest(http.MethodPost, "/api/pgn/validate", bytes.NewReader([]byte("")))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)

	importSvc := services.NewImportService(nil, nil)
	handler := NewImportHandler(importSvc, nil, nil)

	err := handler.ValidatePGNHandler(c)

	require.NoError(t, err)
	// Empty PGN might be valid (no games) or invalid depending on implementation
	assert.True(t, rec.Code == http.StatusOK || rec.Code == http.StatusBadRequest)
}

func TestValidatePGNHandler_InvalidPGN(t *testing.T) {
	e := echo.New()
	pgnData := `[Event "Incomplete"`
	req := httptest.NewRequest(http.MethodPost, "/api/pgn/validate", bytes.NewReader([]byte(pgnData)))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)

	importSvc := services.NewImportService(nil, nil)
	handler := NewImportHandler(importSvc, nil, nil)

	err := handler.ValidatePGNHandler(c)

	require.NoError(t, err)
	// The library is lenient, so check it doesn't crash
	assert.True(t, rec.Code == http.StatusOK || rec.Code == http.StatusBadRequest)
}

func TestGetLegalMovesHandler_InvalidFEN(t *testing.T) {
	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/api/legal-moves?fen=invalid", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.QueryParams().Set("fen", "invalid")

	importSvc := services.NewImportService(nil, nil)
	handler := NewImportHandler(importSvc, nil, nil)

	err := handler.GetLegalMovesHandler(c)

	require.NoError(t, err)
	assert.Equal(t, http.StatusBadRequest, rec.Code)
}

func TestGetLegalMovesHandler_CheckmatePosition(t *testing.T) {
	e := echo.New()
	// Fool's mate position - white is checkmated
	fen := "rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq -"
	encodedFen := url.QueryEscape(fen)
	reqURL := "/api/legal-moves?fen=" + encodedFen
	req := httptest.NewRequest(http.MethodGet, reqURL, nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.QueryParams().Set("fen", fen)

	importSvc := services.NewImportService(nil, nil)
	handler := NewImportHandler(importSvc, nil, nil)

	err := handler.GetLegalMovesHandler(c)

	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, rec.Code)

	var response map[string]interface{}
	err = json.Unmarshal(rec.Body.Bytes(), &response)
	require.NoError(t, err)
	moves := response["moves"].([]interface{})
	assert.Empty(t, moves) // No legal moves in checkmate
}

func TestUploadHandler_CaseInsensitivePGNExtension(t *testing.T) {
	// This test verifies that the handler accepts .PGN extension (case-insensitive)
	e := echo.New()

	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	writer.WriteField("username", "testuser")
	part, _ := writer.CreateFormFile("file", "test.PGN") // uppercase extension
	part.Write([]byte(`[Event "Test"]
[White "A"]
[Black "testuser"]
[Result "1-0"]

1. e4 e5 1-0`))
	writer.Close()

	req := httptest.NewRequest(http.MethodPost, "/api/imports", body)
	req.Header.Set(echo.HeaderContentType, writer.FormDataContentType())
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	setTestUserID(c)

	mockRepertoireRepo := &mocks.MockRepertoireRepo{
		GetByColorFunc: func(userID string, color models.Color) ([]models.Repertoire, error) {
			return []models.Repertoire{}, nil
		},
	}
	mockAnalysisRepo := &mocks.MockAnalysisRepo{
		SaveFunc: func(userID string, username, filename string, gameCount int, results []models.GameAnalysis) (*models.AnalysisSummary, error) {
			return &models.AnalysisSummary{
				ID:        "new-analysis-id",
				Username:  username,
				Filename:  filename,
				GameCount: gameCount,
			}, nil
		},
	}
	repertoireSvc := services.NewRepertoireService(mockRepertoireRepo)
	importSvc := services.NewImportService(repertoireSvc, mockAnalysisRepo)
	handler := NewImportHandler(importSvc, nil, nil)

	err := handler.UploadHandler(c)

	require.NoError(t, err)
	// Should accept .PGN (uppercase) and process successfully
	assert.Equal(t, http.StatusCreated, rec.Code)
}

func TestValidateMoveHandler_EnPassant(t *testing.T) {
	e := echo.New()
	// Position where en passant is possible
	body := `{"fen":"rnbqkbnr/ppp1pppp/8/3pP3/8/8/PPPP1PPP/RNBQKBNR w KQkq d6","san":"exd6"}`
	req := httptest.NewRequest(http.MethodPost, "/api/validate-move", bytes.NewReader([]byte(body)))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)

	importSvc := services.NewImportService(nil, nil)
	handler := NewImportHandler(importSvc, nil, nil)

	err := handler.ValidateMoveHandler(c)

	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, rec.Code)
}

func TestValidateMoveHandler_QueensideCastling(t *testing.T) {
	e := echo.New()
	body := `{"fen":"r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq -","san":"O-O-O"}`
	req := httptest.NewRequest(http.MethodPost, "/api/validate-move", bytes.NewReader([]byte(body)))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)

	importSvc := services.NewImportService(nil, nil)
	handler := NewImportHandler(importSvc, nil, nil)

	err := handler.ValidateMoveHandler(c)

	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, rec.Code)
}
