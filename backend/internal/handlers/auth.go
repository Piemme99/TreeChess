package handlers

import (
	"errors"
	"net/http"

	"github.com/labstack/echo/v5"

	"github.com/kumquat/backend/internal/models"
	"github.com/kumquat/backend/internal/repository"
	"github.com/kumquat/backend/internal/services"
)

const (
	refreshTokenCookieName = "refresh_token"
	refreshTokenCookiePath = "/api/auth"
	refreshTokenMaxAge     = 30 * 24 * 60 * 60 // 30 days in seconds
)

type AuthHandler struct {
	authService   *services.AuthService
	secureCookies bool
}

func NewAuthHandler(authSvc *services.AuthService, secureCookies bool) *AuthHandler {
	return &AuthHandler{authService: authSvc, secureCookies: secureCookies}
}

// setRefreshTokenCookie sets the refresh token as an httpOnly cookie
func (h *AuthHandler) setRefreshTokenCookie(c *echo.Context, rawToken string) {
	c.SetCookie(&http.Cookie{
		Name:     refreshTokenCookieName,
		Value:    rawToken,
		Path:     refreshTokenCookiePath,
		MaxAge:   refreshTokenMaxAge,
		HttpOnly: true,
		Secure:   h.secureCookies,
		SameSite: http.SameSiteStrictMode,
	})
}

// clearRefreshTokenCookie removes the refresh token cookie
func (h *AuthHandler) clearRefreshTokenCookie(c *echo.Context) {
	c.SetCookie(&http.Cookie{
		Name:     refreshTokenCookieName,
		Value:    "",
		Path:     refreshTokenCookiePath,
		MaxAge:   -1,
		HttpOnly: true,
		Secure:   h.secureCookies,
		SameSite: http.SameSiteStrictMode,
	})
}

func (h *AuthHandler) MeHandler(c *echo.Context) error {
	userID, ok := mustUserID(c)
	if !ok {
		return nil
	}

	user, err := h.authService.GetUserByID(c.Request().Context(), userID)
	if err != nil {
		if errors.Is(err, repository.ErrUserNotFound) {
			return ErrorResponse(c, http.StatusUnauthorized, "user not found")
		}
		return InternalErrorResponse(c, "failed to get user")
	}

	return c.JSON(http.StatusOK, user)
}

func (h *AuthHandler) DeleteAccountHandler(c *echo.Context) error {
	userID, ok := mustUserID(c)
	if !ok {
		return nil
	}

	var req models.DeleteAccountRequest
	if err := c.Bind(&req); err != nil {
		return BadRequestResponse(c, "invalid request body")
	}

	err := h.authService.DeleteAccount(c.Request().Context(), userID, req.Username)
	if err != nil {
		if errors.Is(err, services.ErrUsernameMismatch) {
			return BadRequestResponse(c, "incorrect username confirmation")
		}
		if errors.Is(err, repository.ErrUserNotFound) {
			return ErrorResponse(c, http.StatusUnauthorized, "user not found")
		}
		return InternalErrorResponse(c, "failed to delete account")
	}

	return c.NoContent(http.StatusNoContent)
}

// RefreshHandler exchanges a valid refresh token for a new access token + refresh token pair.
// The refresh token is read from the httpOnly cookie.
func (h *AuthHandler) RefreshHandler(c *echo.Context) error {
	cookie, err := c.Cookie(refreshTokenCookieName)
	if err != nil || cookie.Value == "" {
		return ErrorResponse(c, http.StatusUnauthorized, "no refresh token")
	}

	resp, err := h.authService.RefreshTokens(c.Request().Context(), cookie.Value)
	if err != nil {
		h.clearRefreshTokenCookie(c)
		return ErrorResponse(c, http.StatusUnauthorized, "invalid refresh token")
	}

	// Set new refresh token cookie
	if resp.RefreshToken != "" {
		h.setRefreshTokenCookie(c, resp.RefreshToken)
		resp.RefreshToken = "" // Don't send in JSON body
	}

	return c.JSON(http.StatusOK, resp)
}

// LogoutHandler revokes the refresh token and clears the cookie.
func (h *AuthHandler) LogoutHandler(c *echo.Context) error {
	cookie, err := c.Cookie(refreshTokenCookieName)
	if err == nil && cookie.Value != "" {
		_ = h.authService.RevokeRefreshToken(c.Request().Context(), cookie.Value)
	}

	h.clearRefreshTokenCookie(c)
	return c.JSON(http.StatusOK, map[string]string{"message": "logged out"})
}
