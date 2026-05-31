package handlers

import (
	"errors"
	"net/http"

	"github.com/labstack/echo/v5"

	"github.com/kumquat/backend/internal/services"
)

type DashboardHandler struct {
	dashboardService  *services.DashboardStatsService
	repertoireService *services.RepertoireService
}

func NewDashboardHandler(dashboardSvc *services.DashboardStatsService, repertoireSvc *services.RepertoireService) *DashboardHandler {
	return &DashboardHandler{dashboardService: dashboardSvc, repertoireService: repertoireSvc}
}

type DismissGapRequest struct {
	FEN          string `json:"fen"`
	OpponentMove string `json:"opponentMove"`
	RepertoireID string `json:"repertoireId"`
}

func (h *DashboardHandler) DismissGap(c *echo.Context) error {
	userID, ok := mustUserID(c)
	if !ok {
		return nil
	}

	var req DismissGapRequest
	if err := c.Bind(&req); err != nil {
		return BadRequestResponse(c, "invalid request body")
	}

	if req.FEN == "" || req.OpponentMove == "" || req.RepertoireID == "" {
		return BadRequestResponse(c, "fen, opponentMove, and repertoireId are required")
	}

	if !ValidateFENField(c, "fen", req.FEN) {
		return nil
	}
	if len(req.OpponentMove) > MaxChessMoveLength {
		return BadRequestResponse(c, "opponentMove is invalid")
	}
	if !ValidateUUIDField(c, "repertoireId", req.RepertoireID) {
		return nil
	}

	// Reject dismissals targeting a repertoire the caller does not own. A
	// missing or non-owned repertoire is reported as 404 to avoid leaking
	// existence of other users' repertoires.
	if err := h.repertoireService.CheckOwnership(req.RepertoireID, userID); err != nil {
		if errors.Is(err, services.ErrNotFound) {
			return NotFoundResponse(c, "repertoire")
		}
		return InternalErrorResponse(c, "failed to dismiss gap")
	}

	if err := h.dashboardService.DismissGap(userID, req.FEN, req.OpponentMove, req.RepertoireID); err != nil {
		return InternalErrorResponse(c, "failed to dismiss gap")
	}

	return c.NoContent(http.StatusNoContent)
}

func (h *DashboardHandler) GetStats(c *echo.Context) error {
	userID, ok := mustUserID(c)
	if !ok {
		return nil
	}

	stats, err := h.dashboardService.GetDashboardStats(userID)
	if err != nil {
		return InternalErrorResponse(c, "failed to get dashboard stats")
	}

	return c.JSON(http.StatusOK, stats)
}
