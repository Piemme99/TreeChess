package handlers

import (
	"context"
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/google/uuid"
	"github.com/labstack/echo/v5"
	"github.com/notnil/chess"

	"github.com/kumquat/backend/internal/models"
	"github.com/kumquat/backend/internal/services"
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
	GetRepertoire(ctx context.Context, id string) (*models.Repertoire, error)
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

	current, err := svc.GetRepertoire(c.Request().Context(), repertoireID)
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
	if err := svc.CheckOwnership(c.Request().Context(), repID, userID); err != nil {
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
	case errors.Is(err, services.ErrConflict):
		return ConflictResponse(c, "repertoire was modified by another write; please refresh")
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
