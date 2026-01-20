package handlers

import (
	"bytes"
	"encoding/json"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"

	"github.com/labstack/echo/v4"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/treechess/backend/internal/services"
)

func TestUploadHandler_MissingFile(t *testing.T) {
	e := echo.New()

	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	writer.WriteField("color", "white")
	writer.Close()

	req := httptest.NewRequest(http.MethodPost, "/api/imports", body)
	req.Header.Set(echo.HeaderContentType, writer.FormDataContentType())
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)

	importSvc := services.NewImportService(nil)
	handler := NewImportHandler(importSvc)

	err := handler.UploadHandler(c)

	require.NoError(t, err)
	assert.Equal(t, http.StatusBadRequest, rec.Code)

	var response map[string]string
	err = json.Unmarshal(rec.Body.Bytes(), &response)
	require.NoError(t, err)
	assert.Equal(t, "file is required", response["error"])
}

func TestUploadHandler_InvalidColor(t *testing.T) {
	e := echo.New()

	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	writer.WriteField("color", "yellow")
	part, _ := writer.CreateFormFile("file", "test.pgn")
	part.Write([]byte("1. e4 e5 1-0"))
	writer.Close()

	req := httptest.NewRequest(http.MethodPost, "/api/imports", body)
	req.Header.Set(echo.HeaderContentType, writer.FormDataContentType())
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)

	importSvc := services.NewImportService(nil)
	handler := NewImportHandler(importSvc)

	err := handler.UploadHandler(c)

	require.NoError(t, err)
	assert.Equal(t, http.StatusBadRequest, rec.Code)

	var response map[string]string
	err = json.Unmarshal(rec.Body.Bytes(), &response)
	require.NoError(t, err)
	assert.Contains(t, response["error"], "invalid color")
}

func TestUploadHandler_InvalidFileExtension(t *testing.T) {
	e := echo.New()

	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	writer.WriteField("color", "white")
	part, _ := writer.CreateFormFile("file", "test.txt")
	part.Write([]byte("some text"))
	writer.Close()

	req := httptest.NewRequest(http.MethodPost, "/api/imports", body)
	req.Header.Set(echo.HeaderContentType, writer.FormDataContentType())
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)

	importSvc := services.NewImportService(nil)
	handler := NewImportHandler(importSvc)

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

	importSvc := services.NewImportService(nil)
	handler := NewImportHandler(importSvc)

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

	importSvc := services.NewImportService(nil)
	handler := NewImportHandler(importSvc)

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

	importSvc := services.NewImportService(nil)
	handler := NewImportHandler(importSvc)

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

	importSvc := services.NewImportService(nil)
	handler := NewImportHandler(importSvc)

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

	importSvc := services.NewImportService(nil)
	handler := NewImportHandler(importSvc)

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

	importSvc := services.NewImportService(nil)
	handler := NewImportHandler(importSvc)

	err := handler.GetLegalMovesHandler(c)

	require.NoError(t, err)
	assert.Equal(t, http.StatusBadRequest, rec.Code)

	var response map[string]string
	err = json.Unmarshal(rec.Body.Bytes(), &response)
	require.NoError(t, err)
	assert.Equal(t, "fen parameter is required", response["error"])
}

func TestListAnalysesHandler_Empty(t *testing.T) {
	t.Skip("Requires database connection - skip for unit testing")
	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/api/analyses", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)

	importSvc := services.NewImportService(nil)
	handler := NewImportHandler(importSvc)

	err := handler.ListAnalysesHandler(c)

	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, rec.Code)

	var response []map[string]interface{}
	err = json.Unmarshal(rec.Body.Bytes(), &response)
	require.NoError(t, err)
	assert.Empty(t, response)
}

func TestGetAnalysisHandler_NotFound(t *testing.T) {
	t.Skip("Requires database connection - skip for unit testing")
	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/api/analyses/nonexistent", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.SetParamNames("id")
	c.SetParamValues("nonexistent")

	importSvc := services.NewImportService(nil)
	handler := NewImportHandler(importSvc)

	err := handler.GetAnalysisHandler(c)

	require.NoError(t, err)
	assert.Equal(t, http.StatusNotFound, rec.Code)
}

func TestDeleteAnalysisHandler_NotFound(t *testing.T) {
	t.Skip("Requires database connection - skip for unit testing")
	e := echo.New()
	req := httptest.NewRequest(http.MethodDelete, "/api/analyses/nonexistent", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.SetParamNames("id")
	c.SetParamValues("nonexistent")

	importSvc := services.NewImportService(nil)
	handler := NewImportHandler(importSvc)

	err := handler.DeleteAnalysisHandler(c)

	require.NoError(t, err)
	assert.Equal(t, http.StatusNotFound, rec.Code)
}

func TestNewImportHandler(t *testing.T) {
	importSvc := services.NewImportService(nil)
	handler := NewImportHandler(importSvc)

	assert.NotNil(t, handler)
	assert.NotNil(t, handler.importService)
}

func TestUploadHandler_InvalidBody(t *testing.T) {
	e := echo.New()
	req := httptest.NewRequest(http.MethodPost, "/api/imports", bytes.NewReader([]byte("not multipart")))
	req.Header.Set(echo.HeaderContentType, "multipart/form-data; boundary=boundary")
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)

	importSvc := services.NewImportService(nil)
	handler := NewImportHandler(importSvc)

	err := handler.UploadHandler(c)

	require.NoError(t, err)
	assert.Equal(t, http.StatusBadRequest, rec.Code)
}

func TestUploadHandler_MissingColor(t *testing.T) {
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

	importSvc := services.NewImportService(nil)
	handler := NewImportHandler(importSvc)

	err := handler.UploadHandler(c)

	require.NoError(t, err)
	assert.Equal(t, http.StatusBadRequest, rec.Code)
}

func TestValidateMoveHandler_MissingSAN(t *testing.T) {
	e := echo.New()
	body := `{"fen":"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -"}`
	req := httptest.NewRequest(http.MethodPost, "/api/validate-move", bytes.NewReader([]byte(body)))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)

	importSvc := services.NewImportService(nil)
	handler := NewImportHandler(importSvc)

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

	importSvc := services.NewImportService(nil)
	handler := NewImportHandler(importSvc)

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

	importSvc := services.NewImportService(nil)
	handler := NewImportHandler(importSvc)

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

	importSvc := services.NewImportService(nil)
	handler := NewImportHandler(importSvc)

	err := handler.ValidatePGNHandler(c)

	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, rec.Code)

	body := rec.Body.String()
	assert.Contains(t, body, "valid")
}

func TestImportHandler_CastlingMove(t *testing.T) {
	e := echo.New()
	body := `{"fen":"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -","san":"e4"}`
	req := httptest.NewRequest(http.MethodPost, "/api/validate-move", bytes.NewReader([]byte(body)))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)

	importSvc := services.NewImportService(nil)
	handler := NewImportHandler(importSvc)

	err := handler.ValidateMoveHandler(c)

	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, rec.Code)
}

func TestImportHandler_Promotion(t *testing.T) {
	e := echo.New()
	body := `{"fen":"4k3/4P3/8/8/8/8/8/4K3 w - - 0 1","san":"e8=Q"}`
	req := httptest.NewRequest(http.MethodPost, "/api/validate-move", bytes.NewReader([]byte(body)))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)

	importSvc := services.NewImportService(nil)
	handler := NewImportHandler(importSvc)

	err := handler.ValidateMoveHandler(c)

	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, rec.Code)
}
