package handlers

import (
	"errors"
	"net/http"
	"strings"

	"github.com/labstack/echo/v5"

	"github.com/kumquat/backend/internal/repository"
	"github.com/kumquat/backend/internal/services"
)

// PlayedGames regroupe l'import des parties Lichess et Chess.com de la v2 et leur lecture.
type PlayedGames struct {
	svc   *services.PlayedGameImportService
	users repository.UserRepository
}

func NewPlayedGames(svc *services.PlayedGameImportService, users repository.UserRepository) *PlayedGames {
	return &PlayedGames{svc: svc, users: users}
}

// StartImport lance l'import (POST /api/v2/games/import) et rend son état ; un import en cours n'est pas relancé.
func (h *PlayedGames) StartImport(c *echo.Context) error {
	userID, _ := c.Get("userID").(string)
	ctx := c.Request().Context()
	user, err := h.users.GetByID(ctx, userID)
	if err != nil {
		return InternalErrorResponse(c, "failed to load the account")
	}
	state, err := h.svc.Start(ctx, user)
	if errors.Is(err, services.ErrLichessNotLinked) {
		return c.JSON(http.StatusForbidden, map[string]string{
			"error": "Sign in with Lichess to import your games",
			"code":  "lichess_sign_in",
		})
	}
	if err != nil {
		return InternalErrorResponse(c, "failed to start the import")
	}
	return c.JSON(http.StatusAccepted, state)
}

// ImportStatus rend l'état du dernier import (GET /api/v2/games/import), « none » s'il n'y en a pas eu.
func (h *PlayedGames) ImportStatus(c *echo.Context) error {
	userID, _ := c.Get("userID").(string)
	state, err := h.svc.Status(c.Request().Context(), userID)
	if err != nil {
		return InternalErrorResponse(c, "failed to read the import")
	}
	return c.JSON(http.StatusOK, state)
}

// LinkChesscom ajoute un compte Chess.com (PUT /api/v2/games/chesscom) et lance l'import de ses parties.
func (h *PlayedGames) LinkChesscom(c *echo.Context) error {
	userID, _ := c.Get("userID").(string)
	ctx := c.Request().Context()
	var body struct {
		Username string `json:"username"`
	}
	if err := c.Bind(&body); err != nil {
		return BadRequestResponse(c, "invalid request body")
	}
	username := strings.TrimSpace(body.Username)
	user, err := h.users.GetByID(ctx, userID)
	if err != nil {
		return InternalErrorResponse(c, "failed to load the account")
	}
	state, err := h.svc.LinkChesscom(ctx, user, username)
	switch {
	case errors.Is(err, services.ErrChesscomPlayerNotFound):
		return c.JSON(http.StatusNotFound, map[string]string{"error": "No Chess.com player is called " + username})
	case errors.Is(err, services.ErrChesscomAlreadyLinked):
		return c.JSON(http.StatusConflict, map[string]string{"error": "Another Chess.com account is already linked"})
	case errors.Is(err, services.ErrChesscomUnreachable):
		return c.JSON(http.StatusBadGateway, map[string]string{"error": "Chess.com did not answer. Try again in a minute."})
	case errors.Is(err, services.ErrLichessNotLinked):
		return c.JSON(http.StatusForbidden, map[string]string{"error": "Sign in with Lichess to import your games", "code": "lichess_sign_in"})
	case err != nil:
		return InternalErrorResponse(c, "failed to link the Chess.com account")
	}
	return c.JSON(http.StatusAccepted, state)
}

// UnlinkChesscom oublie le compte Chess.com et ses parties (DELETE /api/v2/games/chesscom).
func (h *PlayedGames) UnlinkChesscom(c *echo.Context) error {
	userID, _ := c.Get("userID").(string)
	err := h.svc.UnlinkChesscom(c.Request().Context(), userID)
	if errors.Is(err, services.ErrImportRunning) {
		return c.JSON(http.StatusConflict, map[string]string{"error": "Your games are being imported. Try again when it is over."})
	}
	if err != nil {
		return InternalErrorResponse(c, "failed to remove the Chess.com account")
	}
	return c.NoContent(http.StatusNoContent)
}

// List rend les parties importées (GET /api/v2/games), de la plus ancienne à la plus récente.
func (h *PlayedGames) List(c *echo.Context) error {
	userID, _ := c.Get("userID").(string)
	games, err := h.svc.Games(c.Request().Context(), userID)
	if err != nil {
		return InternalErrorResponse(c, "failed to load your games")
	}
	return c.JSON(http.StatusOK, map[string]any{"games": games})
}
