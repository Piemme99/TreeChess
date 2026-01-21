package handlers

import (
	"errors"
	"net/http"

	"github.com/google/uuid"
	"github.com/labstack/echo/v4"

	"github.com/treechess/backend/internal/models"
	"github.com/treechess/backend/internal/services"
)

func RepertoireHandler(svc *services.RepertoireService) echo.HandlerFunc {
	return func(c echo.Context) error {
		colorParam := c.Param("color")
		color := models.Color(colorParam)

		if color != models.ColorWhite && color != models.ColorBlack {
			return c.JSON(http.StatusBadRequest, map[string]string{
				"error": "invalid color. must be 'white' or 'black'",
			})
		}

		rep, err := svc.GetRepertoire(color)
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

func AddNodeHandler(svc *services.RepertoireService) echo.HandlerFunc {
	return func(c echo.Context) error {
		colorParam := c.Param("color")
		color := models.Color(colorParam)

		if color != models.ColorWhite && color != models.ColorBlack {
			return c.JSON(http.StatusBadRequest, map[string]string{
				"error": "invalid color. must be 'white' or 'black'",
			})
		}

		var req models.AddNodeRequest
		if err := c.Bind(&req); err != nil {
			return c.JSON(http.StatusBadRequest, map[string]string{
				"error": "invalid request body",
			})
		}

		if req.ParentID == "" {
			return c.JSON(http.StatusBadRequest, map[string]string{
				"error": "parentId is required",
			})
		}

		// Validate parentId is a valid UUID
		if _, err := uuid.Parse(req.ParentID); err != nil {
			return c.JSON(http.StatusBadRequest, map[string]string{
				"error": "parentId must be a valid UUID",
			})
		}

		if req.Move == "" {
			return c.JSON(http.StatusBadRequest, map[string]string{
				"error": "move is required",
			})
		}

		rep, err := svc.AddNode(color, req)
		if err != nil {
			if errors.Is(err, services.ErrParentNotFound) {
				return c.JSON(http.StatusNotFound, map[string]string{
					"error": "parent node not found",
				})
			}
			if errors.Is(err, services.ErrInvalidMove) {
				return c.JSON(http.StatusBadRequest, map[string]string{
					"error": err.Error(),
				})
			}
			if errors.Is(err, services.ErrMoveExists) {
				return c.JSON(http.StatusConflict, map[string]string{
					"error": "move already exists in repertoire",
				})
			}
			return c.JSON(http.StatusInternalServerError, map[string]string{
				"error": "failed to add node",
			})
		}

		return c.JSON(http.StatusOK, rep)
	}
}

func DeleteNodeHandler(svc *services.RepertoireService) echo.HandlerFunc {
	return func(c echo.Context) error {
		colorParam := c.Param("color")
		color := models.Color(colorParam)
		nodeID := c.Param("id")

		if color != models.ColorWhite && color != models.ColorBlack {
			return c.JSON(http.StatusBadRequest, map[string]string{
				"error": "invalid color. must be 'white' or 'black'",
			})
		}

		// Validate nodeId is a valid UUID
		if _, err := uuid.Parse(nodeID); err != nil {
			return c.JSON(http.StatusBadRequest, map[string]string{
				"error": "node id must be a valid UUID",
			})
		}

		rep, err := svc.DeleteNode(color, nodeID)
		if err != nil {
			if errors.Is(err, services.ErrCannotDeleteRoot) {
				return c.JSON(http.StatusBadRequest, map[string]string{
					"error": "cannot delete root node",
				})
			}
			if errors.Is(err, services.ErrNodeNotFound) {
				return c.JSON(http.StatusNotFound, map[string]string{
					"error": "node not found",
				})
			}
			return c.JSON(http.StatusInternalServerError, map[string]string{
				"error": "failed to delete node",
			})
		}

		return c.JSON(http.StatusOK, rep)
	}
}
