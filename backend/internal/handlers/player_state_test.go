package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/labstack/echo/v5"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type stubPlayerState struct {
	values map[string]string
}

func (s *stubPlayerState) Get(context.Context, string) (json.RawMessage, error) {
	return json.Marshal(s.values)
}

func (s *stubPlayerState) Set(_ context.Context, _ string, key string, value json.RawMessage) error {
	s.values[key] = string(value)
	return nil
}

func putState(t *testing.T, store PlayerStateStore, key, body string) *httptest.ResponseRecorder {
	t.Helper()
	e := echo.New()
	e.PUT("/api/v2/state/:key", signedIn(PutPlayerStateHandler(store)))
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, httptest.NewRequest(http.MethodPut, "/api/v2/state/"+key, strings.NewReader(body)))
	return rec
}

func TestPutPlayerStateHandler_SavesADecisionKey(t *testing.T) {
	store := &stubPlayerState{values: map[string]string{}}
	rec := putState(t, store, "ignored-checks", `[3,14]`)
	require.Equal(t, http.StatusNoContent, rec.Code)
	assert.Equal(t, `[3,14]`, store.values["ignored-checks"])
}

func TestPutPlayerStateHandler_RefusesAnUnknownKeyOrAValueThatIsNotJSON(t *testing.T) {
	store := &stubPlayerState{values: map[string]string{}}
	assert.Equal(t, http.StatusBadRequest, putState(t, store, "replay-day", `"2026-01-04"`).Code)
	assert.Equal(t, http.StatusBadRequest, putState(t, store, "additions", `[{`).Code)
	assert.Empty(t, store.values)
}

func TestPutPlayerStateHandler_RefusesAValueOverOneMegabyte(t *testing.T) {
	store := &stubPlayerState{values: map[string]string{}}
	huge := `"` + strings.Repeat("x", maxPlayerStateValue) + `"`
	assert.Equal(t, http.StatusRequestEntityTooLarge, putState(t, store, "review", huge).Code)
}
