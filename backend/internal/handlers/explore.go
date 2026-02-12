package handlers

import (
	"errors"
	"net/http"

	"github.com/google/uuid"
	"github.com/labstack/echo/v4"

	"github.com/kumquat/backend/internal/models"
	"github.com/kumquat/backend/internal/services"
)

// ListPublicRepertoiresHandler returns all public repertoires
// GET /api/explore/repertoires
func ListPublicRepertoiresHandler(svc *services.RepertoireService) echo.HandlerFunc {
	return func(c echo.Context) error {
		repertoires, err := svc.ListPublicRepertoires()
		if err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{
				"error": "failed to list public repertoires",
			})
		}

		if repertoires == nil {
			repertoires = []models.Repertoire{}
		}

		return c.JSON(http.StatusOK, repertoires)
	}
}

// GetPublicRepertoireHandler returns a single public repertoire by ID
// GET /api/explore/repertoires/:id
func GetPublicRepertoireHandler(svc *services.RepertoireService) echo.HandlerFunc {
	return func(c echo.Context) error {
		idParam := c.Param("id")

		if _, err := uuid.Parse(idParam); err != nil {
			return c.JSON(http.StatusBadRequest, map[string]string{
				"error": "id must be a valid UUID",
			})
		}

		rep, err := svc.GetPublicRepertoire(idParam)
		if err != nil {
			if errors.Is(err, services.ErrNotFound) {
				return c.JSON(http.StatusNotFound, map[string]string{
					"error": "repertoire not found",
				})
			}
			return c.JSON(http.StatusInternalServerError, map[string]string{
				"error": "failed to get repertoire",
			})
		}

		return c.JSON(http.StatusOK, rep)
	}
}

// ImportRepertoireHandler imports a public repertoire into the user's repertoires
// POST /api/explore/repertoires/:id/import
func ImportRepertoireHandler(svc *services.RepertoireService) echo.HandlerFunc {
	return func(c echo.Context) error {
		userID := c.Get("userID").(string)
		idParam := c.Param("id")

		if _, err := uuid.Parse(idParam); err != nil {
			return c.JSON(http.StatusBadRequest, map[string]string{
				"error": "id must be a valid UUID",
			})
		}

		rep, err := svc.ImportRepertoire(userID, idParam)
		if err != nil {
			if errors.Is(err, services.ErrNotFound) {
				return c.JSON(http.StatusNotFound, map[string]string{
					"error": "repertoire not found",
				})
			}
			if errors.Is(err, services.ErrLimitReached) {
				return c.JSON(http.StatusConflict, map[string]string{
					"error": "maximum repertoire limit reached (50)",
				})
			}
			return c.JSON(http.StatusBadRequest, map[string]string{
				"error": "failed to import repertoire",
			})
		}

		return c.JSON(http.StatusCreated, rep)
	}
}
