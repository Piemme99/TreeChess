package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"

	"log/slog"

	"github.com/labstack/echo/v5"

	"github.com/kumquat/backend/internal/crypto"
	"github.com/kumquat/backend/internal/repository"
	"github.com/kumquat/backend/internal/services"
)

const (
	oauthCookieName   = "oauth_state"
	oauthCookieMaxAge = 600 // 10 minutes

	// oauthCookieKeyInfo is the HKDF info label used to derive the OAuth state
	// cookie encryption key (kept distinct from other use-sites for key separation).
	oauthCookieKeyInfo = "oauth-cookie-encryption"
)

type OAuthHandler struct {
	oauthService  *services.OAuthService
	userRepo      repository.UserRepository
	frontendURL   string
	encryptKey    []byte // 32 bytes for AES-256
	secureCookies bool
}

func NewOAuthHandler(oauthSvc *services.OAuthService, userRepo repository.UserRepository, frontendURL, jwtSecret string, secureCookies bool) *OAuthHandler {
	// Derive a 32-byte key from the JWT secret using HKDF (RFC 5869).
	// This ensures proper key separation between JWT signing and cookie encryption.
	key, err := crypto.DeriveKey(jwtSecret, oauthCookieKeyInfo)
	if err != nil {
		panic("failed to derive OAuth cookie encryption key: " + err.Error())
	}
	return &OAuthHandler{
		oauthService:  oauthSvc,
		userRepo:      userRepo,
		frontendURL:   frontendURL,
		encryptKey:    key,
		secureCookies: secureCookies,
	}
}

type oauthCookieData struct {
	State        string `json:"s"`
	CodeVerifier string `json:"v"`
}

func (h *OAuthHandler) LoginRedirect(c *echo.Context) error {
	authURL, state, codeVerifier, err := h.oauthService.GenerateAuthURL()
	if err != nil {
		return InternalErrorResponse(c, "failed to generate OAuth URL")
	}

	cookieData := oauthCookieData{State: state, CodeVerifier: codeVerifier}
	encrypted, err := h.encryptCookie(cookieData)
	if err != nil {
		return InternalErrorResponse(c, "failed to prepare OAuth state")
	}

	c.SetCookie(&http.Cookie{
		Name:     oauthCookieName,
		Value:    encrypted,
		Path:     "/api/auth/lichess",
		MaxAge:   oauthCookieMaxAge,
		HttpOnly: true,
		Secure:   h.secureCookies,
		SameSite: http.SameSiteLaxMode,
	})

	return c.Redirect(http.StatusTemporaryRedirect, authURL)
}

func (h *OAuthHandler) Callback(c *echo.Context) error {
	code := c.QueryParam("code")
	state := c.QueryParam("state")

	if code == "" || state == "" {
		return h.redirectWithError(c, "missing OAuth parameters")
	}

	cookie, err := c.Cookie(oauthCookieName)
	if err != nil {
		return h.redirectWithError(c, "OAuth session expired")
	}

	cookieData, err := h.decryptCookie(cookie.Value)
	if err != nil {
		return h.redirectWithError(c, "invalid OAuth session")
	}

	if state != cookieData.State {
		return h.redirectWithError(c, "OAuth state mismatch")
	}

	// Clear the cookie
	c.SetCookie(&http.Cookie{
		Name:     oauthCookieName,
		Value:    "",
		Path:     "/api/auth/lichess",
		MaxAge:   -1,
		HttpOnly: true,
		Secure:   h.secureCookies,
	})

	username, lichessID, accessToken, err := h.oauthService.HandleCallback(c.Request().Context(), code, cookieData.CodeVerifier)
	if err != nil {
		return h.redirectWithError(c, "failed to authenticate with Lichess")
	}

	resp, isNew, err := h.oauthService.FindOrCreateUser(c.Request().Context(), "lichess", lichessID, username)
	if err != nil {
		return h.redirectWithError(c, "failed to create account")
	}

	// Store the Lichess access token for API access (e.g. private studies)
	if accessToken != "" {
		if err := h.userRepo.UpdateLichessToken(c.Request().Context(), resp.User.ID, accessToken); err != nil {
			slog.Error("failed to store lichess token", "user_id", resp.User.ID, "error", err)
		}
	}

	// Set refresh token as httpOnly cookie (if available)
	if resp.RefreshToken != "" {
		c.SetCookie(&http.Cookie{
			Name:     "refresh_token",
			Value:    resp.RefreshToken,
			Path:     "/api/auth",
			MaxAge:   30 * 24 * 60 * 60, // 30 days
			HttpOnly: true,
			Secure:   h.secureCookies,
			SameSite: http.SameSiteStrictMode,
		})
	}

	// Do NOT put the access token in the redirect URL: that leaks the JWT
	// into browser history, proxy logs, and the Referer header (issue #124).
	// The refresh token cookie set above lets the frontend obtain an access
	// token via /api/auth/refresh on the OAuth return.
	redirectURL := h.frontendURL + "/login"
	if isNew {
		redirectURL += "?new=1"
	}
	return c.Redirect(http.StatusTemporaryRedirect, redirectURL)
}

func (h *OAuthHandler) redirectWithError(c *echo.Context, msg string) error {
	redirectURL := fmt.Sprintf("%s/login?error=%s", h.frontendURL, url.QueryEscape(msg))
	return c.Redirect(http.StatusTemporaryRedirect, redirectURL)
}

func (h *OAuthHandler) encryptCookie(data oauthCookieData) (string, error) {
	plaintext, err := json.Marshal(data)
	if err != nil {
		return "", err
	}
	return crypto.Encrypt(h.encryptKey, plaintext)
}

func (h *OAuthHandler) decryptCookie(encrypted string) (*oauthCookieData, error) {
	plaintext, err := crypto.Decrypt(h.encryptKey, encrypted)
	if err != nil {
		return nil, err
	}

	var data oauthCookieData
	if err := json.Unmarshal(plaintext, &data); err != nil {
		return nil, err
	}

	return &data, nil
}
