package handlers

import (
	"context"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"
	"time"

	"github.com/labstack/echo/v5"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/kumquat/backend/internal/models"
	"github.com/kumquat/backend/internal/repository/mocks"
	"github.com/kumquat/backend/internal/services"
)

type stubRawFetcher struct {
	calls        int
	lastDatabase string
	lastValues   url.Values
	lastToken    string
	body         []byte
	err          error
}

func (f *stubRawFetcher) FetchRaw(_ context.Context, database string, values url.Values, token string) ([]byte, error) {
	f.calls++
	f.lastDatabase = database
	f.lastValues = values
	f.lastToken = token
	return f.body, f.err
}

const afterE4 = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1"

func linkedUsers(token string) *mocks.MockUserRepo {
	return &mocks.MockUserRepo{
		GetByIDFunc: func(_ context.Context, id string) (*models.User, error) {
			return &models.User{ID: id, LichessAccessToken: ptr(token)}, nil
		},
	}
}

// signedIn joue le rôle d'OptionalJWTAuth pour un utilisateur connecté.
func signedIn(next echo.HandlerFunc) echo.HandlerFunc {
	return func(c *echo.Context) error {
		c.Set("userID", "user-1")
		return next(c)
	}
}

func proxyRequest(t *testing.T, handler echo.HandlerFunc, database string, query url.Values) *httptest.ResponseRecorder {
	t.Helper()
	e := echo.New()
	e.GET("/api/explorer/:database", handler)
	req := httptest.NewRequest(http.MethodGet, "/api/explorer/"+database+"?"+query.Encode(), nil)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)
	return rec
}

func TestExplorerProxyHandler_CacheMissSignedIn_FetchesWithUserTokenAndCaches(t *testing.T) {
	cache := newStubCache()
	fetcher := &stubRawFetcher{body: []byte(`{"white":1,"draws":2,"black":3,"moves":[]}`)}
	handler := signedIn(ExplorerProxyHandler(fetcher, cache, linkedUsers("user-token"), time.Hour))

	rec := proxyRequest(t, handler, "lichess", url.Values{
		"fen": {afterE4}, "variant": {"standard"}, "speeds": {"rapid,blitz,rapid"}, "ratings": {"2000,1600"}, "moves": {"8"}, "play": {"e2e4"},
	})

	require.Equal(t, http.StatusOK, rec.Code)
	assert.JSONEq(t, `{"white":1,"draws":2,"black":3,"moves":[]}`, rec.Body.String())
	assert.Equal(t, "lichess", fetcher.lastDatabase)
	assert.Equal(t, "user-token", fetcher.lastToken)
	assert.Equal(t, "blitz,rapid", fetcher.lastValues.Get("speeds"))
	assert.Equal(t, "1600,2000", fetcher.lastValues.Get("ratings"))
	assert.Empty(t, fetcher.lastValues.Get("play"), "unknown parameters are dropped")
	assert.Equal(t, 1, cache.putCalls)
}

func TestExplorerProxyHandler_CacheHit_ServesAnonymousVisitorsIgnoringMoveCounters(t *testing.T) {
	cache := newStubCache()
	fetcher := &stubRawFetcher{body: []byte(`{"moves":[]}`)}
	users := linkedUsers("user-token")

	first := proxyRequest(t, signedIn(ExplorerProxyHandler(fetcher, cache, users, time.Hour)), "masters", url.Values{"fen": {afterE4}})
	second := proxyRequest(t, ExplorerProxyHandler(fetcher, cache, users, time.Hour), "masters", url.Values{"fen": {"rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 3 7"}})

	assert.Equal(t, http.StatusOK, first.Code)
	assert.Equal(t, http.StatusOK, second.Code)
	assert.Equal(t, 1, fetcher.calls)
}

func TestExplorerProxyHandler_CacheMissAnonymous_AsksToSignIn(t *testing.T) {
	fetcher := &stubRawFetcher{}

	rec := proxyRequest(t, ExplorerProxyHandler(fetcher, newStubCache(), linkedUsers("user-token"), time.Hour), "lichess", url.Values{"fen": {afterE4}})

	assert.Equal(t, http.StatusForbidden, rec.Code)
	assert.Contains(t, rec.Body.String(), `"code":"lichess_sign_in"`)
	assert.Equal(t, 0, fetcher.calls)
}

