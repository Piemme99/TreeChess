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

func TestRepertoireHandler_InvalidColor(t *testing.T) {
	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/api/repertoire/invalid", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.SetParamNames("color")
	c.SetParamValues("invalid")

	svc := services.NewRepertoireService()
	handler := RepertoireHandler(svc)

	err := handler(c)

	require.NoError(t, err)
	assert.Equal(t, http.StatusBadRequest, rec.Code)

	var response map[string]string
	err = json.Unmarshal(rec.Body.Bytes(), &response)
	require.NoError(t, err)
	assert.Contains(t, response["error"], "invalid color")
}

func TestRepertoireHandler_InvalidColorFormat(t *testing.T) {
	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/api/repertoire/yellow", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.SetParamNames("color")
	c.SetParamValues("yellow")

	svc := services.NewRepertoireService()
	handler := RepertoireHandler(svc)

	err := handler(c)

	require.NoError(t, err)
	assert.Equal(t, http.StatusBadRequest, rec.Code)
}

func TestAddNodeHandler_InvalidURLColor(t *testing.T) {
	e := echo.New()
	body := `{"parentId":"test","move":"e4","fen":"test","moveNumber":1,"colorToMove":"white"}`
	req := httptest.NewRequest(http.MethodPost, "/api/repertoire/invalid/node", strings.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.SetParamNames("color")
	c.SetParamValues("invalid")

	svc := services.NewRepertoireService()
	handler := AddNodeHandler(svc)

	err := handler(c)

	require.NoError(t, err)
	assert.Equal(t, http.StatusBadRequest, rec.Code)

	var response map[string]string
	err = json.Unmarshal(rec.Body.Bytes(), &response)
	require.NoError(t, err)
	assert.Contains(t, response["error"], "invalid color")
}

func TestAddNodeHandler_MissingParentID(t *testing.T) {
	e := echo.New()
	body := `{"move":"e4","fen":"test","moveNumber":1,"colorToMove":"white"}`
	req := httptest.NewRequest(http.MethodPost, "/api/repertoire/white/node", strings.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.SetParamNames("color")
	c.SetParamValues("white")

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

func TestAddNodeHandler_MissingMove(t *testing.T) {
	e := echo.New()
	// Use a valid UUID for parentId to test the move validation
	body := `{"parentId":"123e4567-e89b-12d3-a456-426614174000","moveNumber":1}`
	req := httptest.NewRequest(http.MethodPost, "/api/repertoire/white/node", strings.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.SetParamNames("color")
	c.SetParamValues("white")

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
	req := httptest.NewRequest(http.MethodPost, "/api/repertoire/white/node", strings.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.SetParamNames("color")
	c.SetParamValues("white")

	svc := services.NewRepertoireService()
	handler := AddNodeHandler(svc)

	err := handler(c)

	require.NoError(t, err)
	assert.Equal(t, http.StatusBadRequest, rec.Code)
}

func TestDeleteNodeHandler_InvalidColor(t *testing.T) {
	e := echo.New()
	req := httptest.NewRequest(http.MethodDelete, "/api/repertoire/invalid/node/test-id", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.SetParamNames("color", "id")
	c.SetParamValues("invalid", "test-id")

	svc := services.NewRepertoireService()
	handler := DeleteNodeHandler(svc)

	err := handler(c)

	require.NoError(t, err)
	assert.Equal(t, http.StatusBadRequest, rec.Code)
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
	assert.Equal(t, expected.Color, decoded.Color)
	assert.Nil(t, decoded.TreeData.Move)
	assert.Equal(t, expected.Metadata.TotalNodes, decoded.Metadata.TotalNodes)
}

// Additional tests for repertoire handlers

func TestRepertoireHandler_WhiteColor(t *testing.T) {
	t.Skip("Requires database connection - skip for unit testing")
}

func TestRepertoireHandler_BlackColor(t *testing.T) {
	t.Skip("Requires database connection - skip for unit testing")
}

func TestAddNodeHandler_EmptyBody(t *testing.T) {
	e := echo.New()
	req := httptest.NewRequest(http.MethodPost, "/api/repertoire/white/node", strings.NewReader(""))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.SetParamNames("color")
	c.SetParamValues("white")

	svc := services.NewRepertoireService()
	handler := AddNodeHandler(svc)

	err := handler(c)

	require.NoError(t, err)
	assert.Equal(t, http.StatusBadRequest, rec.Code)
}

func TestAddNodeHandler_WhiteValidRequest(t *testing.T) {
	t.Skip("Requires database connection - skip for unit testing")
	// This test would verify a valid add node request for white repertoire
}

func TestAddNodeHandler_BlackValidRequest(t *testing.T) {
	t.Skip("Requires database connection - skip for unit testing")
	// This test would verify a valid add node request for black repertoire
}

func TestDeleteNodeHandler_WhiteColor(t *testing.T) {
	t.Skip("Requires database connection - skip for unit testing")
	// This test would verify deletion from white repertoire
}

func TestDeleteNodeHandler_BlackColor(t *testing.T) {
	t.Skip("Requires database connection - skip for unit testing")
	// This test would verify deletion from black repertoire
}

func TestDeleteNodeHandler_MissingID(t *testing.T) {
	e := echo.New()
	req := httptest.NewRequest(http.MethodDelete, "/api/repertoire/white/node/", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.SetParamNames("color", "id")
	c.SetParamValues("white", "")

	svc := services.NewRepertoireService()
	handler := DeleteNodeHandler(svc)

	err := handler(c)

	require.NoError(t, err)
	// Empty ID should be handled
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

func TestAddNodeHandler_ValidColors(t *testing.T) {
	tests := []struct {
		color string
		valid bool
	}{
		{"white", true},
		{"black", true},
		{"invalid", false},
		{"WHITE", false}, // Case-sensitive
		{"", false},
	}

	for _, tt := range tests {
		t.Run(tt.color, func(t *testing.T) {
			e := echo.New()
			body := `{"parentId":"test","move":"e4"}`
			req := httptest.NewRequest(http.MethodPost, "/api/repertoire/"+tt.color+"/node", strings.NewReader(body))
			req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
			rec := httptest.NewRecorder()
			c := e.NewContext(req, rec)
			c.SetParamNames("color")
			c.SetParamValues(tt.color)

			svc := services.NewRepertoireService()
			handler := AddNodeHandler(svc)

			err := handler(c)

			require.NoError(t, err)
			if !tt.valid {
				assert.Equal(t, http.StatusBadRequest, rec.Code)
			}
		})
	}
}

func TestRepertoireHandler_ValidColors(t *testing.T) {
	invalidColors := []string{"invalid", "yellow", "blue", "WHITE", "BLACK", ""}

	for _, color := range invalidColors {
		t.Run(color, func(t *testing.T) {
			e := echo.New()
			req := httptest.NewRequest(http.MethodGet, "/api/repertoire/"+color, nil)
			rec := httptest.NewRecorder()
			c := e.NewContext(req, rec)
			c.SetParamNames("color")
			c.SetParamValues(color)

			svc := services.NewRepertoireService()
			handler := RepertoireHandler(svc)

			err := handler(c)

			require.NoError(t, err)
			assert.Equal(t, http.StatusBadRequest, rec.Code)
		})
	}
}

func TestDeleteNodeHandler_ValidColors(t *testing.T) {
	invalidColors := []string{"invalid", "yellow", "red", "WHITE"}

	for _, color := range invalidColors {
		t.Run(color, func(t *testing.T) {
			e := echo.New()
			req := httptest.NewRequest(http.MethodDelete, "/api/repertoire/"+color+"/node/test-id", nil)
			rec := httptest.NewRecorder()
			c := e.NewContext(req, rec)
			c.SetParamNames("color", "id")
			c.SetParamValues(color, "test-id")

			svc := services.NewRepertoireService()
			handler := DeleteNodeHandler(svc)

			err := handler(c)

			require.NoError(t, err)
			assert.Equal(t, http.StatusBadRequest, rec.Code)
		})
	}
}
