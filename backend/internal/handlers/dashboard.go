package handlers

import (
	"net/http"

	"github.com/labstack/echo/v4"

	"github.com/treechess/backend/internal/services"
)

type DashboardHandler struct {
	importService *services.ImportService
}

func NewDashboardHandler(importSvc *services.ImportService) *DashboardHandler {
	return &DashboardHandler{importService: importSvc}
}

func (h *DashboardHandler) GetStats(c echo.Context) error {
	userID := c.Get("userID").(string)

	stats, err := h.importService.GetDashboardStats(userID)
	if err != nil {
		return InternalErrorResponse(c, "failed to get dashboard stats")
	}

	return c.JSON(http.StatusOK, stats)
}
