package handlers

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/google/uuid"
	"github.com/labstack/echo/v5"

	"github.com/kumquat/backend/internal/models"
	"github.com/kumquat/backend/internal/services"
)

// ifMatchHeader is the request header carrying the client's expected repertoire
// version for optimistic concurrency control. etagHeader echoes the persisted
// version back so the client can update its cached copy.
const (
	ifMatchHeader = "If-Match"
	etagHeader    = "ETag"
)

// SetRepertoireETag stamps the repertoire's optimistic-lock version onto the
// response as an ETag header so clients can echo it back via If-Match on the
// next mutation.
func SetRepertoireETag(c *echo.Context, rep *models.Repertoire) {
	if rep == nil {
		return
	}
	c.Response().Header().Set(etagHeader, strconv.Itoa(rep.Version))
}

// parseIfMatch reads the If-Match header and parses it as an expected version.
// It returns (version, present, valid): present is false when the header is
// absent (no precondition requested); valid is false when the header is present
// but malformed (callers should treat that as a 400).
func parseIfMatch(c *echo.Context) (version int, present bool, valid bool) {
	raw := c.Request().Header.Get(ifMatchHeader)
	if raw == "" {
		return 0, false, true
	}
	v, err := strconv.Atoi(raw)
	if err != nil || v < 0 {
		return 0, true, false
	}
	return v, true, true
}

// versionFetcher is the minimal surface needed to enforce an If-Match
// precondition: load the current version of a repertoire the caller owns.
type versionFetcher interface {
	GetRepertoire(id string) (*models.Repertoire, error)
}

// checkIfMatch enforces an optimistic-concurrency precondition before a tree
// mutation runs. When the client sends an If-Match header, the current
// persisted version is fetched and compared; a mismatch short-circuits with
// HTTP 409 so a stale client re-fetches instead of silently clobbering a newer
// write. Absent header means no precondition (backward compatible). The repo
// layer still guards the server-side race window during the mutation itself.
//
// Returns ok=false when the request has already been answered (the caller
// should return the provided error verbatim).
func checkIfMatch(c *echo.Context, svc versionFetcher, repertoireID string) (ok bool, errResp error) {
	expected, present, valid := parseIfMatch(c)
	if !present {
		return true, nil
	}
	if !valid {
		return false, BadRequestResponse(c, "If-Match must be a non-negative integer version")
	}

	current, err := svc.GetRepertoire(repertoireID)
	if err != nil {
		return false, NotFoundResponse(c, "repertoire")
	}
	if current.Version != expected {
		SetRepertoireETag(c, current)
		return false, ConflictResponse(c, "repertoire was modified since it was loaded; please refresh")
	}
	return true, nil
}

// runNodeMutation centralizes the shared flow for the node-level tree mutators:
// enforce the If-Match precondition, run the mutation, map the common
// node-mutation errors (conflict/not-found/node-not-found) to status codes, and
// stamp the refreshed ETag on success. extraErrors lets a specific handler map
// any endpoint-specific sentinels (checked before the generic 500) and is
// allowed to be nil.
func runNodeMutation(
	c *echo.Context,
	svc *services.RepertoireService,
	repertoireID string,
	mutate func() (*models.Repertoire, error),
	extraErrors func(err error) (handled bool, resp error),
) error {
	if ok, resp := checkIfMatch(c, svc, repertoireID); !ok {
		return resp
	}

	rep, err := mutate()
	if err != nil {
		if errors.Is(err, services.ErrConflict) {
			return ConflictResponse(c, "repertoire was modified by another write; please refresh")
		}
		if errors.Is(err, services.ErrNotFound) {
			return NotFoundResponse(c, "repertoire")
		}
		if errors.Is(err, services.ErrNodeNotFound) {
			return NotFoundResponse(c, "node")
		}
		if extraErrors != nil {
			if handled, resp := extraErrors(err); handled {
				return resp
			}
		}
		return InternalErrorResponse(c, "failed to update repertoire")
	}

	SetRepertoireETag(c, rep)
	return c.JSON(http.StatusOK, rep)
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
