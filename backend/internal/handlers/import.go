package handlers

import (
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"

	"github.com/google/uuid"
	"github.com/labstack/echo/v4"

	"github.com/treechess/backend/internal/models"
	"github.com/treechess/backend/internal/services"
)

type ImportHandler struct {
	importService  *services.ImportService
	lichessService *services.LichessService
}

func NewImportHandler(importSvc *services.ImportService, lichessSvc *services.LichessService) *ImportHandler {
	return &ImportHandler{
		importService:  importSvc,
		lichessService: lichessSvc,
	}
}

const MaxPGNSize = 10 * 1024 * 1024 // 10MB limit

func (h *ImportHandler) UploadHandler(c echo.Context) error {
	username := c.FormValue("username")

	if username == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "username is required",
		})
	}

	file, err := c.FormFile("file")
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "file is required",
		})
	}

	if !strings.HasSuffix(strings.ToLower(file.Filename), ".pgn") {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "file must have .pgn extension",
		})
	}

	if file.Size > MaxPGNSize {
		return c.JSON(http.StatusRequestEntityTooLarge, map[string]string{
			"error": "file exceeds maximum allowed size",
		})
	}

	src, err := file.Open()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": "failed to read file",
		})
	}
	defer src.Close()

	limitedReader := io.LimitReader(src, MaxPGNSize+1)
	pgnData, err := io.ReadAll(limitedReader)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": "failed to read file content",
		})
	}

	if len(pgnData) > MaxPGNSize {
		return c.JSON(http.StatusRequestEntityTooLarge, map[string]string{
			"error": "file exceeds maximum allowed size",
		})
	}

	summary, _, err := h.importService.ParseAndAnalyze(file.Filename, username, string(pgnData))
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": fmt.Sprintf("failed to parse and analyze PGN: %v", err),
		})
	}

	return c.JSON(http.StatusCreated, map[string]interface{}{
		"id":        summary.ID,
		"username":  summary.Username,
		"filename":  summary.Filename,
		"gameCount": summary.GameCount,
	})
}

func (h *ImportHandler) ListAnalysesHandler(c echo.Context) error {
	analyses, err := h.importService.GetAnalyses()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": "failed to list analyses",
		})
	}

	result := make([]map[string]interface{}, len(analyses))
	for i, a := range analyses {
		result[i] = map[string]interface{}{
			"id":         a.ID,
			"username":   a.Username,
			"filename":   a.Filename,
			"gameCount":  a.GameCount,
			"uploadedAt": a.UploadedAt.Format("2006-01-02T15:04:05Z07:00"),
		}
	}

	return c.JSON(http.StatusOK, result)
}

func (h *ImportHandler) GetAnalysisHandler(c echo.Context) error {
	id := c.Param("id")

	// Validate id is a valid UUID
	if _, err := uuid.Parse(id); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "id must be a valid UUID",
		})
	}

	detail, err := h.importService.GetAnalysisByID(id)
	if err != nil {
		if strings.Contains(err.Error(), "not found") {
			return c.JSON(http.StatusNotFound, map[string]string{
				"error": "analysis not found",
			})
		}
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": "failed to get analysis",
		})
	}

	result := map[string]interface{}{
		"id":         detail.ID,
		"username":   detail.Username,
		"filename":   detail.Filename,
		"gameCount":  detail.GameCount,
		"uploadedAt": detail.UploadedAt.Format("2006-01-02T15:04:05Z07:00"),
		"results":    detail.Results,
	}

	return c.JSON(http.StatusOK, result)
}

func (h *ImportHandler) DeleteAnalysisHandler(c echo.Context) error {
	id := c.Param("id")

	// Validate id is a valid UUID
	if _, err := uuid.Parse(id); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "id must be a valid UUID",
		})
	}

	err := h.importService.DeleteAnalysis(id)
	if err != nil {
		if strings.Contains(err.Error(), "not found") {
			return c.JSON(http.StatusNotFound, map[string]string{
				"error": "analysis not found",
			})
		}
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": "failed to delete analysis",
		})
	}

	return c.JSON(http.StatusOK, map[string]string{
		"status": "deleted",
	})
}

