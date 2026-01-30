package handlers

import (
	"net/http"

	"github.com/labstack/echo/v4"

	"github.com/treechess/backend/internal/services"
)

type SyncHandler struct {
	syncService *services.SyncService
}

func NewSyncHandler(syncSvc *services.SyncService) *SyncHandler {
	return &SyncHandler{syncService: syncSvc}
}

func (h *SyncHandler) HandleSync(c echo.Context) error {
	userID := c.Get("userID").(string)

	result, err := h.syncService.Sync(userID)
	if err != nil {
		return InternalErrorResponse(c, "failed to sync games")
	}

	return c.JSON(http.StatusOK, result)
}
