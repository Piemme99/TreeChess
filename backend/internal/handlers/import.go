package handlers

import (
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"regexp"
	"strconv"
	"strings"

	"github.com/labstack/echo/v4"

	"github.com/treechess/backend/config"
	"github.com/treechess/backend/internal/models"
	"github.com/treechess/backend/internal/repository"
	"github.com/treechess/backend/internal/services"
)

// validChessUsername matches alphanumeric usernames with hyphens and underscores (1-50 chars).
var validChessUsername = regexp.MustCompile(`^[a-zA-Z0-9_-]{1,50}$`)

type ImportHandler struct {
	importService   *services.ImportService
	lichessService  *services.LichessService
	chesscomService *services.ChesscomService
}

func NewImportHandler(importSvc *services.ImportService, lichessSvc *services.LichessService, chesscomSvc *services.ChesscomService) *ImportHandler {
	return &ImportHandler{
		importService:   importSvc,
		lichessService:  lichessSvc,
		chesscomService: chesscomSvc,
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
		log.Printf("PGN parse error for user %s: %v", userID, err)
		return BadRequestResponse(c, "failed to parse PGN file")
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
		log.Printf("PGN validation error: %v", err)
		return BadRequestResponse(c, "invalid PGN format")
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
	timeClass := c.QueryParam("timeClass")
	opening := c.QueryParam("opening")

	response, err := h.importService.GetAllGames(userID, limit, offset, timeClass, opening)
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

func (h *ImportHandler) BulkDeleteGamesHandler(c echo.Context) error {
	userID := c.Get("userID").(string)

	var req struct {
		Games []struct {
			AnalysisID string `json:"analysisId"`
			GameIndex  int    `json:"gameIndex"`
		} `json:"games"`
	}
	if err := c.Bind(&req); err != nil {
		return BadRequestResponse(c, "invalid request body")
	}

	if len(req.Games) == 0 {
		return BadRequestResponse(c, "games list is required")
	}
	if len(req.Games) > 100 {
		return BadRequestResponse(c, "cannot delete more than 100 games at once")
	}

	deleted := 0
	for _, g := range req.Games {
		if err := h.importService.CheckOwnership(g.AnalysisID, userID); err != nil {
			continue
		}
		if err := h.importService.DeleteGame(g.AnalysisID, g.GameIndex); err != nil {
			continue
		}
		deleted++
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"deleted": deleted,
	})
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
	if !validChessUsername.MatchString(req.Username) {
		return BadRequestResponse(c, "invalid username format")
	}

	pgnData, err := h.lichessService.FetchGames(req.Username, req.Options)
	if err != nil {
		if errors.Is(err, services.ErrLichessUserNotFound) {
			return NotFoundResponse(c, "Lichess user")
		}
		if errors.Is(err, services.ErrLichessRateLimited) {
			return ErrorResponse(c, http.StatusTooManyRequests, "Lichess rate limit exceeded, try again later")
		}
		log.Printf("Lichess fetch error for %s: %v", req.Username, err)
		return BadRequestResponse(c, "failed to fetch games from Lichess")
	}

	if len(pgnData) > config.MaxPGNFileSize {
		return ErrorResponse(c, http.StatusRequestEntityTooLarge, "PGN exceeds maximum allowed size")
	}

	filename := fmt.Sprintf("lichess_%s.pgn", req.Username)

	userID := c.Get("userID").(string)
	summary, _, err := h.importService.ParseAndAnalyze(filename, req.Username, userID, pgnData)
	if err != nil {
		log.Printf("Lichess import parse error for user %s: %v", userID, err)
		return BadRequestResponse(c, "failed to parse imported games")
	}

	return c.JSON(http.StatusCreated, map[string]interface{}{
		"id":        summary.ID,
		"username":  summary.Username,
		"filename":  summary.Filename,
		"gameCount": summary.GameCount,
		"source":    "lichess",
	})
}

func (h *ImportHandler) ChesscomImportHandler(c echo.Context) error {
	var req models.ChesscomImportRequest
	if err := c.Bind(&req); err != nil {
		return BadRequestResponse(c, "invalid request body")
	}

	if !RequireField(c, "username", req.Username) {
		return nil
	}
	if !validChessUsername.MatchString(req.Username) {
		return BadRequestResponse(c, "invalid username format")
	}

	pgnData, err := h.chesscomService.FetchGames(req.Username, req.Options)
	if err != nil {
		if errors.Is(err, services.ErrChesscomUserNotFound) {
			return NotFoundResponse(c, "Chess.com user")
		}
		if errors.Is(err, services.ErrChesscomRateLimited) {
			return ErrorResponse(c, http.StatusTooManyRequests, "Chess.com rate limit exceeded, try again later")
		}
		log.Printf("Chess.com fetch error for %s: %v", req.Username, err)
		return BadRequestResponse(c, "failed to fetch games from Chess.com")
	}

	if len(pgnData) > config.MaxPGNFileSize {
		return ErrorResponse(c, http.StatusRequestEntityTooLarge, "PGN exceeds maximum allowed size")
	}

	filename := fmt.Sprintf("chesscom_%s.pgn", req.Username)

	userID := c.Get("userID").(string)
	summary, _, err := h.importService.ParseAndAnalyze(filename, req.Username, userID, pgnData)
	if err != nil {
		log.Printf("Chess.com import parse error for user %s: %v", userID, err)
		return BadRequestResponse(c, "failed to parse imported games")
	}

	return c.JSON(http.StatusCreated, map[string]interface{}{
		"id":        summary.ID,
		"username":  summary.Username,
		"filename":  summary.Filename,
		"gameCount": summary.GameCount,
		"source":    "chesscom",
	})
}
