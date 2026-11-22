package handlers

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"

	"log/slog"

	"github.com/labstack/echo/v5"

	"github.com/kumquat/backend/internal/crypto"
	"github.com/kumquat/backend/internal/models"
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
	authService   *services.AuthService
	userRepo      repository.UserRepository
	frontendURL   string
	encryptKey    []byte // 32 bytes for AES-256
	secureCookies bool
}

func NewOAuthHandler(oauthSvc *services.OAuthService, authSvc *services.AuthService, userRepo repository.UserRepository, frontendURL, jwtSecret string, secureCookies bool) *OAuthHandler {
	// Derive a 32-byte key from the JWT secret using HKDF (RFC 5869).
	// This ensures proper key separation between JWT signing and cookie encryption.
	key, err := crypto.DeriveKey(jwtSecret, oauthCookieKeyInfo)
	if err != nil {
		panic("failed to derive OAuth cookie encryption key: " + err.Error())
	}
	return &OAuthHandler{
		oauthService:  oauthSvc,
		authService:   authSvc,
		userRepo:      userRepo,
		frontendURL:   frontendURL,
		encryptKey:    key,
		secureCookies: secureCookies,
	}
}

type oauthCookieData struct {
	State        string `json:"s"`
	CodeVerifier string `json:"v"`
	Next         string `json:"n,omitempty"`
	// DeleteUserID : ce retour de Lichess confirme la suppression de ce compte, au lieu de connecter.
	DeleteUserID string `json:"d,omitempty"`
}

const maxOAuthNextLength = 512

// oauthNext garde seulement un chemin local : préfixé par frontendURL, il ne peut pas renvoyer vers un autre site.
func oauthNext(raw string) string {
	if len(raw) > maxOAuthNextLength || !strings.HasPrefix(raw, "/") || strings.HasPrefix(raw, "//") || strings.Contains(raw, "\\") {
		return ""
	}
	parsed, err := url.Parse(raw)
	if err != nil || parsed.Scheme != "" || parsed.Host != "" {
		return ""
	}
	return raw
}

func (h *OAuthHandler) LoginRedirect(c *echo.Context) error {
	authURL, err := h.startLichess(c, oauthCookieData{Next: oauthNext(c.QueryParam("next"))})
	if err != nil {
		return InternalErrorResponse(c, err.Error())
	}
	return c.Redirect(http.StatusTemporaryRedirect, authURL)
}

// StartAccountDeletion : un compte Lichess se supprime au retour de Lichess (le JSON donne l'adresse où aller),
// un compte sans Lichess sur preuve du cookie de rafraîchissement.
func (h *OAuthHandler) StartAccountDeletion(c *echo.Context) error {
	userID, ok := mustUserID(c)
	if !ok {
		return nil
	}

	var req models.DeleteAccountRequest
	if err := c.Bind(&req); err != nil {
		return BadRequestResponse(c, "invalid request body")
	}

	user, err := h.authService.CheckDeletionUsername(c.Request().Context(), userID, req.Username)
	if err != nil {
		if errors.Is(err, services.ErrUsernameMismatch) {
			return BadRequestResponse(c, "incorrect username confirmation")
		}
		if errors.Is(err, repository.ErrUserNotFound) {
			return ErrorResponse(c, http.StatusUnauthorized, "user not found")
		}
		return InternalErrorResponse(c, "failed to delete account")
	}

	if services.IsLichessAccount(user) {
		authURL, err := h.startLichess(c, oauthCookieData{DeleteUserID: user.ID})
		if err != nil {
			return InternalErrorResponse(c, err.Error())
		}
		return c.JSON(http.StatusOK, map[string]string{"redirect": authURL})
	}

	refresh := ""
	if cookie, err := c.Cookie(refreshTokenCookieName); err == nil {
		refresh = cookie.Value
	}
	if err := h.authService.DeleteLegacyAccount(c.Request().Context(), userID, refresh); err != nil {
		if errors.Is(err, services.ErrDeletionNotConfirmed) {
			return ErrorResponse(c, http.StatusForbidden, "sign in again to delete your account")
		}
		return InternalErrorResponse(c, "failed to delete account")
	}
	clearRefreshTokenCookie(c, h.secureCookies)
	return c.NoContent(http.StatusNoContent)
}

// startLichess prépare l'aller-retour vers Lichess : son état voyage dans un cookie chiffré.
func (h *OAuthHandler) startLichess(c *echo.Context, cookieData oauthCookieData) (string, error) {
	authURL, state, codeVerifier, err := h.oauthService.GenerateAuthURL()
	if err != nil {
		return "", errors.New("failed to generate OAuth URL")
	}

	cookieData.State = state
	cookieData.CodeVerifier = codeVerifier
	encrypted, err := h.encryptCookie(cookieData)
	if err != nil {
		return "", errors.New("failed to prepare OAuth state")
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
	return authURL, nil
}

func (h *OAuthHandler) Callback(c *echo.Context) error {
	code := c.QueryParam("code")
	state := c.QueryParam("state")

	cookie, err := c.Cookie(oauthCookieName)
	if err != nil {
		return h.redirectWithError(c, "OAuth session expired")
	}

	cookieData, err := h.decryptCookie(cookie.Value)
	if err != nil {
		return h.redirectWithError(c, "invalid OAuth session")
	}

	// Une suppression refusée sur Lichess, ou qui échoue, revient au menu qui dit que rien n'a été supprimé.
	fail := h.redirectWithError
	if cookieData.DeleteUserID != "" {
		fail = func(c *echo.Context, _ string) error { return h.redirectDeletionFailed(c) }
	}

	if code == "" || state == "" {
		return fail(c, "missing OAuth parameters")
	}

	if state != cookieData.State {
		return fail(c, "OAuth state mismatch")
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
		return fail(c, "failed to authenticate with Lichess")
	}

	if cookieData.DeleteUserID != "" {
		return h.finishAccountDeletion(c, cookieData.DeleteUserID, lichessID)
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
	if cookieData.Next != "" {
		return c.Redirect(http.StatusTemporaryRedirect, h.frontendURL+cookieData.Next)
	}
	redirectURL := h.frontendURL + "/login"
	if isNew {
		redirectURL += "?new=1"
	}
	return c.Redirect(http.StatusTemporaryRedirect, redirectURL)
}

// finishAccountDeletion : Lichess vient d'authentifier lichessID ; le compte n'est supprimé que s'il lui est lié.
func (h *OAuthHandler) finishAccountDeletion(c *echo.Context, userID, lichessID string) error {
	if err := h.authService.DeleteAccountConfirmedByLichess(c.Request().Context(), userID, lichessID); err != nil {
		if !errors.Is(err, services.ErrDeletionNotConfirmed) {
			slog.Error("failed to delete account", "user_id", userID, "error", err)
		}
		return h.redirectDeletionFailed(c)
	}
	clearRefreshTokenCookie(c, h.secureCookies)
	return c.Redirect(http.StatusTemporaryRedirect, h.frontendURL+"/v2/home?deleted=1")
}

func (h *OAuthHandler) redirectDeletionFailed(c *echo.Context) error {
	return c.Redirect(http.StatusTemporaryRedirect, h.frontendURL+"/v2/home?deletion=failed")
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
