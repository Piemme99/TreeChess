//go:build integration

package testhelpers

import (
	"bytes"
	"context"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"

	"github.com/labstack/echo/v5"

	"github.com/kumquat/backend/internal/handlers"
	appMiddleware "github.com/kumquat/backend/internal/middleware"
	"github.com/kumquat/backend/internal/services"
)

const testJWTSecret = "integration-test-secret-key-32chars!"

// CapturingEmailService implements services.EmailSender and records sent emails
// so that integration tests can inspect reset tokens without a real SMTP server.
type CapturingEmailService struct {
	mu     sync.Mutex
	Emails []CapturedEmail
}

// CapturedEmail represents an email captured during testing.
type CapturedEmail struct {
	ToEmail string
	Token   string
}

func (m *CapturingEmailService) SendPasswordResetEmail(toEmail, token string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.Emails = append(m.Emails, CapturedEmail{ToEmail: toEmail, Token: token})
	return nil
}

func (m *CapturingEmailService) Enabled() bool {
	return true
}

// LastToken returns the most recently captured reset token, or "" if none.
func (m *CapturingEmailService) LastToken() string {
	m.mu.Lock()
	defer m.mu.Unlock()
	if len(m.Emails) == 0 {
		return ""
	}
	return m.Emails[len(m.Emails)-1].Token
}

// TestServer holds an Echo instance with all routes wired to real services.
type TestServer struct {
	Echo         *echo.Echo
	AuthSvc      *services.AuthService
	RepSvc       *services.RepertoireService
	ImportSvc    *services.ImportService
	CategorySvc  *services.CategoryService
	EmailCapture *CapturingEmailService
}

// SetupTestServer creates a full Echo server with real services and routes.
func SetupTestServer(t *testing.T, repos *Repos) *TestServer {
	t.Helper()

	// Email capture for password reset tests
	emailCapture := &CapturingEmailService{}

	// Auth service with refresh tokens and password reset wired up
	authSvc := services.NewAuthService(repos.User, testJWTSecret, 168*time.Hour)
	authSvc.WithRefreshTokens(repos.RefreshToken)
	authSvc.WithPasswordReset(repos.PasswordReset, emailCapture, 1)

	repertoireSvc := services.NewRepertoireService(repos.Repertoire)
	engineSvc := services.NewEngineService(repos.EngineEval, repos.Analysis, repos.OpeningExplorerCache)
	importSvc := services.NewImportService(repertoireSvc, repos.Analysis,
		services.WithFingerprintRepo(repos.Fingerprint),
		services.WithEngineService(engineSvc),
	)
	categorySvc := services.NewCategoryService(repos.Category, repos.Repertoire)

	e := echo.New()

	authHandler := handlers.NewAuthHandler(authSvc, false)

	// Public auth routes (no JWT required)
	e.POST("/api/auth/register", authHandler.RegisterHandler)
	e.POST("/api/auth/login", authHandler.LoginHandler)
	e.POST("/api/auth/forgot-password", authHandler.ForgotPasswordHandler)
	e.POST("/api/auth/reset-password", authHandler.ResetPasswordHandler)
	e.POST("/api/auth/refresh", authHandler.RefreshHandler)
	e.POST("/api/auth/logout", authHandler.LogoutHandler)

	// Protected routes (JWT required)
	protected := e.Group("", appMiddleware.JWTAuth(authSvc))

	// Auth - current user
	protected.GET("/api/auth/me", authHandler.MeHandler)
	protected.PUT("/api/auth/profile", authHandler.UpdateProfileHandler)
	protected.POST("/api/auth/change-password", authHandler.ChangePasswordHandler)
	protected.GET("/api/auth/has-password", authHandler.HasPasswordHandler)
	protected.DELETE("/api/auth/account", authHandler.DeleteAccountHandler)

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
	protected.PATCH("/api/repertoires/:id/category", handlers.AssignCategoryHandler(repertoireSvc, categorySvc))

	// Category routes
	protected.GET("/api/categories", handlers.ListCategoriesHandler(categorySvc))
	protected.POST("/api/categories", handlers.CreateCategoryHandler(categorySvc))
	protected.GET("/api/categories/:id", handlers.GetCategoryHandler(categorySvc))
	protected.PATCH("/api/categories/:id", handlers.UpdateCategoryHandler(categorySvc))
	protected.DELETE("/api/categories/:id", handlers.DeleteCategoryHandler(categorySvc))

	// Import routes
	importHandler := handlers.NewImportHandler(importSvc, repertoireSvc, nil, nil)
	protected.POST("/api/imports", importHandler.UploadHandler)
	protected.GET("/api/analyses", importHandler.ListAnalysesHandler)
	protected.GET("/api/analyses/:id", importHandler.GetAnalysisHandler)
	protected.DELETE("/api/analyses/:id", importHandler.DeleteAnalysisHandler)

	// Games routes
	protected.GET("/api/games", importHandler.GetGamesHandler)
	protected.POST("/api/games/:analysisId/:gameIndex/reanalyze", importHandler.ReanalyzeGameHandler)
	protected.POST("/api/games/:analysisId/:gameIndex/view", importHandler.MarkGameViewedHandler)
	protected.GET("/api/games/insights", importHandler.GetInsightsHandler)

	return &TestServer{
		Echo:         e,
		AuthSvc:      authSvc,
		RepSvc:       repertoireSvc,
		ImportSvc:    importSvc,
		CategorySvc:  categorySvc,
		EmailCapture: emailCapture,
	}
}

// AuthToken registers a user via the auth service and returns a JWT token.
func (ts *TestServer) AuthToken(t *testing.T, username, password string) string {
	t.Helper()
	email := username + "@test.com"
	resp, err := ts.AuthSvc.Register(context.Background(), email, username, password)
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