func (h *ImportHandler) ValidatePGNHandler(c echo.Context) error {
	limitedReader := io.LimitReader(c.Request().Body, MaxPGNSize+1)
	pgnData, err := io.ReadAll(limitedReader)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "failed to read request body",
		})
	}

	if len(pgnData) > MaxPGNSize {
		return c.JSON(http.StatusRequestEntityTooLarge, map[string]string{
			"error": "request body exceeds maximum allowed size",
		})
	}

	err = h.importService.ValidatePGN(string(pgnData))
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": fmt.Sprintf("invalid PGN: %v", err),
		})
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"valid": true,
	})
}

func (h *ImportHandler) ValidateMoveHandler(c echo.Context) error {
	var req struct {
		FEN string `json:"fen"`
		SAN string `json:"san"`
	}

	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "invalid request body",
		})
	}

	if req.FEN == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "fen is required",
		})
	}

	if req.SAN == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "san is required",
		})
	}

	err := h.importService.ValidateMove(req.FEN, req.SAN)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": err.Error(),
		})
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"valid": true,
	})
}

func (h *ImportHandler) GetLegalMovesHandler(c echo.Context) error {
	fen := c.QueryParam("fen")
	if fen == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "fen parameter is required",
		})
	}

	moves, err := h.importService.GetLegalMoves(fen)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": err.Error(),
		})
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"fen":   fen,
		"moves": moves,
	})
}

func (h *ImportHandler) GetGamesHandler(c echo.Context) error {
	// Parse pagination parameters with defaults
	limit := 20
	offset := 0

	if limitStr := c.QueryParam("limit"); limitStr != "" {
		if l, err := strconv.Atoi(limitStr); err == nil && l > 0 && l <= 100 {
			limit = l
		}
	}

	if offsetStr := c.QueryParam("offset"); offsetStr != "" {
		if o, err := strconv.Atoi(offsetStr); err == nil && o >= 0 {
			offset = o
		}
	}

	response, err := h.importService.GetAllGames(limit, offset)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": "failed to get games",
		})
	}

	return c.JSON(http.StatusOK, response)
}

func (h *ImportHandler) DeleteGameHandler(c echo.Context) error {
	analysisID := c.Param("analysisId")
	gameIndexStr := c.Param("gameIndex")

	// Validate analysisId is a valid UUID
	if _, err := uuid.Parse(analysisID); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "analysisId must be a valid UUID",
		})
	}

	gameIndex, err := strconv.Atoi(gameIndexStr)
	if err != nil || gameIndex < 0 {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "gameIndex must be a non-negative integer",
		})
	}

	err = h.importService.DeleteGame(analysisID, gameIndex)
	if err != nil {
		if strings.Contains(err.Error(), "not found") {
			return c.JSON(http.StatusNotFound, map[string]string{
				"error": err.Error(),
			})
		}
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": "failed to delete game",
		})
	}

	return c.JSON(http.StatusOK, map[string]string{
		"status": "deleted",
	})
}

func (h *ImportHandler) LichessImportHandler(c echo.Context) error {
	var req models.LichessImportRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "invalid request body",
		})
	}

	if req.Username == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "username is required",
		})
	}

	// Fetch games from Lichess
	pgnData, err := h.lichessService.FetchGames(req.Username, req.Options)
	if err != nil {
		// Determine appropriate status code based on error
		statusCode := http.StatusBadRequest
		if strings.Contains(err.Error(), "not found") {
			statusCode = http.StatusNotFound
		} else if strings.Contains(err.Error(), "rate limited") {
			statusCode = http.StatusTooManyRequests
		}
		return c.JSON(statusCode, map[string]string{
			"error": err.Error(),
		})
	}

	// Use the username as the filename indicator for Lichess imports
	filename := fmt.Sprintf("lichess_%s.pgn", req.Username)

	// Reuse existing ParseAndAnalyze
	summary, _, err := h.importService.ParseAndAnalyze(filename, req.Username, pgnData)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": fmt.Sprintf("failed to parse and analyze games: %v", err),
		})
	}

	return c.JSON(http.StatusCreated, map[string]interface{}{
		"id":        summary.ID,
		"username":  summary.Username,
		"filename":  summary.Filename,
		"gameCount": summary.GameCount,
		"source":    "lichess",
	})
}
