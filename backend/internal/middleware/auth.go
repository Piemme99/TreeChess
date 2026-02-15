package middleware

import (
	"net/http"
	"strings"

	"github.com/labstack/echo/v5"
)

// TokenValidator validates JWT tokens and returns the associated user ID.
type TokenValidator interface {
	ValidateToken(token string) (string, error)
}

func JWTAuth(validator TokenValidator) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c *echo.Context) error {
			var tokenStr string

			// Try Authorization header first (used by frontend for access token)
			authHeader := c.Request().Header.Get("Authorization")
			if after, ok := strings.CutPrefix(authHeader, "Bearer "); ok {
				tokenStr = after
			}

			// Fallback to query param (for SSE/EventSource)
			if tokenStr == "" {
				tokenStr = c.QueryParam("token")
			}

			if tokenStr == "" {
				return c.JSON(http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
			}

			userID, err := validator.ValidateToken(tokenStr)
			if err != nil {
				return c.JSON(http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
			}

			c.Set("userID", userID)
			return next(c)
		}
	}
}
