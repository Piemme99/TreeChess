package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/labstack/echo/v5"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/kumquat/backend/internal/repository/mocks"
	"github.com/kumquat/backend/internal/services"
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

func TestRequireOwnership_Owned(t *testing.T) {
	c, rec := newTestContext()
	svc := services.NewRepertoireService(&mocks.MockRepertoireRepo{
		BelongsToUserFunc: func(_ context.Context, id, userID string) (bool, error) { return true, nil },
	})

	ok := requireOwnership(c, svc, "rep-1", "user-1")

	assert.True(t, ok)
	assert.Equal(t, http.StatusOK, rec.Code) // nothing written
}

func TestRequireOwnership_NotOwned(t *testing.T) {
	c, rec := newTestContext()
	svc := services.NewRepertoireService(&mocks.MockRepertoireRepo{
		BelongsToUserFunc: func(_ context.Context, id, userID string) (bool, error) { return false, nil },
	})

	ok := requireOwnership(c, svc, "rep-1", "user-1")

	assert.False(t, ok)
	assert.Equal(t, http.StatusNotFound, rec.Code)
	assert.Equal(t, "repertoire not found", decodeError(t, rec))
}

func TestMapRepertoireServiceError(t *testing.T) {
	tests := []struct {
		name       string
		err        error
		wantStatus int
		wantError  string
	}{
		{"not found", services.ErrNotFound, http.StatusNotFound, "repertoire not found"},
		{"node not found", services.ErrNodeNotFound, http.StatusNotFound, "node not found"},
		{"unexpected", assert.AnError, http.StatusInternalServerError, "boom"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			c, rec := newTestContext()

			err := mapRepertoireServiceError(c, tt.err, "boom")

			require.NoError(t, err)
			assert.Equal(t, tt.wantStatus, rec.Code)
			assert.Equal(t, tt.wantError, decodeError(t, rec))
		})
	}
}

func TestValidateRepertoireID(t *testing.T) {
	t.Run("valid", func(t *testing.T) {
		c, _ := newTestContext()
		c.SetPathValues(echo.PathValues{{Name: "id", Value: "123e4567-e89b-12d3-a456-426614174000"}})

		id, ok := validateRepertoireID(c)

		assert.True(t, ok)
		assert.Equal(t, "123e4567-e89b-12d3-a456-426614174000", id)
	})

	t.Run("invalid", func(t *testing.T) {
		c, rec := newTestContext()
		c.SetPathValues(echo.PathValues{{Name: "id", Value: "not-a-uuid"}})

		_, ok := validateRepertoireID(c)

		assert.False(t, ok)
		assert.Equal(t, http.StatusBadRequest, rec.Code)
		assert.Equal(t, "repertoire id must be a valid UUID", decodeError(t, rec))
	})
}

func TestValidateNodeID(t *testing.T) {
	t.Run("valid", func(t *testing.T) {
		c, _ := newTestContext()
		c.SetPathValues(echo.PathValues{{Name: "nodeId", Value: "123e4567-e89b-12d3-a456-426614174000"}})

		id, ok := validateNodeID(c)

		assert.True(t, ok)
		assert.Equal(t, "123e4567-e89b-12d3-a456-426614174000", id)
	})

	t.Run("invalid", func(t *testing.T) {
		c, rec := newTestContext()
		c.SetPathValues(echo.PathValues{{Name: "nodeId", Value: "not-a-uuid"}})

		_, ok := validateNodeID(c)

		assert.False(t, ok)
		assert.Equal(t, http.StatusBadRequest, rec.Code)
		assert.Equal(t, "node id must be a valid UUID", decodeError(t, rec))
	})
}

// TestNodeHandler_NoUserID_Returns401 verifies that node-mutation handlers no longer
// panic when mounted without the JWTAuth middleware (i.e. without a "userID" in the
// context); instead they emit a 401 via the standard envelope.
func TestNodeHandler_NoUserID_Returns401(t *testing.T) {
	e := echo.New()
	validUUID := "123e4567-e89b-12d3-a456-426614174000"
	req := httptest.NewRequest(http.MethodDelete, "/api/repertoires/"+validUUID+"/nodes/"+validUUID, nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.SetPathValues(echo.PathValues{{Name: "id", Value: validUUID}, {Name: "nodeId", Value: validUUID}})
	// Note: intentionally not calling setTestUserID(c).

	handler := DeleteNodeHandler(newTestRepertoireService())

	require.NotPanics(t, func() {
		err := handler(c)
		require.NoError(t, err)
	})
	assert.Equal(t, http.StatusUnauthorized, rec.Code)
	assert.Equal(t, "authentication required", decodeError(t, rec))
}
