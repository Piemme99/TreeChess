package handlers

import (
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"

	"github.com/labstack/echo/v4"

	"github.com/treechess/backend/config"
	"github.com/treechess/backend/internal/models"
	"github.com/treechess/backend/internal/repository"
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

func (h *ImportHandler) UploadHandler(c echo.Context) error {
	username := c.FormValue("username")
	if !RequireField(c, "username", username) {
		return nil
	}

	file, err := c.FormFile("file")
	if err != nil {
		return BadRequestResponse(c, "file is required")
	}

	if !strings.HasSuffix(strings.ToLower(file.Filename), ".pgn") {
		return BadRequestResponse(c, "file must have .pgn extension")
	}

	if file.Size > config.MaxPGNFileSize {
		return ErrorResponse(c, http.StatusRequestEntityTooLarge, "file exceeds maximum allowed size")
	}

	src, err := file.Open()
	if err != nil {
		return InternalErrorResponse(c, "failed to read file")
	}
	defer src.Close()

	limitedReader := io.LimitReader(src, config.MaxPGNFileSize+1)
	pgnData, err := io.ReadAll(limitedReader)
	if err != nil {
		return InternalErrorResponse(c, "failed to read file content")
	}

	if len(pgnData) > config.MaxPGNFileSize {
		return ErrorResponse(c, http.StatusRequestEntityTooLarge, "file exceeds maximum allowed size")
	}

	userID := c.Get("userID").(string)
	summary, _, err := h.importService.ParseAndAnalyze(file.Filename, username, userID, string(pgnData))
	if err != nil {
		return BadRequestResponse(c, fmt.Sprintf("failed to parse and analyze PGN: %v", err))
	}

	return c.JSON(http.StatusCreated, map[string]interface{}{
		"id":        summary.ID,
		"username":  summary.Username,
		"filename":  summary.Filename,
		"gameCount": summary.GameCount,
	})
}

func (h *ImportHandler) ListAnalysesHandler(c echo.Context) error {
	userID := c.Get("userID").(string)
	analyses, err := h.importService.GetAnalyses(userID)
	if err != nil {
		return InternalErrorResponse(c, "failed to list analyses")
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
	userID := c.Get("userID").(string)
	id, ok := ValidateUUIDParam(c, "id")
	if !ok {
		return nil
	}

	if err := h.importService.CheckOwnership(id, userID); err != nil {
		return NotFoundResponse(c, "analysis")
	}

	detail, err := h.importService.GetAnalysisByID(id)
	if err != nil {
		if errors.Is(err, repository.ErrAnalysisNotFound) {
			return NotFoundResponse(c, "analysis")
		}
		return InternalErrorResponse(c, "failed to get analysis")
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"id":         detail.ID,
		"username":   detail.Username,
		"filename":   detail.Filename,
		"gameCount":  detail.GameCount,
		"uploadedAt": detail.UploadedAt.Format("2006-01-02T15:04:05Z07:00"),
		"results":    detail.Results,
	})
}

func (h *ImportHandler) DeleteAnalysisHandler(c echo.Context) error {
	userID := c.Get("userID").(string)
	id, ok := ValidateUUIDParam(c, "id")
	if !ok {
		return nil
	}

	if err := h.importService.CheckOwnership(id, userID); err != nil {
		return NotFoundResponse(c, "analysis")
	}

	err := h.importService.DeleteAnalysis(id)
	if err != nil {
		if errors.Is(err, repository.ErrAnalysisNotFound) {
			return NotFoundResponse(c, "analysis")
		}
		return InternalErrorResponse(c, "failed to delete analysis")
	}

	return c.NoContent(http.StatusNoContent)
}

func (h *ImportHandler) ValidatePGNHandler(c echo.Context) error {
	limitedReader := io.LimitReader(c.Request().Body, config.MaxPGNFileSize+1)
	pgnData, err := io.ReadAll(limitedReader)
	if err != nil {
		return BadRequestResponse(c, "failed to read request body")
	}

	if len(pgnData) > config.MaxPGNFileSize {
		return ErrorResponse(c, http.StatusRequestEntityTooLarge, "request body exceeds maximum allowed size")
	}

	err = h.importService.ValidatePGN(string(pgnData))
	if err != nil {
		return BadRequestResponse(c, fmt.Sprintf("invalid PGN: %v", err))
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
		return BadRequestResponse(c, "invalid request body")
	}

	if !RequireField(c, "fen", req.FEN) {
		return nil
	}
	if !RequireField(c, "san", req.SAN) {
		return nil
	}

	err := h.importService.ValidateMove(req.FEN, req.SAN)
	if err != nil {
		return BadRequestResponse(c, err.Error())
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"valid": true,
	})
}

func (h *ImportHandler) GetLegalMovesHandler(c echo.Context) error {
	fen := c.QueryParam("fen")
	if fen == "" {
		return BadRequestResponse(c, "fen parameter is required")
	}

	moves, err := h.importService.GetLegalMoves(fen)
	if err != nil {
		return BadRequestResponse(c, err.Error())
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"fen":   fen,
		"moves": moves,
	})
}

