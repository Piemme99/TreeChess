package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/labstack/echo/v5"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestHealthHandler(t *testing.T) {
	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/api/health", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)

	handler := HealthHandler(nil)
	err := handler(c)

	require.NoError(t, err)
	// Without a DB pool, health check returns degraded
	assert.Equal(t, http.StatusServiceUnavailable, rec.Code)

	var response map[string]string
	err = json.Unmarshal(rec.Body.Bytes(), &response)
	require.NoError(t, err)
	assert.Equal(t, "degraded", response["status"])
}

func TestHealthHandler_ResponseFormat(t *testing.T) {
	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/api/health", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)

	handler := HealthHandler(nil)
	err := handler(c)

	require.NoError(t, err)

	var response map[string]string
	err = json.Unmarshal(rec.Body.Bytes(), &response)
	require.NoError(t, err)
	assert.Contains(t, rec.Header().Get("Content-Type"), "application/json")
	_, hasStatus := response["status"]
	assert.True(t, hasStatus)
}
