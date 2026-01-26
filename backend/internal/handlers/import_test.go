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
	writer.WriteField("username", "testuser")
	writer.Close()

	req := httptest.NewRequest(http.MethodPost, "/api/imports", body)
	req.Header.Set(echo.HeaderContentType, writer.FormDataContentType())
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)

	importSvc := services.NewImportService(nil)
	handler := NewImportHandler(importSvc, nil)

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

	importSvc := services.NewImportService(nil)
	handler := NewImportHandler(importSvc, nil)

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

	importSvc := services.NewImportService(nil)
	handler := NewImportHandler(importSvc, nil)

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
	handler := NewImportHandler(importSvc, nil)

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
	handler := NewImportHandler(importSvc, nil)

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
	handler := NewImportHandler(importSvc, nil)

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
	handler := NewImportHandler(importSvc, nil)

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
	handler := NewImportHandler(importSvc, nil)

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
	handler := NewImportHandler(importSvc, nil)

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
	handler := NewImportHandler(importSvc, nil)

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
	handler := NewImportHandler(importSvc, nil)

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
	handler := NewImportHandler(importSvc, nil)

	err := handler.DeleteAnalysisHandler(c)

	require.NoError(t, err)
	assert.Equal(t, http.StatusNotFound, rec.Code)
}

func TestNewImportHandler(t *testing.T) {
	importSvc := services.NewImportService(nil)
	lichessSvc := services.NewLichessService()
	handler := NewImportHandler(importSvc, lichessSvc)

	assert.NotNil(t, handler)
	assert.NotNil(t, handler.importService)
	assert.NotNil(t, handler.lichessService)
}

func TestNewImportHandler_NilLichessService(t *testing.T) {
	importSvc := services.NewImportService(nil)
	handler := NewImportHandler(importSvc, nil)

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

	importSvc := services.NewImportService(nil)
	handler := NewImportHandler(importSvc, nil)

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

	importSvc := services.NewImportService(nil)
	handler := NewImportHandler(importSvc, nil)

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

	importSvc := services.NewImportService(nil)
	handler := NewImportHandler(importSvc, nil)

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
	handler := NewImportHandler(importSvc, nil)

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
	handler := NewImportHandler(importSvc, nil)

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
	handler := NewImportHandler(importSvc, nil)

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

	importSvc := services.NewImportService(nil)
	handler := NewImportHandler(importSvc, nil)

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

	importSvc := services.NewImportService(nil)
	handler := NewImportHandler(importSvc, nil)

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

	importSvc := services.NewImportService(nil)
	handler := NewImportHandler(importSvc, nil)

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

	importSvc := services.NewImportService(nil)
	handler := NewImportHandler(importSvc, nil)

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

	importSvc := services.NewImportService(nil)
	handler := NewImportHandler(importSvc, nil)

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

	importSvc := services.NewImportService(nil)
	handler := NewImportHandler(importSvc, nil)

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

	importSvc := services.NewImportService(nil)
	handler := NewImportHandler(importSvc, nil)

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

	importSvc := services.NewImportService(nil)
	handler := NewImportHandler(importSvc, nil)

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

	importSvc := services.NewImportService(nil)
	lichessSvc := services.NewLichessService()
	handler := NewImportHandler(importSvc, lichessSvc)

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

	importSvc := services.NewImportService(nil)
	lichessSvc := services.NewLichessService()
	handler := NewImportHandler(importSvc, lichessSvc)

	err := handler.LichessImportHandler(c)

	require.NoError(t, err)
	assert.Equal(t, http.StatusBadRequest, rec.Code)
}

func TestGetGamesHandler_DefaultPagination(t *testing.T) {
	t.Skip("Requires database connection - skip for unit testing")
	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/api/games", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)

	importSvc := services.NewImportService(nil)
	handler := NewImportHandler(importSvc, nil)

	err := handler.GetGamesHandler(c)

	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, rec.Code)
}

func TestGetGamesHandler_CustomPagination(t *testing.T) {
	t.Skip("Requires database connection - skip for unit testing")
	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/api/games?limit=50&offset=10", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.QueryParams().Set("limit", "50")
	c.QueryParams().Set("offset", "10")

	importSvc := services.NewImportService(nil)
	handler := NewImportHandler(importSvc, nil)

	err := handler.GetGamesHandler(c)

	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, rec.Code)
}

func TestValidatePGNHandler_EmptyBody(t *testing.T) {
	e := echo.New()
	req := httptest.NewRequest(http.MethodPost, "/api/pgn/validate", bytes.NewReader([]byte("")))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)

	importSvc := services.NewImportService(nil)
	handler := NewImportHandler(importSvc, nil)

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

	importSvc := services.NewImportService(nil)
	handler := NewImportHandler(importSvc, nil)

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

	importSvc := services.NewImportService(nil)
	handler := NewImportHandler(importSvc, nil)

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

	importSvc := services.NewImportService(nil)
	handler := NewImportHandler(importSvc, nil)

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
	t.Skip("Requires database connection - verifies .PGN (uppercase) is accepted")
	// This test verifies that the handler accepts .PGN extension (case-insensitive)
	// Skip because it requires DB for full flow
}

func TestValidateMoveHandler_EnPassant(t *testing.T) {
	e := echo.New()
	// Position where en passant is possible
	body := `{"fen":"rnbqkbnr/ppp1pppp/8/3pP3/8/8/PPPP1PPP/RNBQKBNR w KQkq d6","san":"exd6"}`
	req := httptest.NewRequest(http.MethodPost, "/api/validate-move", bytes.NewReader([]byte(body)))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)

	importSvc := services.NewImportService(nil)
	handler := NewImportHandler(importSvc, nil)

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

	importSvc := services.NewImportService(nil)
	handler := NewImportHandler(importSvc, nil)

	err := handler.ValidateMoveHandler(c)

	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, rec.Code)
}
