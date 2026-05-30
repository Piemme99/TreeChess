package handlers

import (
	"net/http"

	"github.com/labstack/echo/v5"

	"github.com/kumquat/backend/internal/services"
)

type DashboardHandler struct {
	importService *services.ImportService
}

func NewDashboardHandler(importSvc *services.ImportService) *DashboardHandler {
	return &DashboardHandler{importService: importSvc}
}

type DismissGapRequest struct {
	FEN          string `json:"fen"`
	OpponentMove string `json:"opponentMove"`
	RepertoireID string `json:"repertoireId"`
}

func (h *DashboardHandler) DismissGap(c *echo.Context) error {
	userID := c.Get("userID").(string)

	var req DismissGapRequest
	if err := c.Bind(&req); err != nil {
		return BadRequestResponse(c, "invalid request body")
	}

	if req.FEN == "" || req.OpponentMove == "" || req.RepertoireID == "" {
		return BadRequestResponse(c, "fen, opponentMove, and repertoireId are required")
	}

	if err := h.importService.DismissGap(c.Request().Context(), userID, req.FEN, req.OpponentMove, req.RepertoireID); err != nil {
		return InternalErrorResponse(c, "failed to dismiss gap")
	}

	return c.NoContent(http.StatusNoContent)
}

func (h *DashboardHandler) GetStats(c *echo.Context) error {
	userID := c.Get("userID").(string)

	stats, err := h.importService.GetDashboardStats(c.Request().Context(), userID)
	if err != nil {
		return InternalErrorResponse(c, "failed to get dashboard stats")
	}

	return c.JSON(http.StatusOK, stats)
}
