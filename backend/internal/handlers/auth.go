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

func (h *AuthHandler) RegisterHandler(c *echo.Context) error {
	var req models.RegisterRequest
	if err := c.Bind(&req); err != nil {
		return BadRequestResponse(c, "invalid request body")
	}

	if !RequireField(c, "email", req.Email) {
		return nil
	}
	if !RequireField(c, "username", req.Username) {
		return nil
	}
	if !RequireField(c, "password", req.Password) {
		return nil
	}

	resp, err := h.authService.Register(req.Email, req.Username, req.Password)
	if err != nil {
		if errors.Is(err, services.ErrInvalidEmail) {
			return BadRequestResponse(c, err.Error())
		}
		if errors.Is(err, services.ErrInvalidUsername) {
			return BadRequestResponse(c, err.Error())
		}
		if errors.Is(err, services.ErrPasswordTooShort) {
			return BadRequestResponse(c, err.Error())
		}
		if errors.Is(err, repository.ErrEmailExists) {
			return ConflictResponse(c, "email already taken")
		}
		if errors.Is(err, repository.ErrUsernameExists) {
			return ConflictResponse(c, "username already taken")
		}
		return InternalErrorResponse(c, "failed to register")
	}

	// Set refresh token as httpOnly cookie
	if resp.RefreshToken != "" {
		h.setRefreshTokenCookie(c, resp.RefreshToken)
		resp.RefreshToken = "" // Don't send in JSON body
	}

	return c.JSON(http.StatusCreated, resp)
}

func (h *AuthHandler) LoginHandler(c *echo.Context) error {
	var req models.LoginRequest
	if err := c.Bind(&req); err != nil {
		return BadRequestResponse(c, "invalid request body")
	}

	if !RequireField(c, "email", req.Email) {
		return nil
	}
	if !RequireField(c, "password", req.Password) {
		return nil
	}

	resp, err := h.authService.Login(req.Email, req.Password)
	if err != nil {
		if errors.Is(err, services.ErrInvalidCredentials) {
			return ErrorResponse(c, http.StatusUnauthorized, "invalid credentials")
		}
		if errors.Is(err, services.ErrOAuthOnly) {
			return BadRequestResponse(c, err.Error())
		}
		return InternalErrorResponse(c, "failed to login")
	}

	// Set refresh token as httpOnly cookie
	if resp.RefreshToken != "" {
		h.setRefreshTokenCookie(c, resp.RefreshToken)
		resp.RefreshToken = "" // Don't send in JSON body
	}

	return c.JSON(http.StatusOK, resp)
}

func (h *AuthHandler) MeHandler(c *echo.Context) error {
	userID := c.Get("userID").(string)

	user, err := h.authService.GetUserByID(userID)
	if err != nil {
		if errors.Is(err, repository.ErrUserNotFound) {
			return ErrorResponse(c, http.StatusUnauthorized, "user not found")
		}
		return InternalErrorResponse(c, "failed to get user")
	}

	return c.JSON(http.StatusOK, user)
}

var validTimeFormats = map[string]bool{
	"bullet": true,
	"blitz":  true,
	"rapid":  true,
}

func (h *AuthHandler) UpdateProfileHandler(c *echo.Context) error {
	userID := c.Get("userID").(string)

	var req models.UpdateProfileRequest
	if err := c.Bind(&req); err != nil {
		return BadRequestResponse(c, "invalid request body")
	}

	for _, tf := range req.TimeFormatPrefs {
		if !validTimeFormats[tf] {
			return BadRequestResponse(c, "invalid time format: "+tf+". Allowed values: bullet, blitz, rapid")
		}
	}

	user, err := h.authService.UpdateProfile(userID, req)
	if err != nil {
		if errors.Is(err, repository.ErrUserNotFound) {
			return ErrorResponse(c, http.StatusUnauthorized, "user not found")
		}
		return InternalErrorResponse(c, "failed to update profile")
	}

	return c.JSON(http.StatusOK, user)
}

func (h *AuthHandler) ForgotPasswordHandler(c *echo.Context) error {
	var req models.ForgotPasswordRequest
	if err := c.Bind(&req); err != nil {
		return BadRequestResponse(c, "invalid request body")
	}

	if !RequireField(c, "email", req.Email) {
		return nil
	}

	// Always return success to prevent email enumeration
	_ = h.authService.RequestPasswordReset(req.Email)

	return c.JSON(http.StatusOK, map[string]string{
		"message": "If an account with that email exists, a password reset link has been sent.",
	})
}

