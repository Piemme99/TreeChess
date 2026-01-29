package middleware

import (
	"net/http"
	"strings"

	"github.com/labstack/echo/v4"

	"github.com/treechess/backend/internal/services"
)

func JWTAuth(authSvc *services.AuthService) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			var tokenStr string

			// Try Authorization header first
			authHeader := c.Request().Header.Get("Authorization")
			if strings.HasPrefix(authHeader, "Bearer ") {
				tokenStr = strings.TrimPrefix(authHeader, "Bearer ")
			}

			// Fallback to query param (for SSE/EventSource)
			if tokenStr == "" {
				tokenStr = c.QueryParam("token")
			}

			if tokenStr == "" {
				return c.JSON(http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
			}

			userID, err := authSvc.ValidateToken(tokenStr)
			if err != nil {
				return c.JSON(http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
			}

			c.Set("userID", userID)
			return next(c)
		}
	}
}
