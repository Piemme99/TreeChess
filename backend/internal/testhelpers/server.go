//go:build integration

package testhelpers

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/labstack/echo/v4"

	"github.com/treechess/backend/internal/handlers"
	appMiddleware "github.com/treechess/backend/internal/middleware"
	"github.com/treechess/backend/internal/services"
)

const testJWTSecret = "integration-test-secret-key-32chars!"

// TestServer holds an Echo instance with all routes wired to real services.
type TestServer struct {
	Echo      *echo.Echo
	AuthSvc   *services.AuthService
	RepSvc    *services.RepertoireService
	ImportSvc *services.ImportService
}

// SetupTestServer creates a full Echo server with real services and routes.
func SetupTestServer(t *testing.T, repos *Repos) *TestServer {
	t.Helper()

	authSvc := services.NewAuthService(repos.User, testJWTSecret, 168*time.Hour)
	repertoireSvc := services.NewRepertoireService(repos.Repertoire)
	engineSvc := services.NewEngineService(repos.EngineEval, repos.Analysis)
	importSvc := services.NewImportService(repertoireSvc, repos.Analysis,
		services.WithFingerprintRepo(repos.Fingerprint),
		services.WithEngineService(engineSvc),
	)

	e := echo.New()
	e.HideBanner = true

	authHandler := handlers.NewAuthHandler(authSvc)

	// Public routes
	e.POST("/api/auth/register", authHandler.RegisterHandler)
	e.POST("/api/auth/login", authHandler.LoginHandler)

	// Protected routes
	protected := e.Group("", appMiddleware.JWTAuth(authSvc))

	protected.GET("/api/auth/me", authHandler.MeHandler)

	// Repertoire routes
	protected.GET("/api/repertoires", handlers.ListRepertoiresHandler(repertoireSvc))
	protected.POST("/api/repertoires", handlers.CreateRepertoireHandler(repertoireSvc))
	protected.GET("/api/repertoires/:id", handlers.GetRepertoireHandler(repertoireSvc))
	protected.PATCH("/api/repertoires/:id", handlers.UpdateRepertoireHandler(repertoireSvc))
	protected.DELETE("/api/repertoires/:id", handlers.DeleteRepertoireHandler(repertoireSvc))
	protected.POST("/api/repertoires/:id/nodes", handlers.AddNodeHandler(repertoireSvc))
	protected.DELETE("/api/repertoires/:id/nodes/:nodeId", handlers.DeleteNodeHandler(repertoireSvc))
	protected.POST("/api/repertoires/merge", handlers.MergeRepertoiresHandler(repertoireSvc))
	protected.POST("/api/repertoires/:id/extract", handlers.ExtractSubtreeHandler(repertoireSvc))
	protected.POST("/api/repertoires/:id/merge-transpositions", handlers.MergeTranspositionsHandler(repertoireSvc))

	// Import routes
	importHandler := handlers.NewImportHandler(importSvc, nil, nil)
	protected.POST("/api/imports", importHandler.UploadHandler)
	protected.GET("/api/analyses", importHandler.ListAnalysesHandler)
	protected.GET("/api/analyses/:id", importHandler.GetAnalysisHandler)
	protected.DELETE("/api/analyses/:id", importHandler.DeleteAnalysisHandler)

	// Games routes
	protected.GET("/api/games", importHandler.GetGamesHandler)
	protected.DELETE("/api/games/:analysisId/:gameIndex", importHandler.DeleteGameHandler)
	protected.POST("/api/games/:analysisId/:gameIndex/reanalyze", importHandler.ReanalyzeGameHandler)
	protected.POST("/api/games/:analysisId/:gameIndex/view", importHandler.MarkGameViewedHandler)
	protected.GET("/api/games/insights", importHandler.GetInsightsHandler)

	return &TestServer{
		Echo:      e,
		AuthSvc:   authSvc,
		RepSvc:    repertoireSvc,
		ImportSvc: importSvc,
	}
}

// AuthToken registers a user via the auth service and returns a JWT token.
func (ts *TestServer) AuthToken(t *testing.T, username, password string) string {
	t.Helper()
	resp, err := ts.AuthSvc.Register(username, password)
	if err != nil {
		t.Fatalf("AuthToken: %v", err)
	}
	return resp.Token
}

// AuthRequest creates an authenticated HTTP request.
func AuthRequest(method, path string, body []byte, token string) *http.Request {
	var req *http.Request
	if body != nil {
		req = httptest.NewRequest(method, path, bytes.NewReader(body))
	} else {
		req = httptest.NewRequest(method, path, nil)
	}
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	return req
}

// DoRequest executes a request against the test server and returns the response recorder.
func (ts *TestServer) DoRequest(req *http.Request) *httptest.ResponseRecorder {
	rec := httptest.NewRecorder()
	ts.Echo.ServeHTTP(rec, req)
	return rec
}
