package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/labstack/echo/v4"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/treechess/backend/internal/models"
	"github.com/treechess/backend/internal/services"
)

func TestHealthHandler(t *testing.T) {
	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/api/health", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)

	err := HealthHandler(c)

	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, rec.Code)

	var response map[string]string
	err = json.Unmarshal(rec.Body.Bytes(), &response)
	require.NoError(t, err)
	assert.Equal(t, "ok", response["status"])
}

func TestListRepertoiresHandler_InvalidColor(t *testing.T) {
	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/api/repertoires?color=invalid", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)

	svc := services.NewRepertoireService()
	handler := ListRepertoiresHandler(svc)

	err := handler(c)

	require.NoError(t, err)
	assert.Equal(t, http.StatusBadRequest, rec.Code)

	var response map[string]string
	err = json.Unmarshal(rec.Body.Bytes(), &response)
	require.NoError(t, err)
	assert.Contains(t, response["error"], "invalid color")
}

func TestGetRepertoireHandler_InvalidID(t *testing.T) {
	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/api/repertoire/not-a-uuid", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.SetParamNames("id")
	c.SetParamValues("not-a-uuid")

	svc := services.NewRepertoireService()
	handler := GetRepertoireHandler(svc)

	err := handler(c)

	require.NoError(t, err)
	assert.Equal(t, http.StatusBadRequest, rec.Code)

	var response map[string]string
	err = json.Unmarshal(rec.Body.Bytes(), &response)
	require.NoError(t, err)
	assert.Contains(t, response["error"], "valid UUID")
}

func TestCreateRepertoireHandler_MissingName(t *testing.T) {
	e := echo.New()
	body := `{"color":"white"}`
	req := httptest.NewRequest(http.MethodPost, "/api/repertoires", strings.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)

	svc := services.NewRepertoireService()
	handler := CreateRepertoireHandler(svc)

	err := handler(c)

	require.NoError(t, err)
	assert.Equal(t, http.StatusBadRequest, rec.Code)

	var response map[string]string
	err = json.Unmarshal(rec.Body.Bytes(), &response)
	require.NoError(t, err)
	assert.Contains(t, response["error"], "name is required")
}

func TestCreateRepertoireHandler_InvalidColor(t *testing.T) {
	e := echo.New()
	body := `{"name":"Test","color":"invalid"}`
	req := httptest.NewRequest(http.MethodPost, "/api/repertoires", strings.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)

	svc := services.NewRepertoireService()
	handler := CreateRepertoireHandler(svc)

	err := handler(c)

	require.NoError(t, err)
	assert.Equal(t, http.StatusBadRequest, rec.Code)

	var response map[string]string
	err = json.Unmarshal(rec.Body.Bytes(), &response)
	require.NoError(t, err)
	assert.Contains(t, response["error"], "invalid color")
}

func TestCreateRepertoireHandler_InvalidJSON(t *testing.T) {
	e := echo.New()
	body := `{invalid json}`
	req := httptest.NewRequest(http.MethodPost, "/api/repertoires", strings.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)

	svc := services.NewRepertoireService()
	handler := CreateRepertoireHandler(svc)

	err := handler(c)

	require.NoError(t, err)
	assert.Equal(t, http.StatusBadRequest, rec.Code)
}

