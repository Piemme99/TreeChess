package handlers

import (
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/labstack/echo/v4"

	"github.com/treechess/backend/internal/models"
	"github.com/treechess/backend/internal/repository"
	"github.com/treechess/backend/internal/services"
)

type ImportHandler struct {
	importService *services.ImportService
}

func NewImportHandler(importSvc *services.ImportService) *ImportHandler {
	return &ImportHandler{
		importService: importSvc,
	}
}

const MaxPGNSize = 10 * 1024 * 1024 // 10MB limit

func (h *ImportHandler) UploadHandler(c echo.Context) error {
	colorStr := c.FormValue("color")
	color := models.Color(colorStr)

	if color != models.ColorWhite && color != models.ColorBlack {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "invalid color. must be 'white' or 'black'",
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

	summary, _, err := h.importService.ParseAndAnalyze(file.Filename, color, string(pgnData))
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": fmt.Sprintf("failed to parse and analyze PGN: %v", err),
		})
	}

	return c.JSON(http.StatusCreated, map[string]interface{}{
		"id":        summary.ID,
		"color":     summary.Color,
		"filename":  summary.Filename,
		"gameCount": summary.GameCount,
	})
}

func (h *ImportHandler) ListAnalysesHandler(c echo.Context) error {
	analyses, err := repository.GetAnalyses()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": "failed to list analyses",
		})
	}

	result := make([]map[string]interface{}, len(analyses))
	for i, a := range analyses {
		result[i] = map[string]interface{}{
			"id":         a.ID,
			"color":      a.Color,
			"filename":   a.Filename,
			"gameCount":  a.GameCount,
			"uploadedAt": a.UploadedAt.Format("2006-01-02T15:04:05Z07:00"),
		}
	}

	return c.JSON(http.StatusOK, result)
}

func (h *ImportHandler) GetAnalysisHandler(c echo.Context) error {
	id := c.Param("id")

	detail, err := repository.GetAnalysisByID(id)
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
		"color":      detail.Color,
		"filename":   detail.Filename,
		"gameCount":  detail.GameCount,
		"uploadedAt": detail.UploadedAt.Format("2006-01-02T15:04:05Z07:00"),
		"results":    detail.Results,
	}

	return c.JSON(http.StatusOK, result)
}

func (h *ImportHandler) DeleteAnalysisHandler(c echo.Context) error {
	id := c.Param("id")

	err := repository.DeleteAnalysis(id)
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

	return c.JSON(http.StatusOK, map[string]string{
		"valid": "true",
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

	return c.JSON(http.StatusOK, map[string]string{
		"valid": "true",
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
