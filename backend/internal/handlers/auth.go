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

	if !RequireField(c, "username", req.Username) {
		return nil
	}
	if !RequireField(c, "password", req.Password) {
		return nil
	}

	resp, err := h.authService.Register(req.Username, req.Password)
	if err != nil {
		if errors.Is(err, services.ErrInvalidUsername) {
			return BadRequestResponse(c, err.Error())
		}
		if errors.Is(err, services.ErrPasswordTooShort) {
			return BadRequestResponse(c, err.Error())
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

	if !RequireField(c, "username", req.Username) {
		return nil
	}
	if !RequireField(c, "password", req.Password) {
		return nil
	}

	resp, err := h.authService.Login(req.Username, req.Password)
	if err != nil {
		if errors.Is(err, services.ErrInvalidCredentials) {
			return ErrorResponse(c, http.StatusUnauthorized, "invalid credentials")
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