func TestUpdateRepertoireHandler_InvalidID(t *testing.T) {
	e := echo.New()
	body := `{"name":"New Name"}`
	req := httptest.NewRequest(http.MethodPatch, "/api/repertoire/not-a-uuid", strings.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.SetParamNames("id")
	c.SetParamValues("not-a-uuid")

	svc := services.NewRepertoireService()
	handler := UpdateRepertoireHandler(svc)

	err := handler(c)

	require.NoError(t, err)
	assert.Equal(t, http.StatusBadRequest, rec.Code)

	var response map[string]string
	err = json.Unmarshal(rec.Body.Bytes(), &response)
	require.NoError(t, err)
	assert.Contains(t, response["error"], "valid UUID")
}

func TestDeleteRepertoireHandler_InvalidID(t *testing.T) {
	e := echo.New()
	req := httptest.NewRequest(http.MethodDelete, "/api/repertoire/not-a-uuid", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.SetParamNames("id")
	c.SetParamValues("not-a-uuid")

	svc := services.NewRepertoireService()
	handler := DeleteRepertoireHandler(svc)

	err := handler(c)

	require.NoError(t, err)
	assert.Equal(t, http.StatusBadRequest, rec.Code)
}

func TestAddNodeHandler_InvalidRepertoireID(t *testing.T) {
	e := echo.New()
	body := `{"parentId":"123e4567-e89b-12d3-a456-426614174000","move":"e4"}`
	req := httptest.NewRequest(http.MethodPost, "/api/repertoire/not-a-uuid/node", strings.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.SetParamNames("id")
	c.SetParamValues("not-a-uuid")

	svc := services.NewRepertoireService()
	handler := AddNodeHandler(svc)

	err := handler(c)

	require.NoError(t, err)
	assert.Equal(t, http.StatusBadRequest, rec.Code)

	var response map[string]string
	err = json.Unmarshal(rec.Body.Bytes(), &response)
	require.NoError(t, err)
	assert.Contains(t, response["error"], "valid UUID")
}

func TestAddNodeHandler_MissingParentID(t *testing.T) {
	e := echo.New()
	body := `{"move":"e4"}`
	req := httptest.NewRequest(http.MethodPost, "/api/repertoire/123e4567-e89b-12d3-a456-426614174000/node", strings.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.SetParamNames("id")
	c.SetParamValues("123e4567-e89b-12d3-a456-426614174000")

	svc := services.NewRepertoireService()
	handler := AddNodeHandler(svc)

	err := handler(c)

	require.NoError(t, err)
	assert.Equal(t, http.StatusBadRequest, rec.Code)

	var response map[string]string
	err = json.Unmarshal(rec.Body.Bytes(), &response)
	require.NoError(t, err)
	assert.Equal(t, "parentId is required", response["error"])
}

func TestAddNodeHandler_InvalidParentID(t *testing.T) {
	e := echo.New()
	body := `{"parentId":"not-a-uuid","move":"e4"}`
	req := httptest.NewRequest(http.MethodPost, "/api/repertoire/123e4567-e89b-12d3-a456-426614174000/node", strings.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.SetParamNames("id")
	c.SetParamValues("123e4567-e89b-12d3-a456-426614174000")

	svc := services.NewRepertoireService()
	handler := AddNodeHandler(svc)

	err := handler(c)

	require.NoError(t, err)
	assert.Equal(t, http.StatusBadRequest, rec.Code)

	var response map[string]string
	err = json.Unmarshal(rec.Body.Bytes(), &response)
	require.NoError(t, err)
	assert.Contains(t, response["error"], "parentId must be a valid UUID")
}

func TestAddNodeHandler_MissingMove(t *testing.T) {
	e := echo.New()
	body := `{"parentId":"123e4567-e89b-12d3-a456-426614174000","moveNumber":1}`
	req := httptest.NewRequest(http.MethodPost, "/api/repertoire/123e4567-e89b-12d3-a456-426614174000/node", strings.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.SetParamNames("id")
	c.SetParamValues("123e4567-e89b-12d3-a456-426614174000")

	svc := services.NewRepertoireService()
	handler := AddNodeHandler(svc)

	err := handler(c)

	require.NoError(t, err)
	assert.Equal(t, http.StatusBadRequest, rec.Code)

	var response map[string]string
	err = json.Unmarshal(rec.Body.Bytes(), &response)
	require.NoError(t, err)
	assert.Equal(t, "move is required", response["error"])
}

func TestAddNodeHandler_InvalidJSON(t *testing.T) {
	e := echo.New()
	body := `{invalid json}`
	req := httptest.NewRequest(http.MethodPost, "/api/repertoire/123e4567-e89b-12d3-a456-426614174000/node", strings.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.SetParamNames("id")
	c.SetParamValues("123e4567-e89b-12d3-a456-426614174000")

	svc := services.NewRepertoireService()
	handler := AddNodeHandler(svc)

	err := handler(c)

	require.NoError(t, err)
	assert.Equal(t, http.StatusBadRequest, rec.Code)
}

func TestDeleteNodeHandler_InvalidRepertoireID(t *testing.T) {
	e := echo.New()
	req := httptest.NewRequest(http.MethodDelete, "/api/repertoire/not-a-uuid/node/123e4567-e89b-12d3-a456-426614174000", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.SetParamNames("id", "nodeId")
	c.SetParamValues("not-a-uuid", "123e4567-e89b-12d3-a456-426614174000")

	svc := services.NewRepertoireService()
	handler := DeleteNodeHandler(svc)

	err := handler(c)

	require.NoError(t, err)
	assert.Equal(t, http.StatusBadRequest, rec.Code)

	var response map[string]string
	err = json.Unmarshal(rec.Body.Bytes(), &response)
	require.NoError(t, err)
	assert.Contains(t, response["error"], "repertoire id must be a valid UUID")
}

func TestDeleteNodeHandler_InvalidNodeID(t *testing.T) {
	e := echo.New()
	req := httptest.NewRequest(http.MethodDelete, "/api/repertoire/123e4567-e89b-12d3-a456-426614174000/node/not-a-uuid", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.SetParamNames("id", "nodeId")
	c.SetParamValues("123e4567-e89b-12d3-a456-426614174000", "not-a-uuid")

	svc := services.NewRepertoireService()
	handler := DeleteNodeHandler(svc)

	err := handler(c)

	require.NoError(t, err)
	assert.Equal(t, http.StatusBadRequest, rec.Code)

	var response map[string]string
	err = json.Unmarshal(rec.Body.Bytes(), &response)
	require.NoError(t, err)
	assert.Contains(t, response["error"], "node id must be a valid UUID")
}

func TestRepertoireResponseFormat(t *testing.T) {
	expectedRoot := models.RepertoireNode{
		ID:          "test-id",
		FEN:         "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -",
		Move:        nil,
		MoveNumber:  0,
		ColorToMove: models.ChessColorWhite,
		ParentID:    nil,
		Children:    nil,
	}

	expected := models.Repertoire{
		ID:       "test-rep-id",
		Name:     "Test Repertoire",
		Color:    models.ColorWhite,
		TreeData: expectedRoot,
		Metadata: models.Metadata{TotalNodes: 1, TotalMoves: 0, DeepestDepth: 0},
	}

	data, err := json.Marshal(expected)
	require.NoError(t, err)

	var decoded models.Repertoire
	err = json.Unmarshal(data, &decoded)
	require.NoError(t, err)

	assert.Equal(t, expected.ID, decoded.ID)
	assert.Equal(t, expected.Name, decoded.Name)
	assert.Equal(t, expected.Color, decoded.Color)
	assert.Nil(t, decoded.TreeData.Move)
	assert.Equal(t, expected.Metadata.TotalNodes, decoded.Metadata.TotalNodes)
}

func TestHealthHandler_ResponseFormat(t *testing.T) {
	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/api/health", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)

	err := HealthHandler(c)

	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, rec.Code)

	// Verify JSON format
	var response map[string]string
	err = json.Unmarshal(rec.Body.Bytes(), &response)
	require.NoError(t, err)
	assert.Equal(t, "ok", response["status"])
	assert.Contains(t, rec.Header().Get("Content-Type"), "application/json")
}

// Integration tests that require database - skipped for unit testing
func TestListRepertoiresHandler_WithColor(t *testing.T) {
	t.Skip("Requires database connection - skip for unit testing")
}

func TestCreateRepertoireHandler_ValidRequest(t *testing.T) {
	t.Skip("Requires database connection - skip for unit testing")
}

func TestGetRepertoireHandler_ValidID(t *testing.T) {
	t.Skip("Requires database connection - skip for unit testing")
}

func TestUpdateRepertoireHandler_ValidRequest(t *testing.T) {
	t.Skip("Requires database connection - skip for unit testing")
}

func TestDeleteRepertoireHandler_ValidID(t *testing.T) {
	t.Skip("Requires database connection - skip for unit testing")
}

func TestAddNodeHandler_ValidRequest(t *testing.T) {
	t.Skip("Requires database connection - skip for unit testing")
}

func TestDeleteNodeHandler_ValidRequest(t *testing.T) {
	t.Skip("Requires database connection - skip for unit testing")
}
