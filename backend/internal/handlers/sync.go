package handlers

import (
	"errors"
	"net/http"

	"github.com/labstack/echo/v5"

	"github.com/kumquat/backend/internal/services"
)

type SyncHandler struct {
	syncService *services.SyncService
}

func NewSyncHandler(syncSvc *services.SyncService) *SyncHandler {
	return &SyncHandler{syncService: syncSvc}
}

func (h *SyncHandler) HandleSync(c *echo.Context) error {
	userID, ok := mustUserID(c)
	if !ok {
		return nil
	}

	result, err := h.syncService.Sync(userID)
	if err != nil {
		if errors.Is(err, services.ErrSyncCooldown) {
			return ErrorResponse(c, http.StatusTooManyRequests, err.Error())
		}
		if errors.Is(err, services.ErrSyncInProgress) {
			return ErrorResponse(c, http.StatusConflict, err.Error())
		}
		return InternalErrorResponse(c, "failed to sync games")
	}

	return c.JSON(http.StatusOK, result)
}
