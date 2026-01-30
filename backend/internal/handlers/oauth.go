package handlers

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"

	"github.com/labstack/echo/v4"

	"github.com/treechess/backend/internal/services"
)

const (
	oauthCookieName = "oauth_state"
	oauthCookieMaxAge = 600 // 10 minutes
)

type OAuthHandler struct {
	oauthService *services.OAuthService
	frontendURL  string
	encryptKey   []byte // 32 bytes for AES-256
}

func NewOAuthHandler(oauthSvc *services.OAuthService, frontendURL, jwtSecret string) *OAuthHandler {
	// Derive a 32-byte key from the JWT secret for cookie encryption
	key := make([]byte, 32)
	copy(key, []byte(jwtSecret))
	return &OAuthHandler{
		oauthService: oauthSvc,
		frontendURL:  frontendURL,
		encryptKey:   key,
	}
}

type oauthCookieData struct {
	State        string `json:"s"`
	CodeVerifier string `json:"v"`
}

func (h *OAuthHandler) LoginRedirect(c echo.Context) error {
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
		SameSite: http.SameSiteLaxMode,
	})

	return c.Redirect(http.StatusTemporaryRedirect, authURL)
}

func (h *OAuthHandler) Callback(c echo.Context) error {
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
	})

	username, lichessID, err := h.oauthService.HandleCallback(c.Request().Context(), code, cookieData.CodeVerifier)
	if err != nil {
		return h.redirectWithError(c, "failed to authenticate with Lichess")
	}

	resp, err := h.oauthService.FindOrCreateUser("lichess", lichessID, username)
	if err != nil {
		return h.redirectWithError(c, "failed to create account")
	}

	redirectURL := fmt.Sprintf("%s/login?token=%s", h.frontendURL, url.QueryEscape(resp.Token))
	return c.Redirect(http.StatusTemporaryRedirect, redirectURL)
}

func (h *OAuthHandler) redirectWithError(c echo.Context, msg string) error {
	redirectURL := fmt.Sprintf("%s/login?error=%s", h.frontendURL, url.QueryEscape(msg))
	return c.Redirect(http.StatusTemporaryRedirect, redirectURL)
}

func (h *OAuthHandler) encryptCookie(data oauthCookieData) (string, error) {
	plaintext, err := json.Marshal(data)
	if err != nil {
		return "", err
	}

	block, err := aes.NewCipher(h.encryptKey)
	if err != nil {
		return "", err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}

	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", err
	}

	ciphertext := gcm.Seal(nonce, nonce, plaintext, nil)
	return base64.URLEncoding.EncodeToString(ciphertext), nil
}

func (h *OAuthHandler) decryptCookie(encrypted string) (*oauthCookieData, error) {
	ciphertext, err := base64.URLEncoding.DecodeString(encrypted)
	if err != nil {
		return nil, err
	}

	block, err := aes.NewCipher(h.encryptKey)
	if err != nil {
		return nil, err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}

	nonceSize := gcm.NonceSize()
	if len(ciphertext) < nonceSize {
		return nil, fmt.Errorf("ciphertext too short")
	}

	nonce, ciphertext := ciphertext[:nonceSize], ciphertext[nonceSize:]
	plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return nil, err
	}

	var data oauthCookieData
	if err := json.Unmarshal(plaintext, &data); err != nil {
		return nil, err
	}

	return &data, nil
}
