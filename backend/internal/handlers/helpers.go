package handlers

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/google/uuid"
	"github.com/labstack/echo/v5"

	"github.com/kumquat/backend/internal/services"
)

// ErrorResponse sends a JSON error response with the given status code and message.
//
// Every error response in the API shares this base envelope: a JSON object with
// an "error" key holding a human-readable message. Endpoints MAY add extra
// documented keys alongside "error" (e.g. the explorer's "code"/"retryAfterSeconds"
// or study-import's "type"/"conflicts"), but must never drop or rename "error".
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

// requireOwnership verifies that the repertoire belongs to the user. It returns
// true when the user owns the repertoire, or sends a 404 "repertoire not found"
// response and returns false otherwise (errors are mapped to 404 to avoid leaking
// the existence of other users' repertoires).
func requireOwnership(c *echo.Context, svc *services.RepertoireService, repID, userID string) bool {
	if err := svc.CheckOwnership(repID, userID); err != nil {
		_ = NotFoundResponse(c, "repertoire")
		return false
	}
	return true
}

// mapRepertoireServiceError maps a RepertoireService error to an HTTP response.
// Known sentinel errors are translated to their canonical status/message; any
// other error becomes a 500 carrying the supplied fallback message. It always
// writes a response and returns the resulting error for the handler to return.
func mapRepertoireServiceError(c *echo.Context, err error, fallback string) error {
	switch {
	case errors.Is(err, services.ErrNotFound):
		return NotFoundResponse(c, "repertoire")
	case errors.Is(err, services.ErrNodeNotFound):
		return NotFoundResponse(c, "node")
	default:
		return InternalErrorResponse(c, fallback)
	}
}

// validateRepertoireID validates the ":id" path parameter as a UUID, emitting the
// "repertoire id must be a valid UUID" message used across the node/subtree
// endpoints. Returns the value and true when valid, or sends a 400 and returns false.
func validateRepertoireID(c *echo.Context) (string, bool) {
	value := c.Param("id")
	if _, err := uuid.Parse(value); err != nil {
		_ = BadRequestResponse(c, "repertoire id must be a valid UUID")
		return "", false
	}
	return value, true
}

// validateNodeID validates the ":nodeId" path parameter as a UUID, emitting the
// "node id must be a valid UUID" message. Returns the value and true when valid,
// or sends a 400 and returns false.
func validateNodeID(c *echo.Context) (string, bool) {
	value := c.Param("nodeId")
	if _, err := uuid.Parse(value); err != nil {
		_ = BadRequestResponse(c, "node id must be a valid UUID")
		return "", false
	}
	return value, true
}

// nodeTarget bundles the resolved identifiers for a node-mutation request.
type nodeTarget struct {
	UserID string
	RepID  string
	NodeID string
}

// withNode runs the common preamble shared by every node-mutation handler:
// it resolves the authenticated user, validates the ":id" and ":nodeId" path
// parameters as UUIDs, and verifies repertoire ownership. When all checks pass it
// returns the resolved identifiers and true; otherwise it has already written the
// appropriate error response and returns false, and the handler should return nil.
func withNode(c *echo.Context, svc *services.RepertoireService) (nodeTarget, bool) {
	userID, ok := mustUserID(c)
	if !ok {
		return nodeTarget{}, false
	}
	repID, ok := validateRepertoireID(c)
	if !ok {
		return nodeTarget{}, false
	}
	nodeID, ok := validateNodeID(c)
	if !ok {
		return nodeTarget{}, false
	}
	if !requireOwnership(c, svc, repID, userID) {
		return nodeTarget{}, false
	}
	return nodeTarget{UserID: userID, RepID: repID, NodeID: nodeID}, true
}
