package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/labstack/echo/v5"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/kumquat/backend/internal/repository/mocks"
	"github.com/kumquat/backend/internal/services"
)

const (
	validDismissFEN = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1"
	validRepUUID    = "123e4567-e89b-12d3-a456-426614174000"
)

func newTestDashboardHandler(belongsToUser bool) *DashboardHandler {
	mockRepo := &mocks.MockRepertoireRepo{
		BelongsToUserFunc: func(id, userID string) (bool, error) { return belongsToUser, nil },
	}
	repertoireSvc := services.NewRepertoireService(mockRepo)
	importSvc := services.NewImportService(nil, nil)
	return NewDashboardHandler(importSvc, repertoireSvc)
}

func doDismissGap(t *testing.T, h *DashboardHandler, body string) *httptest.ResponseRecorder {
	t.Helper()
	e := echo.New()
	req := httptest.NewRequest(http.MethodPost, "/api/dashboard/dismiss-gap", strings.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	setTestUserID(c)
	require.NoError(t, h.DismissGap(c))
	return rec
}

func TestDismissGap_InvalidJSON(t *testing.T) {
	h := newTestDashboardHandler(true)
	rec := doDismissGap(t, h, `{invalid}`)
	assert.Equal(t, http.StatusBadRequest, rec.Code)
}

func TestDismissGap_MissingFields(t *testing.T) {
	h := newTestDashboardHandler(true)
	rec := doDismissGap(t, h, `{"fen":"","opponentMove":"","repertoireId":""}`)
	assert.Equal(t, http.StatusBadRequest, rec.Code)
	var resp map[string]string
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &resp))
	assert.Contains(t, resp["error"], "required")
}

func TestDismissGap_MalformedFEN(t *testing.T) {
	h := newTestDashboardHandler(true)
	body := `{"fen":"not a fen","opponentMove":"e4","repertoireId":"` + validRepUUID + `"}`
	rec := doDismissGap(t, h, body)
	assert.Equal(t, http.StatusBadRequest, rec.Code)
	var resp map[string]string
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &resp))
	assert.Contains(t, resp["error"], "valid FEN")
}

func TestDismissGap_OversizedOpponentMove(t *testing.T) {
	h := newTestDashboardHandler(true)
	longMove := strings.Repeat("a", MaxChessMoveLength+1)
	body := `{"fen":"` + validDismissFEN + `","opponentMove":"` + longMove + `","repertoireId":"` + validRepUUID + `"}`
	rec := doDismissGap(t, h, body)
	assert.Equal(t, http.StatusBadRequest, rec.Code)
}

func TestDismissGap_NonUUIDRepertoireID(t *testing.T) {
	h := newTestDashboardHandler(true)
	body := `{"fen":"` + validDismissFEN + `","opponentMove":"e4","repertoireId":"not-a-uuid"}`
	rec := doDismissGap(t, h, body)
	assert.Equal(t, http.StatusBadRequest, rec.Code)
	var resp map[string]string
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &resp))
	assert.Contains(t, resp["error"], "valid UUID")
}

func TestDismissGap_NonOwnedRepertoire(t *testing.T) {
	h := newTestDashboardHandler(false) // repertoire does not belong to user
	body := `{"fen":"` + validDismissFEN + `","opponentMove":"e4","repertoireId":"` + validRepUUID + `"}`
	rec := doDismissGap(t, h, body)
	assert.Equal(t, http.StatusNotFound, rec.Code)
}

func TestDismissGap_DismissRepoNotConfigured(t *testing.T) {
	// All validation passes and the repertoire is owned, but the import
	// service has no dismissed-gap repo wired, so it returns 500.
	h := newTestDashboardHandler(true)
	body := `{"fen":"` + validDismissFEN + `","opponentMove":"e4","repertoireId":"` + validRepUUID + `"}`
	rec := doDismissGap(t, h, body)
	assert.Equal(t, http.StatusInternalServerError, rec.Code)
}
