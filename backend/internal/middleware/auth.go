package middleware

import (
	"context"
	"net/http"
	"strings"

	"github.com/labstack/echo/v5"
)

// TokenValidator validates JWT tokens and returns the associated user ID.
type TokenValidator interface {
	ValidateToken(ctx context.Context, token string) (string, error)
}

func JWTAuth(validator TokenValidator) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c *echo.Context) error {
			var tokenStr string

			// Extract the access token from the Authorization header only.
			// We intentionally do NOT fall back to a query param: putting the
			// JWT in the URL leaks it into access logs, browser history, and
			// the Referer header (see issue #124).
			authHeader := c.Request().Header.Get("Authorization")
			if after, ok := strings.CutPrefix(authHeader, "Bearer "); ok {
				tokenStr = after
			}

			if tokenStr == "" {
				return c.JSON(http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
			}

			userID, err := validator.ValidateToken(c.Request().Context(), tokenStr)
			if err != nil {
				return c.JSON(http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
			}

			c.Set("userID", userID)
			return next(c)
		}
	}
}

// OptionalJWTAuth laisse passer les visiteurs sans session, mais refuse un jeton invalide en 401 : le front
// rafraîchit alors son jeton d'accès au lieu de continuer en anonyme.
func OptionalJWTAuth(validator TokenValidator) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c *echo.Context) error {
			if c.Request().Header.Get("Authorization") == "" {
				return next(c)
			}
			return JWTAuth(validator)(next)(c)
		}
	}
}
