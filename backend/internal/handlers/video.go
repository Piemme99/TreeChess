package handlers

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"sync"

	"github.com/labstack/echo/v4"

	"github.com/treechess/backend/internal/models"
	"github.com/treechess/backend/internal/repository"
	"github.com/treechess/backend/internal/services"
)

// VideoHandler handles video import HTTP requests
type VideoHandler struct {
	videoService    *services.VideoService
	repertoireSvc   *services.RepertoireService
	progressStreams sync.Map // map[string]<-chan models.SSEProgressEvent
}

// NewVideoHandler creates a new video handler
func NewVideoHandler(videoSvc *services.VideoService, repertoireSvc *services.RepertoireService) *VideoHandler {
	return &VideoHandler{
		videoService:  videoSvc,
		repertoireSvc: repertoireSvc,
	}
}

// SubmitHandler handles POST /api/video-imports
func (h *VideoHandler) SubmitHandler(c echo.Context) error {
	userID := c.Get("userID").(string)

	var req models.VideoImportRequest
	if err := c.Bind(&req); err != nil {
		return BadRequestResponse(c, "invalid request body")
	}

	if !RequireField(c, "youtubeUrl", req.YouTubeURL) {
		return nil
	}

	vi, progressCh, err := h.videoService.SubmitImport(userID, req.YouTubeURL)
	if err != nil {
		return BadRequestResponse(c, err.Error())
	}

	// Store the progress channel for SSE streaming
	h.progressStreams.Store(vi.ID, progressCh)

	return c.JSON(http.StatusCreated, vi)
}

// ListHandler handles GET /api/video-imports
func (h *VideoHandler) ListHandler(c echo.Context) error {
	userID := c.Get("userID").(string)

	imports, err := h.videoService.GetAllImports(userID)
	if err != nil {
		return InternalErrorResponse(c, "failed to list video imports")
	}

	if imports == nil {
		imports = []models.VideoImport{}
	}

	return c.JSON(http.StatusOK, imports)
}

// GetHandler handles GET /api/video-imports/:id
func (h *VideoHandler) GetHandler(c echo.Context) error {
	userID := c.Get("userID").(string)
	id, ok := ValidateUUIDParam(c, "id")
	if !ok {
		return nil
	}

	if err := h.videoService.CheckOwnership(id, userID); err != nil {
		return NotFoundResponse(c, "video import")
	}

	vi, err := h.videoService.GetImport(id)
	if err != nil {
		if errors.Is(err, repository.ErrVideoImportNotFound) {
			return NotFoundResponse(c, "video import")
		}
		return InternalErrorResponse(c, "failed to get video import")
	}

	return c.JSON(http.StatusOK, vi)
}

// ProgressHandler handles GET /api/video-imports/:id/progress (SSE)
func (h *VideoHandler) ProgressHandler(c echo.Context) error {
	userID := c.Get("userID").(string)
	id, ok := ValidateUUIDParam(c, "id")
	if !ok {
		return nil
	}

	if err := h.videoService.CheckOwnership(id, userID); err != nil {
		return NotFoundResponse(c, "video import")
	}

	// Set SSE headers
	c.Response().Header().Set("Content-Type", "text/event-stream")
	c.Response().Header().Set("Cache-Control", "no-cache")
	c.Response().Header().Set("Connection", "keep-alive")
	c.Response().Header().Set("Access-Control-Allow-Origin", "*")
	c.Response().WriteHeader(http.StatusOK)

	// Try to get the progress channel
	progressChRaw, ok := h.progressStreams.Load(id)
	if !ok {
		// No active stream - send current status and close
		vi, err := h.videoService.GetImport(id)
		if err != nil {
			return nil
		}
		event := models.SSEProgressEvent{
			Status:   vi.Status,
			Progress: vi.Progress,
			Message:  string(vi.Status),
		}
		data, _ := json.Marshal(event)
		fmt.Fprintf(c.Response(), "data: %s\n\n", data)
		c.Response().Flush()
		return nil
	}

	progressCh := progressChRaw.(<-chan models.SSEProgressEvent)

	for event := range progressCh {
		data, err := json.Marshal(event)
		if err != nil {
			continue
		}

		fmt.Fprintf(c.Response(), "data: %s\n\n", data)
		c.Response().Flush()

		// If terminal status, clean up
		if event.Status == models.VideoStatusCompleted || event.Status == models.VideoStatusFailed || event.Status == models.VideoStatusCancelled {
			h.progressStreams.Delete(id)
			break
		}
	}

	return nil
}

