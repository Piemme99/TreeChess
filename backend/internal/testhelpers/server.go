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

	e := echo.NewWithConfig(echo.Config{NoGroupAutoRegister404Routes: true})

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

	protected.GET("/api/v2/state", handlers.GetPlayerStateHandler(repos.PlayerState))
	protected.PUT("/api/v2/state/:key", handlers.PutPlayerStateHandler(repos.PlayerState))

	return &TestServer{
		Echo:         e,
		AuthSvc:      authSvc,
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