func (h *AuthHandler) ResetPasswordHandler(c *echo.Context) error {
	var req models.ResetPasswordRequest
	if err := c.Bind(&req); err != nil {
		return BadRequestResponse(c, "invalid request body")
	}

	if !RequireField(c, "token", req.Token) {
		return nil
	}
	if !RequireField(c, "newPassword", req.NewPassword) {
		return nil
	}

	err := h.authService.ResetPassword(req.Token, req.NewPassword)
	if err != nil {
		if errors.Is(err, services.ErrResetTokenInvalid) {
			return BadRequestResponse(c, "invalid reset token")
		}
		if errors.Is(err, services.ErrResetTokenExpired) {
			return BadRequestResponse(c, "reset token has expired")
		}
		if errors.Is(err, services.ErrResetTokenUsed) {
			return BadRequestResponse(c, "reset token has already been used")
		}
		if errors.Is(err, services.ErrPasswordTooShort) {
			return BadRequestResponse(c, "password must be at least 8 characters")
		}
		return InternalErrorResponse(c, "failed to reset password")
	}

	return c.JSON(http.StatusOK, map[string]string{
		"message": "Password has been reset successfully.",
	})
}

func (h *AuthHandler) ChangePasswordHandler(c *echo.Context) error {
	userID := c.Get("userID").(string)

	var req models.ChangePasswordRequest
	if err := c.Bind(&req); err != nil {
		return BadRequestResponse(c, "invalid request body")
	}

	if !RequireField(c, "currentPassword", req.CurrentPassword) {
		return nil
	}
	if !RequireField(c, "newPassword", req.NewPassword) {
		return nil
	}

	err := h.authService.ChangePassword(userID, req.CurrentPassword, req.NewPassword)
	if err != nil {
		if errors.Is(err, services.ErrIncorrectPassword) {
			return BadRequestResponse(c, "current password is incorrect")
		}
		if errors.Is(err, services.ErrNoPassword) {
			return BadRequestResponse(c, "this account does not have a password set")
		}
		if errors.Is(err, services.ErrPasswordTooShort) {
			return BadRequestResponse(c, "password must be at least 8 characters")
		}
		if errors.Is(err, repository.ErrUserNotFound) {
			return ErrorResponse(c, http.StatusUnauthorized, "user not found")
		}
		return InternalErrorResponse(c, "failed to change password")
	}

	return c.JSON(http.StatusOK, map[string]string{
		"message": "Password changed successfully.",
	})
}

func (h *AuthHandler) DeleteAccountHandler(c *echo.Context) error {
	userID := c.Get("userID").(string)

	var req models.DeleteAccountRequest
	if err := c.Bind(&req); err != nil {
		return BadRequestResponse(c, "invalid request body")
	}

	err := h.authService.DeleteAccount(userID, req.Password, req.Username)
	if err != nil {
		if errors.Is(err, services.ErrIncorrectPassword) {
			return BadRequestResponse(c, "incorrect password")
		}
		if errors.Is(err, services.ErrInvalidCredentials) {
			return BadRequestResponse(c, "incorrect username confirmation")
		}
		if errors.Is(err, repository.ErrUserNotFound) {
			return ErrorResponse(c, http.StatusUnauthorized, "user not found")
		}
		return InternalErrorResponse(c, "failed to delete account")
	}

	return c.NoContent(http.StatusNoContent)
}

func (h *AuthHandler) HasPasswordHandler(c *echo.Context) error {
	userID := c.Get("userID").(string)

	hasPassword, err := h.authService.HasPassword(userID)
	if err != nil {
		if errors.Is(err, repository.ErrUserNotFound) {
			return ErrorResponse(c, http.StatusUnauthorized, "user not found")
		}
		return InternalErrorResponse(c, "failed to check password status")
	}

	return c.JSON(http.StatusOK, models.HasPasswordResponse{HasPassword: hasPassword})
}

// RefreshHandler exchanges a valid refresh token for a new access token + refresh token pair.
// The refresh token is read from the httpOnly cookie.
func (h *AuthHandler) RefreshHandler(c *echo.Context) error {
	cookie, err := c.Cookie(refreshTokenCookieName)
	if err != nil || cookie.Value == "" {
		return ErrorResponse(c, http.StatusUnauthorized, "no refresh token")
	}

	resp, err := h.authService.RefreshTokens(cookie.Value)
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
		_ = h.authService.RevokeRefreshToken(cookie.Value)
	}

	h.clearRefreshTokenCookie(c)
	return c.JSON(http.StatusOK, map[string]string{"message": "logged out"})
}
