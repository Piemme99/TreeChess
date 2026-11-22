package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/kumquat/backend/config"
	"github.com/kumquat/backend/internal/repository"
	"github.com/labstack/echo/v5"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// testConfig returns a minimal Config sufficient to construct the dependency
// graph without touching any external system (no DB connection).
func testConfig() config.Config {
	return config.Config{
		Environment:             "development",
		Port:                    8080,
		AllowedOrigins:          []string{"http://localhost:5173"},
		JWTSecret:               "test-secret",
		JWTExpiry:               15 * time.Minute,
		MetricsPort:             9090,
		LichessExplorerBaseURL:  "https://explorer.lichess.test",
		LichessExplorerCacheTTL: time.Hour,
	}
}

// newTestDB returns a DB whose pool is nil. buildServices only stores the pool
// in repositories at construction time and never dials it, so this is safe for
// the wiring smoke test.
func newTestDB() *repository.DB {
	return &repository.DB{}
}

// TestBuildServices_ConstructsAllHandlers asserts every handler the HTTP layer
// depends on is non-nil, so a future refactor that drops one is caught here
// rather than at server start-up.
func TestBuildServices_ConstructsAllHandlers(t *testing.T) {
	svc := buildServices(testConfig(), newTestDB())

	require.NotNil(t, svc)
	assert.NotNil(t, svc.cleanupSvc, "cleanup service")
	assert.NotNil(t, svc.authSvc, "auth service")
	assert.NotNil(t, svc.authHandler, "auth handler")
	assert.NotNil(t, svc.oauthHandler, "oauth handler")
	assert.NotNil(t, svc.explorerProxyHandler, "explorer proxy handler")
	assert.NotNil(t, svc.playedGames, "played games handler")
	assert.NotNil(t, svc.playerState, "player state repo")
}

// TestRateLimiter_ReturnsConfiguredMessage verifies the shared rate-limiter
// helper denies requests past the burst with HTTP 429 and the supplied message,
// replacing the three previously-duplicated inline blocks.
func TestRateLimiter_ReturnsConfiguredMessage(t *testing.T) {
	e := echo.New()
	// Rate 0 with burst 1: the first request passes, the next is denied.
	e.Use(rateLimiter(0, 1, "custom limit message"))
	e.GET("/ping", func(c *echo.Context) error {
		return c.String(http.StatusOK, "pong")
	})

	// First request consumes the single burst token.
	first := httptest.NewRecorder()
	e.ServeHTTP(first, httptest.NewRequest(http.MethodGet, "/ping", nil))
	require.Equal(t, http.StatusOK, first.Code)

	// Second request is over the limit.
	second := httptest.NewRecorder()
	e.ServeHTTP(second, httptest.NewRequest(http.MethodGet, "/ping", nil))
	require.Equal(t, http.StatusTooManyRequests, second.Code)

	var body map[string]string
	require.NoError(t, json.Unmarshal(second.Body.Bytes(), &body))
	assert.Equal(t, "custom limit message", body["error"])
}

// TestNewServer_RegistersRoutes checks that the composed server actually mounts
// routes: the public health endpoint responds, and a protected endpoint is
// registered (rejecting unauthenticated access rather than returning 404).
func TestNewServer_RegistersRoutes(t *testing.T) {
	svc := buildServices(testConfig(), newTestDB())
	e := newServer(testConfig(), newTestDB(), svc)

	// Public health route is registered. The handler queries the pool, which is
	// nil here, so we only assert the route exists (not a 404) — recover()
	// middleware turns the nil-pool panic into a 500, proving the route matched.
	health := httptest.NewRecorder()
	e.ServeHTTP(health, httptest.NewRequest(http.MethodGet, "/api/health", nil))
	assert.NotEqual(t, http.StatusNotFound, health.Code, "health route should be registered")

	// A protected route is registered and guarded by auth middleware: an
	// unauthenticated request must be rejected (401), not 404.
	protected := httptest.NewRecorder()
	e.ServeHTTP(protected, httptest.NewRequest(http.MethodGet, "/api/v2/games", nil))
	assert.Equal(t, http.StatusUnauthorized, protected.Code,
		"protected route should be registered and require auth")

	// Depuis echo v5.3, un groupe à middlewares enregistre par défaut un 404 attrape-tout qui passe par ses
	// middlewares : une route inconnue répondrait 401 et mangerait le quota d'import du joueur.
	unknown := httptest.NewRecorder()
	e.ServeHTTP(unknown, httptest.NewRequest(http.MethodGet, "/api/unknown", nil))
	assert.Equal(t, http.StatusNotFound, unknown.Code, "an unknown route should not run group middlewares")

	// On ne se connecte que par Lichess : l'inscription par e-mail permettait de savoir si une adresse
	// avait un compte (#240). Un seul serveur par test : echoprometheus enregistre ses métriques globalement.
	for _, route := range []struct{ method, path string }{
		{http.MethodPost, "/api/auth/register"},
		{http.MethodPost, "/api/auth/login"},
		{http.MethodPost, "/api/auth/forgot-password"},
		{http.MethodPost, "/api/auth/reset-password"},
		{http.MethodPut, "/api/auth/profile"},
		{http.MethodPost, "/api/auth/change-password"},
		{http.MethodGet, "/api/auth/has-password"},
	} {
		rec := httptest.NewRecorder()
		e.ServeHTTP(rec, httptest.NewRequest(route.method, route.path, nil))
		assert.Equal(t, http.StatusNotFound, rec.Code, "%s %s", route.method, route.path)
	}
}

// TestProxyAwareIPExtractor_IgnoresSpoofedXFF guards the rate-limiter identity
// against X-Forwarded-For spoofing. In the documented deployment, nginx appends
// the real client IP to any client-supplied X-Forwarded-For ($proxy_add_x_forwarded_for)
// and connects to the backend from a private Docker address. The extractor must
// trust only that proxy hop and return the real client IP, never the attacker's
// left-most forged entry — otherwise a client could rotate the header to evade
// the per-IP rate limit and brute-force the auth endpoints.
func TestProxyAwareIPExtractor_IgnoresSpoofedXFF(t *testing.T) {
	extract := proxyAwareIPExtractor()

	t.Run("returns real client and ignores spoofed left-most XFF", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/", nil)
		// nginx (private Docker IP) is the trusted peer it connects from.
		req.RemoteAddr = "172.18.0.5:54321"
		// Attacker forged "1.2.3.4"; nginx appended the real client "203.0.113.7".
		req.Header.Set("X-Forwarded-For", "1.2.3.4, 203.0.113.7")

		got := extract(req)
		assert.Equal(t, "203.0.113.7", got, "must use the proxy-recorded client IP")
		assert.NotEqual(t, "1.2.3.4", got, "must never trust the client-supplied left-most XFF entry")
	})

	t.Run("falls back to remote address when no XFF is present", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/", nil)
		req.RemoteAddr = "203.0.113.7:443"
		assert.Equal(t, "203.0.113.7", extract(req))
	})
}
