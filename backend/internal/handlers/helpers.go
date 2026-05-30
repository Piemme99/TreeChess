package handlers

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/google/uuid"
	"github.com/labstack/echo/v5"
	"github.com/notnil/chess"
)

// MaxFENLength caps the raw FEN string length before parsing. A legal FEN is
// well under 100 characters; this is a cheap guard against unbounded
// attacker-controlled input feeding the chess parser or a cache key.
const MaxFENLength = 100

// MaxChessMoveLength caps a SAN move string. The longest legal SAN (e.g.
// "exd8=Q+") is well under this bound; it guards against unbounded input being
// persisted as part of a dismiss row.
const MaxChessMoveLength = 16

// validExplorerVariants is the allowlist of Lichess Opening Explorer variants.
// Anything outside this set is rejected before it can widen the cache key-space
// or reach the upstream API.
var validExplorerVariants = map[string]bool{
	"standard":      true,
	"chess960":      true,
	"crazyhouse":    true,
	"antichess":     true,
	"atomic":        true,
	"horde":         true,
	"kingOfTheHill": true,
	"racingKings":   true,
	"threeCheck":    true,
}

// IsValidExplorerVariant reports whether variant is an allowed Lichess
// Opening Explorer variant.
func IsValidExplorerVariant(variant string) bool {
	return validExplorerVariants[variant]
}

// ensureFullFEN appends the side-to-move / castling fields' trailing counters
// when a board-only FEN (4 fields) is supplied, mirroring the services package
// helper so handler-level validation accepts the same inputs the services do.
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

// ErrorResponse sends a JSON error response with the given status code and message
func ErrorResponse(c *echo.Context, status int, message string) error {
	return c.JSON(status, map[string]string{"error": message})
}

// BadRequestResponse sends a 400 Bad Request error response
func BadRequestResponse(c *echo.Context, message string) error {
	return ErrorResponse(c, http.StatusBadRequest, message)
}

// NotFoundResponse sends a 404 Not Found error response
func NotFoundResponse(c *echo.Context, resource string) error {
	return ErrorResponse(c, http.StatusNotFound, resource+" not found")
}

// InternalErrorResponse sends a 500 Internal Server Error response
func InternalErrorResponse(c *echo.Context, message string) error {
	return ErrorResponse(c, http.StatusInternalServerError, message)
}

// ConflictResponse sends a 409 Conflict error response
func ConflictResponse(c *echo.Context, message string) error {
	return ErrorResponse(c, http.StatusConflict, message)
}

// ValidateUUIDParam validates a URL parameter as a valid UUID
// Returns the UUID string and true if valid, or sends an error response and returns false
func ValidateUUIDParam(c *echo.Context, paramName string) (string, bool) {
	value := c.Param(paramName)
	if _, err := uuid.Parse(value); err != nil {
		_ = BadRequestResponse(c, paramName+" must be a valid UUID")
		return "", false
	}
	return value, true
}

// ValidateUUIDField validates a request field as a valid UUID
// Returns true if valid, or sends an error response and returns false
func ValidateUUIDField(c *echo.Context, fieldName, value string) bool {
	if _, err := uuid.Parse(value); err != nil {
		_ = BadRequestResponse(c, fieldName+" must be a valid UUID")
		return false
	}
	return true
}

// ParseIntParam parses a URL parameter as an integer with optional min/max validation
// Returns the parsed value and true if valid, or sends an error response and returns false
func ParseIntParam(c *echo.Context, paramName string, minValue int) (int, bool) {
	valueStr := c.Param(paramName)
	value, err := strconv.Atoi(valueStr)
	if err != nil || value < minValue {
		_ = BadRequestResponse(c, paramName+" must be a valid integer >= "+strconv.Itoa(minValue))
		return 0, false
	}
	return value, true
}

// ParseIntQueryParam parses a query parameter as an integer with default value and bounds
func ParseIntQueryParam(c *echo.Context, paramName string, defaultValue, minValue, maxValue int) int {
	valueStr := c.QueryParam(paramName)
	if valueStr == "" {
		return defaultValue
	}

	value, err := strconv.Atoi(valueStr)
	if err != nil || value < minValue {
		return defaultValue
	}
	if value > maxValue {
		return maxValue
	}
	return value
}

// RequireField checks if a required field is non-empty
// Returns true if valid, or sends an error response and returns false
func RequireField(c *echo.Context, fieldName, value string) bool {
	if value == "" {
		_ = BadRequestResponse(c, fieldName+" is required")
		return false
	}
	return true
}
