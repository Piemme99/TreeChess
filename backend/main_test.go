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
// graph without touching any external system (no DB connection, no SMTP).
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

// TestBuildServices_WiresReanalysisQueue guards the one piece of wiring the issue
// calls out as fragile: the re-analysis queue must be injected back into the
// repertoire service after importSvc is built. A mis-wire would silently disable
// auto-re-analysis, so we assert the queue is actually attached.
func TestBuildServices_WiresReanalysisQueue(t *testing.T) {
	svc := buildServices(testConfig(), newTestDB())

	require.NotNil(t, svc)
	require.NotNil(t, svc.repertoireSvc, "repertoire service must be constructed")
	assert.NotNil(t, svc.repertoireSvc.ReanalysisQueue(),
		"re-analysis queue must be wired into the repertoire service; a nil queue silently disables auto-re-analysis")
}

// TestBuildServices_ConstructsAllHandlers asserts every handler the HTTP layer
// depends on is non-nil, so a future refactor that drops one is caught here
// rather than at server start-up.
func TestBuildServices_ConstructsAllHandlers(t *testing.T) {
	svc := buildServices(testConfig(), newTestDB())

	require.NotNil(t, svc)
	assert.NotNil(t, svc.engineSvc, "engine service")
	assert.NotNil(t, svc.authSvc, "auth service")
	assert.NotNil(t, svc.categorySvc, "category service")
	assert.NotNil(t, svc.authHandler, "auth handler")
	assert.NotNil(t, svc.oauthHandler, "oauth handler")
	assert.NotNil(t, svc.syncHandler, "sync handler")
	assert.NotNil(t, svc.studyImportHandler, "study import handler")
	assert.NotNil(t, svc.trainingHandler, "training handler")
	assert.NotNil(t, svc.trainingExplorerHandler, "training explorer handler")
	assert.NotNil(t, svc.importHandler, "import handler")
	assert.NotNil(t, svc.dashboardHandler, "dashboard handler")
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
	e.ServeHTTP(protected, httptest.NewRequest(http.MethodGet, "/api/repertoires", nil))
	assert.Equal(t, http.StatusUnauthorized, protected.Code,
		"protected route should be registered and require auth")
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
