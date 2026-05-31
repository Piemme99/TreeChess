package handlers

import (
	"errors"
	"net/http"

	"github.com/google/uuid"
	"github.com/labstack/echo/v5"

	"github.com/kumquat/backend/internal/models"
	"github.com/kumquat/backend/internal/services"
)

// ListExploreTemplatesHandler returns starter templates with full tree data for the explore page
// GET /api/explore/templates
func ListExploreTemplatesHandler() echo.HandlerFunc {
	return func(c *echo.Context) error {
		templates := services.ListTemplatesWithPreview()
		return c.JSON(http.StatusOK, templates)
	}
}

// ImportExploreTemplateHandler imports a starter template into the user's repertoires
// POST /api/explore/templates/:id/import
func ImportExploreTemplateHandler(svc *services.RepertoireService) echo.HandlerFunc {
	return func(c *echo.Context) error {
		userID, ok := mustUserID(c)
		if !ok {
			return nil
		}
		templateID := c.Param("id")

		// Validate the template id against the known set so an unknown id
		// returns 404 rather than being conflated with a generic 400.
		if services.GetTemplate(templateID) == nil {
			return NotFoundResponse(c, "template")
		}

		repertoires, err := svc.SeedRepertoires(c.Request().Context(), userID, []string{templateID})
		if err != nil {
			if errors.Is(err, services.ErrLimitReached) {
				return c.JSON(http.StatusConflict, map[string]string{
					"error": "maximum repertoire limit reached (50)",
				})
			}
			return c.JSON(http.StatusBadRequest, map[string]string{
				"error": "failed to import template",
			})
		}

		if len(repertoires) == 0 {
			return c.JSON(http.StatusInternalServerError, map[string]string{
				"error": "failed to import template",
			})
		}

		return c.JSON(http.StatusCreated, repertoires[0])
	}
}

// ListPublicRepertoiresHandler returns all public repertoires
// GET /api/explore/repertoires
func ListPublicRepertoiresHandler(svc *services.RepertoireService) echo.HandlerFunc {
	return func(c *echo.Context) error {
		repertoires, err := svc.ListPublicRepertoires(c.Request().Context())
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
	return func(c *echo.Context) error {
		idParam := c.Param("id")

		if _, err := uuid.Parse(idParam); err != nil {
			return c.JSON(http.StatusBadRequest, map[string]string{
				"error": "id must be a valid UUID",
			})
		}

		rep, err := svc.GetPublicRepertoire(c.Request().Context(), idParam)
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
	return func(c *echo.Context) error {
		userID, ok := mustUserID(c)
		if !ok {
			return nil
		}
		idParam := c.Param("id")

		if _, err := uuid.Parse(idParam); err != nil {
			return c.JSON(http.StatusBadRequest, map[string]string{
				"error": "id must be a valid UUID",
			})
		}

		rep, err := svc.ImportRepertoire(c.Request().Context(), userID, idParam)
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
