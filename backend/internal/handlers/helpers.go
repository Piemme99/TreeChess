package handlers

import (
	"net/http"
	"strconv"

	"github.com/google/uuid"
	"github.com/labstack/echo/v4"
)

// ErrorResponse sends a JSON error response with the given status code and message
func ErrorResponse(c echo.Context, status int, message string) error {
	return c.JSON(status, map[string]string{"error": message})
}

// BadRequestResponse sends a 400 Bad Request error response
func BadRequestResponse(c echo.Context, message string) error {
	return ErrorResponse(c, http.StatusBadRequest, message)
}

// NotFoundResponse sends a 404 Not Found error response
func NotFoundResponse(c echo.Context, resource string) error {
	return ErrorResponse(c, http.StatusNotFound, resource+" not found")
}

// InternalErrorResponse sends a 500 Internal Server Error response
func InternalErrorResponse(c echo.Context, message string) error {
	return ErrorResponse(c, http.StatusInternalServerError, message)
}

// ConflictResponse sends a 409 Conflict error response
func ConflictResponse(c echo.Context, message string) error {
	return ErrorResponse(c, http.StatusConflict, message)
}

// ValidateUUIDParam validates a URL parameter as a valid UUID
// Returns the UUID string and true if valid, or sends an error response and returns false
func ValidateUUIDParam(c echo.Context, paramName string) (string, bool) {
	value := c.Param(paramName)
	if _, err := uuid.Parse(value); err != nil {
		BadRequestResponse(c, paramName+" must be a valid UUID")
		return "", false
	}
	return value, true
}

// ValidateUUIDField validates a request field as a valid UUID
// Returns true if valid, or sends an error response and returns false
func ValidateUUIDField(c echo.Context, fieldName, value string) bool {
	if _, err := uuid.Parse(value); err != nil {
		BadRequestResponse(c, fieldName+" must be a valid UUID")
		return false
	}
	return true
}

// ParseIntParam parses a URL parameter as an integer with optional min/max validation
// Returns the parsed value and true if valid, or sends an error response and returns false
func ParseIntParam(c echo.Context, paramName string, minValue int) (int, bool) {
	valueStr := c.Param(paramName)
	value, err := strconv.Atoi(valueStr)
	if err != nil || value < minValue {
		BadRequestResponse(c, paramName+" must be a valid integer >= "+strconv.Itoa(minValue))
		return 0, false
	}
	return value, true
}

// ParseIntQueryParam parses a query parameter as an integer with default value and bounds
func ParseIntQueryParam(c echo.Context, paramName string, defaultValue, minValue, maxValue int) int {
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
func RequireField(c echo.Context, fieldName, value string) bool {
	if value == "" {
		BadRequestResponse(c, fieldName+" is required")
		return false
	}
	return true
}
