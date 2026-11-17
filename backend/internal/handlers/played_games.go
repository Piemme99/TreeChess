package handlers

import (
	"errors"
	"net/http"

	"github.com/labstack/echo/v5"

	"github.com/kumquat/backend/internal/repository"
	"github.com/kumquat/backend/internal/services"
)

// PlayedGames regroupe l'import des parties Lichess de la v2 et leur lecture.
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
	if state == nil {
		return c.JSON(http.StatusOK, map[string]string{"status": "none"})
	}
	return c.JSON(http.StatusOK, state)
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