// TreeHandler handles GET /api/video-imports/:id/tree
func (h *VideoHandler) TreeHandler(c echo.Context) error {
	userID := c.Get("userID").(string)
	id, ok := ValidateUUIDParam(c, "id")
	if !ok {
		return nil
	}

	if err := h.videoService.CheckOwnership(id, userID); err != nil {
		return NotFoundResponse(c, "video import")
	}

	tree, color, err := h.videoService.GetTree(id)
	if err != nil {
		if errors.Is(err, repository.ErrVideoImportNotFound) {
			return NotFoundResponse(c, "video import")
		}
		return InternalErrorResponse(c, fmt.Sprintf("failed to build tree: %v", err))
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"treeData": tree,
		"color":    color,
	})
}

// SaveHandler handles POST /api/video-imports/:id/save
func (h *VideoHandler) SaveHandler(c echo.Context) error {
	userID := c.Get("userID").(string)
	id, ok := ValidateUUIDParam(c, "id")
	if !ok {
		return nil
	}

	if err := h.videoService.CheckOwnership(id, userID); err != nil {
		return NotFoundResponse(c, "video import")
	}

	// Verify the import exists and is completed
	vi, err := h.videoService.GetImport(id)
	if err != nil {
		if errors.Is(err, repository.ErrVideoImportNotFound) {
			return NotFoundResponse(c, "video import")
		}
		return InternalErrorResponse(c, "failed to get video import")
	}

	if vi.Status != models.VideoStatusCompleted {
		return BadRequestResponse(c, "video import is not yet completed")
	}

	var req models.VideoImportSaveRequest
	if err := c.Bind(&req); err != nil {
		return BadRequestResponse(c, "invalid request body")
	}

	if !RequireField(c, "name", req.Name) {
		return nil
	}

	if req.Color != models.ColorWhite && req.Color != models.ColorBlack {
		return BadRequestResponse(c, "color must be 'white' or 'black'")
	}

	// Create a new repertoire with the tree data
	rep, err := h.repertoireSvc.CreateRepertoire(userID, req.Name, req.Color)
	if err != nil {
		if errors.Is(err, services.ErrLimitReached) {
			return ConflictResponse(c, err.Error())
		}
		return BadRequestResponse(c, err.Error())
	}

	// Save the tree data into the repertoire
	rep, err = h.repertoireSvc.SaveTree(rep.ID, req.TreeData)
	if err != nil {
		return InternalErrorResponse(c, "failed to save tree data")
	}

	return c.JSON(http.StatusCreated, rep)
}

// CancelHandler handles POST /api/video-imports/:id/cancel
func (h *VideoHandler) CancelHandler(c echo.Context) error {
	userID := c.Get("userID").(string)
	id, ok := ValidateUUIDParam(c, "id")
	if !ok {
		return nil
	}

	if err := h.videoService.CheckOwnership(id, userID); err != nil {
		return NotFoundResponse(c, "video import")
	}

	err := h.videoService.CancelImport(id)
	if err != nil {
		if errors.Is(err, repository.ErrVideoImportNotFound) {
			return NotFoundResponse(c, "video import")
		}
		return BadRequestResponse(c, err.Error())
	}

	return c.NoContent(http.StatusNoContent)
}

// DeleteHandler handles DELETE /api/video-imports/:id
func (h *VideoHandler) DeleteHandler(c echo.Context) error {
	userID := c.Get("userID").(string)
	id, ok := ValidateUUIDParam(c, "id")
	if !ok {
		return nil
	}

	if err := h.videoService.CheckOwnership(id, userID); err != nil {
		return NotFoundResponse(c, "video import")
	}

	err := h.videoService.DeleteImport(id)
	if err != nil {
		if errors.Is(err, repository.ErrVideoImportNotFound) {
			return NotFoundResponse(c, "video import")
		}
		return InternalErrorResponse(c, "failed to delete video import")
	}

	return c.NoContent(http.StatusNoContent)
}

// SearchByFENHandler handles GET /api/video-positions/search
func (h *VideoHandler) SearchByFENHandler(c echo.Context) error {
	userID := c.Get("userID").(string)
	fen := c.QueryParam("fen")
	if fen == "" {
		return BadRequestResponse(c, "fen parameter is required")
	}

	results, err := h.videoService.SearchByFEN(userID, fen)
	if err != nil {
		return InternalErrorResponse(c, "failed to search video positions")
	}

	if results == nil {
		results = []models.VideoSearchResult{}
	}

	return c.JSON(http.StatusOK, results)
}
