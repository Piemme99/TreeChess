package handlers

import (
	"errors"
	"net/http"

	"github.com/labstack/echo/v4"

	"github.com/treechess/backend/internal/models"
	"github.com/treechess/backend/internal/repository"
	"github.com/treechess/backend/internal/services"
)

type AuthHandler struct {
	authService *services.AuthService
}

func NewAuthHandler(authSvc *services.AuthService) *AuthHandler {
	return &AuthHandler{authService: authSvc}
}

func (h *AuthHandler) RegisterHandler(c echo.Context) error {
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

	return c.JSON(http.StatusCreated, resp)
}

func (h *AuthHandler) LoginHandler(c echo.Context) error {
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

	return c.JSON(http.StatusOK, resp)
}

func (h *AuthHandler) MeHandler(c echo.Context) error {
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

func (h *AuthHandler) UpdateProfileHandler(c echo.Context) error {
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

func (h *AuthHandler) ForgotPasswordHandler(c echo.Context) error {
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

func (h *AuthHandler) ResetPasswordHandler(c echo.Context) error {
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

func (h *AuthHandler) ChangePasswordHandler(c echo.Context) error {
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

func (h *AuthHandler) HasPasswordHandler(c echo.Context) error {
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