func TestExplorerProxyHandler_CacheMissWithoutLichessLink_AsksToConnect(t *testing.T) {
	fetcher := &stubRawFetcher{}
	users := &mocks.MockUserRepo{
		GetByIDFunc: func(_ context.Context, id string) (*models.User, error) { return &models.User{ID: id}, nil },
	}

	rec := proxyRequest(t, signedIn(ExplorerProxyHandler(fetcher, newStubCache(), users, time.Hour)), "lichess", url.Values{"fen": {afterE4}})

	assert.Equal(t, http.StatusForbidden, rec.Code)
	assert.Contains(t, rec.Body.String(), `"code":"lichess_not_linked"`)
	assert.Equal(t, 0, fetcher.calls)
}

func TestExplorerProxyHandler_InvalidQuery_Returns400(t *testing.T) {
	cases := map[string]struct {
		database string
		query    url.Values
	}{
		"unknown database": {"player", url.Values{"fen": {afterE4}}},
		"bad fen":          {"lichess", url.Values{"fen": {"not a fen"}}},
		"unknown rating":   {"lichess", url.Values{"fen": {afterE4}, "ratings": {"1700"}}},
		"unknown speed":    {"lichess", url.Values{"fen": {afterE4}, "speeds": {"daily"}}},
		"too many moves":   {"lichess", url.Values{"fen": {afterE4}, "moves": {"500"}}},
		"other variant":    {"lichess", url.Values{"fen": {afterE4}, "variant": {"atomic"}}},
	}
	for name, tc := range cases {
		t.Run(name, func(t *testing.T) {
			fetcher := &stubRawFetcher{}
			rec := proxyRequest(t, signedIn(ExplorerProxyHandler(fetcher, newStubCache(), linkedUsers("user-token"), time.Hour)), tc.database, tc.query)
			assert.Equal(t, http.StatusBadRequest, rec.Code)
			assert.Equal(t, 0, fetcher.calls)
		})
	}
}

func TestExplorerProxyHandler_TokenRejectedByLichess_AsksToReconnectWithoutCaching(t *testing.T) {
	cache := newStubCache()
	fetcher := &stubRawFetcher{err: services.ErrExplorerUnauthorized}

	rec := proxyRequest(t, signedIn(ExplorerProxyHandler(fetcher, cache, linkedUsers("revoked"), time.Hour)), "lichess", url.Values{"fen": {afterE4}})

	assert.Equal(t, http.StatusForbidden, rec.Code)
	assert.Contains(t, rec.Body.String(), `"code":"lichess_token_invalid"`)
	assert.Equal(t, 0, cache.putCalls)
}

func ptr(s string) *string { return &s }

func TestExplorerProxyHandler_RateLimitedByLichess_PassesRetryDelay(t *testing.T) {
	fetcher := &stubRawFetcher{err: &services.RateLimitedError{RetryAfterSeconds: 17}}

	rec := proxyRequest(t, signedIn(ExplorerProxyHandler(fetcher, newStubCache(), linkedUsers("user-token"), time.Hour)), "lichess", url.Values{"fen": {afterE4}})

	assert.Equal(t, http.StatusTooManyRequests, rec.Code)
	assert.Contains(t, rec.Body.String(), `"retryAfterSeconds":17`)
}

type stubExplorerCache struct {
	putCalls int
	store    map[string][]byte
}

func newStubCache() *stubExplorerCache {
	return &stubExplorerCache{store: map[string][]byte{}}
}

func (c *stubExplorerCache) Get(_ context.Context, key string) ([]byte, bool, error) {
	v, ok := c.store[key]
	return v, ok, nil
}

func (c *stubExplorerCache) Put(_ context.Context, key string, payload []byte, _ time.Time) error {
	c.putCalls++
	c.store[key] = payload
	return nil
}

func (c *stubExplorerCache) DeleteExpired(_ context.Context) error {
	return nil
}
