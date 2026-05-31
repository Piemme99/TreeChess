package handlers

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/labstack/echo/v5"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestImportExploreTemplateHandler_UnknownID_Returns404(t *testing.T) {
	e := echo.New()
	req := httptest.NewRequest(http.MethodPost, "/api/explore/templates/does-not-exist/import", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.SetPathValues(echo.PathValues{{Name: "id", Value: "does-not-exist"}})
	setTestUserID(c)

	svc := newTestRepertoireService()
	handler := ImportExploreTemplateHandler(svc)
	require.NoError(t, handler(c))

	assert.Equal(t, http.StatusNotFound, rec.Code)
	assert.Contains(t, rec.Body.String(), "template not found")
}

func TestImportExploreTemplateHandler_PathTraversalID_Returns404(t *testing.T) {
	e := echo.New()
	req := httptest.NewRequest(http.MethodPost, "/api/explore/templates/import", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.SetPathValues(echo.PathValues{{Name: "id", Value: "../../etc/passwd"}})
	setTestUserID(c)

	svc := newTestRepertoireService()
	handler := ImportExploreTemplateHandler(svc)
	require.NoError(t, handler(c))

	assert.Equal(t, http.StatusNotFound, rec.Code)
}