func (h *ImportHandler) GetGamesHandler(c echo.Context) error {
	userID := c.Get("userID").(string)
	limit := ParseIntQueryParam(c, "limit", config.DefaultGamesLimit, 1, config.MaxGamesLimit)
	offset := ParseIntQueryParam(c, "offset", 0, 0, 1000000)

	response, err := h.importService.GetAllGames(userID, limit, offset)
	if err != nil {
		return InternalErrorResponse(c, "failed to get games")
	}

	return c.JSON(http.StatusOK, response)
}

func (h *ImportHandler) DeleteGameHandler(c echo.Context) error {
	userID := c.Get("userID").(string)
	analysisID, ok := ValidateUUIDParam(c, "analysisId")
	if !ok {
		return nil
	}

	if err := h.importService.CheckOwnership(analysisID, userID); err != nil {
		return NotFoundResponse(c, "analysis")
	}

	gameIndexStr := c.Param("gameIndex")
	gameIndex, err := strconv.Atoi(gameIndexStr)
	if err != nil || gameIndex < 0 {
		return BadRequestResponse(c, "gameIndex must be a non-negative integer")
	}

	err = h.importService.DeleteGame(analysisID, gameIndex)
	if err != nil {
		if errors.Is(err, repository.ErrAnalysisNotFound) {
			return NotFoundResponse(c, "analysis")
		}
		if errors.Is(err, repository.ErrGameNotFound) {
			return NotFoundResponse(c, "game")
		}
		return InternalErrorResponse(c, "failed to delete game")
	}

	return c.NoContent(http.StatusNoContent)
}

func (h *ImportHandler) ReanalyzeGameHandler(c echo.Context) error {
	userID := c.Get("userID").(string)
	analysisID, ok := ValidateUUIDParam(c, "analysisId")
	if !ok {
		return nil
	}

	if err := h.importService.CheckOwnership(analysisID, userID); err != nil {
		return NotFoundResponse(c, "analysis")
	}

	gameIndexStr := c.Param("gameIndex")
	gameIndex, err := strconv.Atoi(gameIndexStr)
	if err != nil || gameIndex < 0 {
		return BadRequestResponse(c, "gameIndex must be a non-negative integer")
	}

	var req struct {
		RepertoireID string `json:"repertoireId"`
	}
	if err := c.Bind(&req); err != nil {
		return BadRequestResponse(c, "invalid request body")
	}

	if !RequireField(c, "repertoireId", req.RepertoireID) {
		return nil
	}
	if !ValidateUUIDField(c, "repertoireId", req.RepertoireID) {
		return nil
	}

	reanalyzed, err := h.importService.ReanalyzeGame(analysisID, gameIndex, req.RepertoireID)
	if err != nil {
		if errors.Is(err, repository.ErrAnalysisNotFound) {
			return NotFoundResponse(c, "analysis")
		}
		if errors.Is(err, repository.ErrGameNotFound) {
			return NotFoundResponse(c, "game")
		}
		if errors.Is(err, services.ErrRepertoireNotFound) {
			return NotFoundResponse(c, "repertoire")
		}
		if errors.Is(err, services.ErrColorMismatch) {
			return BadRequestResponse(c, err.Error())
		}
		return InternalErrorResponse(c, "failed to reanalyze game")
	}

	return c.JSON(http.StatusOK, reanalyzed)
}

func (h *ImportHandler) LichessImportHandler(c echo.Context) error {
	var req models.LichessImportRequest
	if err := c.Bind(&req); err != nil {
		return BadRequestResponse(c, "invalid request body")
	}

	if !RequireField(c, "username", req.Username) {
		return nil
	}

	pgnData, err := h.lichessService.FetchGames(req.Username, req.Options)
	if err != nil {
		if errors.Is(err, services.ErrLichessUserNotFound) {
			return NotFoundResponse(c, "Lichess user")
		}
		if errors.Is(err, services.ErrLichessRateLimited) {
			return ErrorResponse(c, http.StatusTooManyRequests, err.Error())
		}
		return BadRequestResponse(c, err.Error())
	}

	if len(pgnData) > config.MaxPGNFileSize {
		return ErrorResponse(c, http.StatusRequestEntityTooLarge, "PGN exceeds maximum allowed size")
	}

	filename := fmt.Sprintf("lichess_%s.pgn", req.Username)

	userID := c.Get("userID").(string)
	summary, _, err := h.importService.ParseAndAnalyze(filename, req.Username, userID, pgnData)
	if err != nil {
		return BadRequestResponse(c, fmt.Sprintf("failed to parse and analyze games: %v", err))
	}

	return c.JSON(http.StatusCreated, map[string]interface{}{
		"id":        summary.ID,
		"username":  summary.Username,
		"filename":  summary.Filename,
		"gameCount": summary.GameCount,
		"source":    "lichess",
	})
}
