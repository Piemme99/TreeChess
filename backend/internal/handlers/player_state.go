package handlers

import (
	"context"
	"encoding/json"
	"io"
	"net/http"

	"github.com/labstack/echo/v5"
)

// Une clé tient les décisions d'un joueur sur des années de parties : bien moins d'un mégaoctet.
const maxPlayerStateValue = 1 << 20

// Les clés que la v2 enregistre ; toute autre est refusée.
var playerStateKeys = map[string]bool{"additions": true, "ignored-checks": true, "review": true, "worked": true}

type PlayerStateStore interface {
	Get(ctx context.Context, userID string) (json.RawMessage, error)
	Set(ctx context.Context, userID, key string, value json.RawMessage) error
}

// GetPlayerStateHandler rend les décisions du joueur (GET /api/v2/state).
func GetPlayerStateHandler(store PlayerStateStore) echo.HandlerFunc {
	return func(c *echo.Context) error {
		userID, _ := c.Get("userID").(string)
		state, err := store.Get(c.Request().Context(), userID)
		if err != nil {
			return InternalErrorResponse(c, "failed to load your decisions")
		}
		return c.JSON(http.StatusOK, map[string]json.RawMessage{"state": state})
	}
}

// PutPlayerStateHandler remplace une clé des décisions du joueur (PUT /api/v2/state/:key, corps JSON).
func PutPlayerStateHandler(store PlayerStateStore) echo.HandlerFunc {
	return func(c *echo.Context) error {
		key := c.Param("key")
		if !playerStateKeys[key] {
			return BadRequestResponse(c, "unknown state key")
		}
		body, err := io.ReadAll(io.LimitReader(c.Request().Body, maxPlayerStateValue+1))
		if err != nil {
			return BadRequestResponse(c, "cannot read the value")
		}
		if len(body) > maxPlayerStateValue {
			return ErrorResponse(c, http.StatusRequestEntityTooLarge, "value too large")
		}
		if !json.Valid(body) {
			return BadRequestResponse(c, "the value must be JSON")
		}
		userID, _ := c.Get("userID").(string)
		if err := store.Set(c.Request().Context(), userID, key, body); err != nil {
			return InternalErrorResponse(c, "failed to save your decision")
		}
		return c.NoContent(http.StatusNoContent)
	}
}
