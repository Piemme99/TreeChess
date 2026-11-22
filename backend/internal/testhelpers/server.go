//go:build integration

package testhelpers

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/labstack/echo/v5"

	"github.com/kumquat/backend/internal/handlers"
	appMiddleware "github.com/kumquat/backend/internal/middleware"
	"github.com/kumquat/backend/internal/models"
	"github.com/kumquat/backend/internal/services"
)

const testJWTSecret = "integration-test-secret-key-32chars!"

// RefreshCookieName is the name of the httpOnly cookie carrying the refresh token.
const RefreshCookieName = "refresh_token"

// TestServer holds an Echo instance with all routes wired to real services.
type TestServer struct {
	Echo    *echo.Echo
	AuthSvc *services.AuthService
}

// Session is what a browser holds after signing in: the access token and the
// refresh cookie.
type Session struct {
	Token         string
	RefreshCookie *http.Cookie
}

// SetupTestServer creates a full Echo server with real services and routes.
func SetupTestServer(t *testing.T, repos *Repos) *TestServer {
	t.Helper()

	authSvc := services.NewAuthService(repos.User, testJWTSecret, 168*time.Hour)
	authSvc.WithRefreshTokens(repos.RefreshToken)

	e := echo.NewWithConfig(echo.Config{NoGroupAutoRegister404Routes: true})

	authHandler := handlers.NewAuthHandler(authSvc, false)
	oauthSvc := services.NewOAuthService(repos.User, authSvc, "test-client-id", "http://localhost:8080/api/auth/lichess/callback")
	oauthHandler := handlers.NewOAuthHandler(oauthSvc, authSvc, repos.User, "http://localhost:5173", testJWTSecret, false)

	e.POST("/api/auth/refresh", authHandler.RefreshHandler)
	e.POST("/api/auth/logout", authHandler.LogoutHandler)

	protected := e.Group("", appMiddleware.JWTAuth(authSvc))
	protected.GET("/api/auth/me", authHandler.MeHandler)
	protected.POST("/api/auth/account/deletion", oauthHandler.StartAccountDeletion)
	protected.GET("/api/v2/state", handlers.GetPlayerStateHandler(repos.PlayerState))
	protected.PUT("/api/v2/state/:key", handlers.PutPlayerStateHandler(repos.PlayerState))

	return &TestServer{
		Echo:    e,
		AuthSvc: authSvc,
	}
}

// SignIn opens a session for an existing user without going through Lichess:
// it issues a refresh token as the OAuth callback does, then trades it on
// /api/auth/refresh for an access token, as the frontend does at start-up.
func (ts *TestServer) SignIn(t *testing.T, userID string) Session {
	t.Helper()
	rawRefresh, err := ts.AuthSvc.CreateRefreshTokenForUser(context.Background(), userID)
	if err != nil {
		t.Fatalf("SignIn: %v", err)
	}

	req := AuthRequest(http.MethodPost, "/api/auth/refresh", nil, "")
	req.AddCookie(&http.Cookie{Name: RefreshCookieName, Value: rawRefresh, Path: "/api/auth"})
	rec := ts.DoRequest(req)
	if rec.Code != http.StatusOK {
		t.Fatalf("SignIn: refresh answered %d: %s", rec.Code, rec.Body.String())
	}

	var resp models.AuthResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("SignIn: %v", err)
	}
	cookie := RefreshCookie(rec)
	if cookie == nil {
		t.Fatal("SignIn: refresh did not set a refresh cookie")
	}
	return Session{Token: resp.Token, RefreshCookie: cookie}
}

// RefreshCookie returns the refresh cookie set by a response, or nil.
func RefreshCookie(rec *httptest.ResponseRecorder) *http.Cookie {
	for _, c := range rec.Result().Cookies() {
		if c.Name == RefreshCookieName {
			return c
		}
	}
	return nil
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
