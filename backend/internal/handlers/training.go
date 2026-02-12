package handlers

import (
	"net/http"

	"github.com/labstack/echo/v4"

	"github.com/kumquat/backend/internal/models"
	"github.com/kumquat/backend/internal/services"
)

// TrainingHandler handles training-related API endpoints
type TrainingHandler struct {
	importService *services.ImportService
}

// NewTrainingHandler creates a new training handler
func NewTrainingHandler(importSvc *services.ImportService) *TrainingHandler {
	return &TrainingHandler{importService: importSvc}
}

// AnalyzeHandler analyzes a sequence of moves from explorer training against the user's repertoires
func (h *TrainingHandler) AnalyzeHandler(c echo.Context) error {
	userID := c.Get("userID").(string)

	var req models.TrainingAnalyzeRequest
	if err := c.Bind(&req); err != nil {
		return BadRequestResponse(c, "invalid request body")
	}

	if len(req.Moves) == 0 {
		return BadRequestResponse(c, "moves are required")
	}

	if req.UserColor != models.ColorWhite && req.UserColor != models.ColorBlack {
		return BadRequestResponse(c, "userColor must be \"white\" or \"black\"")
	}

	resp, err := h.importService.AnalyzeTrainingMoves(userID, req.Moves, req.UserColor)
	if err != nil {
		return InternalErrorResponse(c, "failed to analyze training moves")
	}

	return c.JSON(http.StatusOK, resp)
}
