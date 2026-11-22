package handlers

import (
	"net/http"
	"strings"

	"github.com/labstack/echo/v5"
	"github.com/notnil/chess"
)

// MaxFENLength caps the raw FEN string length before parsing. A legal FEN is
// well under 100 characters; this is a cheap guard against unbounded
// attacker-controlled input feeding the chess parser or a cache key.
const MaxFENLength = 100

// ensureFullFEN appends the move counters when a 4-field FEN is supplied, so
// the chess parser accepts the same positions the explorer does.
func ensureFullFEN(fen string) string {
	if len(strings.Fields(fen)) >= 6 {
		return fen
	}
	return fen + " 0 1"
}

// ValidateFEN parses fen (capped at MaxFENLength) with the chess library and
// returns true if it is a legal position. It does not write a response.
func ValidateFEN(fen string) bool {
	if fen == "" || len(fen) > MaxFENLength {
		return false
	}
	if _, err := chess.FEN(ensureFullFEN(fen)); err != nil {
		return false
	}
	return true
}

// ValidateFENField validates a request/query FEN value: it must be non-empty,
// at most MaxFENLength characters, and parse as a legal position. On failure it
// sends a 400 response and returns false.
func ValidateFENField(c *echo.Context, fieldName, value string) bool {
	if !ValidateFEN(value) {
		_ = BadRequestResponse(c, fieldName+" must be a valid FEN")
		return false
	}
	return true
}

// ErrorResponse sends a JSON error response with the given status code and message.
//
// Every error response in the API shares this base envelope: a JSON object with
// an "error" key holding a human-readable message. Endpoints MAY add extra
// documented keys alongside "error" (e.g. the explorer's "code"/"retryAfterSeconds"),
// but must never drop or rename "error".
func ErrorResponse(c *echo.Context, status int, message string) error {
	return c.JSON(status, map[string]string{"error": message})
}

// BadRequestResponse sends a 400 Bad Request error response
func BadRequestResponse(c *echo.Context, message string) error {
	return ErrorResponse(c, http.StatusBadRequest, message)
}

// InternalErrorResponse sends a 500 Internal Server Error response
func InternalErrorResponse(c *echo.Context, message string) error {
	return ErrorResponse(c, http.StatusInternalServerError, message)
}

// UnauthorizedResponse sends a 401 Unauthorized error response
func UnauthorizedResponse(c *echo.Context, message string) error {
	return ErrorResponse(c, http.StatusUnauthorized, message)
}

// mustUserID returns the authenticated user ID from the request context using the
// comma-ok form, so a handler accidentally mounted without JWTAuth responds with
// 401 instead of panicking. It returns the user ID and true when present, or sends
// a 401 response and returns false when missing.
func mustUserID(c *echo.Context) (string, bool) {
	userID, ok := c.Get("userID").(string)
	if !ok || userID == "" {
		_ = UnauthorizedResponse(c, "authentication required")
		return "", false
	}
	return userID, true
}
