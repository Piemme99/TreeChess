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

func newTestContext() (*echo.Context, *httptest.ResponseRecorder) {
	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	rec := httptest.NewRecorder()
	return e.NewContext(req, rec), rec
}

func decodeError(t *testing.T, rec *httptest.ResponseRecorder) string {
	t.Helper()
	var body map[string]string
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &body))
	return body["error"]
}

func TestMustUserID_Present(t *testing.T) {
	c, _ := newTestContext()
	c.Set("userID", "user-123")

	userID, ok := mustUserID(c)

	assert.True(t, ok)
	assert.Equal(t, "user-123", userID)
}

func TestMustUserID_Missing(t *testing.T) {
	c, rec := newTestContext()

	userID, ok := mustUserID(c)

	assert.False(t, ok)
	assert.Empty(t, userID)
	assert.Equal(t, http.StatusUnauthorized, rec.Code)
	assert.Equal(t, "authentication required", decodeError(t, rec))
}

func TestMustUserID_EmptyString(t *testing.T) {
	c, rec := newTestContext()
	c.Set("userID", "")

	_, ok := mustUserID(c)

	assert.False(t, ok)
	assert.Equal(t, http.StatusUnauthorized, rec.Code)
}
