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

// stubExplorerCache is a minimal in-memory implementation of
// repository.OpeningExplorerCacheRepository for handler tests.
type stubExplorerCache struct {
	getCalls int
	putCalls int
	store    map[string][]byte
	getErr   error
}

func newStubCache() *stubExplorerCache {
	return &stubExplorerCache{store: map[string][]byte{}}
}

func (c *stubExplorerCache) Get(_ context.Context, key string) ([]byte, bool, error) {
	c.getCalls++
	if c.getErr != nil {
		return nil, false, c.getErr
	}
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

// stubFetcher implements services.OpeningExplorerFetcher.
type stubFetcher struct {
	calls       int
	lastToken   string
	lastQuery   services.OpeningQuery
	returnStats *services.OpeningStats
	returnErr   error
}

func (f *stubFetcher) FetchOpening(_ context.Context, q services.OpeningQuery, token string) (*services.OpeningStats, error) {
	f.calls++
	f.lastToken = token
	f.lastQuery = q
	return f.returnStats, f.returnErr
}

func newTrainingExplorerHandler(t *testing.T, fetcher services.OpeningExplorerFetcher, cache *stubExplorerCache, userRepo *mocks.MockUserRepo) *TrainingExplorerHandler {
	t.Helper()
	return NewTrainingExplorerHandler(fetcher, cache, userRepo, 24*time.Hour)
}

func doRequest(t *testing.T, h *TrainingExplorerHandler, userID, fen string) *httptest.ResponseRecorder {
	t.Helper()
	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/api/training/opening?fen="+url.QueryEscape(fen), nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.Set("userID", userID)
	require.NoError(t, h.GetOpening(c))
	return rec
}

func TestTrainingExplorerHandler_CacheHitReturnsPayloadWithoutUpstream(t *testing.T) {
	cache := newStubCache()
	cachedBody := []byte(`{"white":10,"draws":5,"black":3,"moves":[{"uci":"e2e4","san":"e4","white":6,"draws":2,"black":1,"averageRating":1900}]}`)

	fetcher := &stubFetcher{}
	userLookups := 0
	userRepo := &mocks.MockUserRepo{
		GetByIDFunc: func(id string) (*models.User, error) {
			userLookups++
			return &models.User{ID: id}, nil
		},
	}

	h := newTrainingExplorerHandler(t, fetcher, cache, userRepo)

	// Pre-populate cache for the canonical key the handler will compute.
	// We don't know the exact key yet; use a setup helper via the handler
	// after the fact: poke the same FEN in once to learn the key, then
	// pre-populate. Cleaner: expose the key via the handler's CanonicalKey.
	// For now, capture via a cache miss → linked user → upstream → cache fill,
	// but that defeats this test. Instead, compute using the exported helper.
	key := services.CanonicalKey(services.DefaultOpeningQuery("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"))
	cache.store[key] = cachedBody

	rec := doRequest(t, h, "user-1", "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1")

	assert.Equal(t, http.StatusOK, rec.Code)
	assert.JSONEq(t, string(cachedBody), rec.Body.String())
	assert.Equal(t, 0, fetcher.calls, "upstream must not be called on cache hit")
	assert.Equal(t, 0, userLookups, "user lookup must be skipped on cache hit (no token needed)")
}

var _ = models.User{}

func ptr(s string) *string { return &s }

func TestTrainingExplorerHandler_CacheMissLinkedUserFetchesUpstreamAndCaches(t *testing.T) {
	cache := newStubCache()
	fetcher := &stubFetcher{
		returnStats: &services.OpeningStats{
			White: 7, Draws: 3, Black: 1,
			Moves: []services.OpeningMove{{UCI: "e2e4", SAN: "e4", White: 5, Draws: 2, Black: 1, AverageRating: 1850}},
		},
	}
	user := &models.User{ID: "user-1", LichessAccessToken: ptr("user-token-abc")}
	userRepo := &mocks.MockUserRepo{
		GetByIDFunc: func(id string) (*models.User, error) { return user, nil },
	}
	h := newTrainingExplorerHandler(t, fetcher, cache, userRepo)

	rec := doRequest(t, h, "user-1", "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1")

	assert.Equal(t, http.StatusOK, rec.Code)
	assert.Equal(t, 1, fetcher.calls, "upstream must be called exactly once on cache miss")
	assert.Equal(t, "user-token-abc", fetcher.lastToken, "must forward the user's Lichess token")
	assert.Equal(t, 1, cache.putCalls, "successful upstream fetch must populate the cache")
}

func TestTrainingExplorerHandler_CacheMissUnlinkedUserReturns403(t *testing.T) {
	cache := newStubCache()
	fetcher := &stubFetcher{}
	user := &models.User{ID: "user-1", LichessAccessToken: nil}
	userRepo := &mocks.MockUserRepo{
		GetByIDFunc: func(id string) (*models.User, error) { return user, nil },
	}
	h := newTrainingExplorerHandler(t, fetcher, cache, userRepo)

	rec := doRequest(t, h, "user-1", "anyfen")

	assert.Equal(t, http.StatusForbidden, rec.Code)
	assert.Contains(t, rec.Body.String(), `"code":"lichess_not_linked"`)
	assert.Equal(t, 0, fetcher.calls, "upstream must not be called for unlinked users on cache miss")
	assert.Equal(t, 0, cache.putCalls)
}

func TestTrainingExplorerHandler_CacheHitServesUnlinkedUser(t *testing.T) {
	cache := newStubCache()
	cachedBody := []byte(`{"white":1,"draws":0,"black":0,"moves":[]}`)
	fetcher := &stubFetcher{}
	userRepo := &mocks.MockUserRepo{
		GetByIDFunc: func(id string) (*models.User, error) {
			t.Fatalf("user repo must not be consulted when cache hits")
			return nil, nil
		},
	}
	h := newTrainingExplorerHandler(t, fetcher, cache, userRepo)
	cache.store[services.CanonicalKey(services.DefaultOpeningQuery("f1"))] = cachedBody

	rec := doRequest(t, h, "user-1", "f1")

	assert.Equal(t, http.StatusOK, rec.Code)
	assert.JSONEq(t, string(cachedBody), rec.Body.String())
	assert.Equal(t, 0, fetcher.calls)
}

func TestTrainingExplorerHandler_MissingFenReturns400(t *testing.T) {
	h := newTrainingExplorerHandler(t, &stubFetcher{}, newStubCache(), &mocks.MockUserRepo{})

	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/api/training/opening", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.Set("userID", "user-1")
	require.NoError(t, h.GetOpening(c))

	assert.Equal(t, http.StatusBadRequest, rec.Code)
	assert.Contains(t, rec.Body.String(), `"code":"invalid_fen"`)
}

func TestTrainingExplorerHandler_UpstreamRateLimited_PropagatesRetryAfter(t *testing.T) {
	cache := newStubCache()
	fetcher := &stubFetcher{returnErr: &services.RateLimitedError{RetryAfterSeconds: 17}}
	user := &models.User{ID: "user-1", LichessAccessToken: ptr("tok")}
	userRepo := &mocks.MockUserRepo{
		GetByIDFunc: func(id string) (*models.User, error) { return user, nil },
	}
	h := newTrainingExplorerHandler(t, fetcher, cache, userRepo)

	rec := doRequest(t, h, "user-1", "f")

	assert.Equal(t, http.StatusTooManyRequests, rec.Code)
	assert.Contains(t, rec.Body.String(), `"code":"rate_limited"`)
	assert.Contains(t, rec.Body.String(), `"retryAfterSeconds":17`)
	assert.Equal(t, 0, cache.putCalls, "rate-limit responses must not be cached")
}

func TestTrainingExplorerHandler_UpstreamUnavailable_Returns502(t *testing.T) {
	cache := newStubCache()
	fetcher := &stubFetcher{returnErr: services.ErrExplorerUnavailable}
	user := &models.User{ID: "user-1", LichessAccessToken: ptr("tok")}
	userRepo := &mocks.MockUserRepo{
		GetByIDFunc: func(id string) (*models.User, error) { return user, nil },
	}
	h := newTrainingExplorerHandler(t, fetcher, cache, userRepo)

	rec := doRequest(t, h, "user-1", "f")

	assert.Equal(t, http.StatusBadGateway, rec.Code)
	assert.Contains(t, rec.Body.String(), `"code":"upstream_unavailable"`)
}

func TestTrainingExplorerHandler_UpstreamUnauthorized_Returns403LichessTokenInvalid(t *testing.T) {
	cache := newStubCache()
	fetcher := &stubFetcher{returnErr: services.ErrExplorerUnauthorized}
	user := &models.User{ID: "user-1", LichessAccessToken: ptr("stale-tok")}
	userRepo := &mocks.MockUserRepo{
		GetByIDFunc: func(id string) (*models.User, error) { return user, nil },
	}
	h := newTrainingExplorerHandler(t, fetcher, cache, userRepo)

	rec := doRequest(t, h, "user-1", "f")

	assert.Equal(t, http.StatusForbidden, rec.Code)
	assert.Contains(t, rec.Body.String(), `"code":"lichess_token_invalid"`)
}
