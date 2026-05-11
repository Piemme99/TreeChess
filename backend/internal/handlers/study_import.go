package handlers

import (
	"errors"
	"log/slog"
	"net/http"
	"strconv"

	"github.com/labstack/echo/v5"

	"github.com/kumquat/backend/internal/models"
	"github.com/kumquat/backend/internal/services"
)

// StudyImportHandler handles Lichess study import requests.
type StudyImportHandler struct {
	studyImportService *services.StudyImportService
}

// NewStudyImportHandler creates a new study import handler.
func NewStudyImportHandler(studyImportSvc *services.StudyImportService) *StudyImportHandler {
	return &StudyImportHandler{
		studyImportService: studyImportSvc,
	}
}

// PreviewStudyHandler handles GET /api/studies/preview?url={lichessStudyUrl}
func (h *StudyImportHandler) PreviewStudyHandler(c *echo.Context) error {
	rawURL := c.QueryParam("url")
	if !RequireField(c, "url", rawURL) {
		return nil
	}

	studyID, _, err := services.ParseStudyURL(rawURL)
	if err != nil {
		return BadRequestResponse(c, "invalid Lichess study URL")
	}

	userID := c.Get("userID").(string)
	authToken := h.studyImportService.GetLichessTokenForUser(userID)

	info, err := h.studyImportService.PreviewStudy(studyID, authToken)
	if err != nil {
		if errors.Is(err, services.ErrLichessStudyNotFound) {
			return NotFoundResponse(c, "Lichess study")
		}
		if errors.Is(err, services.ErrLichessStudyForbidden) {
			return ErrorResponse(c, http.StatusForbidden, "this study is private; link your Lichess account to access it")
		}
		if errors.Is(err, services.ErrLichessRateLimited) {
			return ErrorResponse(c, http.StatusTooManyRequests, "Lichess rate limit exceeded, try again later")
		}
		slog.Error("study preview failed", "user_id", userID, "error", err)
		return BadRequestResponse(c, "failed to fetch study from Lichess")
	}

	return c.JSON(http.StatusOK, info)
}

// ImportStudyHandler handles POST /api/studies/import
func (h *StudyImportHandler) ImportStudyHandler(c *echo.Context) error {
	var req models.StudyImportRequest
	if err := c.Bind(&req); err != nil {
		return BadRequestResponse(c, "invalid request body")
	}

	if !RequireField(c, "studyUrl", req.StudyURL) {
		return nil
	}

	studyID, _, err := services.ParseStudyURL(req.StudyURL)
	if err != nil {
		return BadRequestResponse(c, "invalid Lichess study URL")
	}

	if len(req.ChapterIndices) == 0 {
		return BadRequestResponse(c, "at least one chapter must be selected")
	}

	userID := c.Get("userID").(string)
	authToken := h.studyImportService.GetLichessTokenForUser(userID)

	if req.MergeAsOne {
		mergeResult, err := h.studyImportService.ImportStudyChaptersMerged(userID, studyID, authToken, req.ChapterIndices, req.MergeName, req.IncludeComments, req.IncludeHints, req.OwnerName)
		if err != nil {
			if errors.Is(err, services.ErrLichessStudyNotFound) {
				return NotFoundResponse(c, "Lichess study")
			}
			if errors.Is(err, services.ErrLichessStudyForbidden) {
				return ErrorResponse(c, http.StatusForbidden, "this study is private; link your Lichess account to access it")
			}
			if errors.Is(err, services.ErrLichessRateLimited) {
				return ErrorResponse(c, http.StatusTooManyRequests, "Lichess rate limit exceeded, try again later")
			}
			if errors.Is(err, services.ErrLimitReached) {
				return BadRequestResponse(c, "maximum repertoire limit reached")
			}
			if errors.Is(err, services.ErrMixedColors) {
				return BadRequestResponse(c, "cannot merge chapters with different colors (white/black)")
			}
			if errors.Is(err, services.ErrAllChaptersSkipped) {
				return BadRequestResponse(c, "selected chapters use a custom starting position and cannot be imported")
			}
			slog.Error("study merged import failed", "user_id", userID, "error", err)
			return BadRequestResponse(c, "failed to import study")
		}

		response := map[string]interface{}{
			"repertoires": []models.Repertoire{*mergeResult.Repertoire},
			"count":       1,
		}
		if len(mergeResult.Skipped) > 0 {
			response["skipped"] = mergeResult.Skipped
		}
		return c.JSON(http.StatusCreated, response)
	}

	result, err := h.studyImportService.ImportStudyChaptersWithCategory(userID, studyID, authToken, req.ChapterIndices, req.CreateCategory, req.CategoryName, req.IncludeComments, req.IncludeHints, req.OwnerName)
	if err != nil {
		if errors.Is(err, services.ErrLichessStudyNotFound) {
			return NotFoundResponse(c, "Lichess study")
		}
		if errors.Is(err, services.ErrLichessStudyForbidden) {
			return ErrorResponse(c, http.StatusForbidden, "this study is private; link your Lichess account to access it")
		}
		if errors.Is(err, services.ErrLichessRateLimited) {
			return ErrorResponse(c, http.StatusTooManyRequests, "Lichess rate limit exceeded, try again later")
		}
		if errors.Is(err, services.ErrLimitReached) {
			return BadRequestResponse(c, "maximum repertoire limit reached")
		}
		slog.Error("study import failed", "user_id", userID, "error", err)
		return BadRequestResponse(c, "failed to import study")
	}

	response := map[string]interface{}{
		"repertoires": result.Repertoires,
		"count":       len(result.Repertoires),
	}
	if result.Category != nil {
		response["category"] = result.Category
	}
	if len(result.Skipped) > 0 {
		response["skipped"] = result.Skipped
	}
	return c.JSON(http.StatusCreated, response)
}

// BrowseStudiesHandler handles GET /api/studies/browse?q=&topic=&order=&page=
func (h *StudyImportHandler) BrowseStudiesHandler(c *echo.Context) error {
	query := c.QueryParam("q")
	topic := c.QueryParam("topic")
	order := c.QueryParam("order")
	pageStr := c.QueryParam("page")

	if order == "" {
		order = "hot"
	}

	page := 1
	if pageStr != "" {
		if p, err := strconv.Atoi(pageStr); err == nil && p > 0 {
			page = p
		}
	}

	userID := c.Get("userID").(string)
	authToken := h.studyImportService.GetLichessTokenForUser(userID)

	var result *models.LichessStudySearchResponse
	var err error

	switch {
	case query != "":
		result, err = h.studyImportService.SearchStudies(query, order, page, authToken)
	case topic != "":
		result, err = h.studyImportService.BrowseStudiesByTopic(topic, order, page, authToken)
	default:
		result, err = h.studyImportService.BrowseAllStudies(order, page, authToken)
	}

	if err != nil {
		if errors.Is(err, services.ErrLichessRateLimited) {
			return ErrorResponse(c, http.StatusTooManyRequests, "Lichess rate limit exceeded, try again later")
		}
		slog.Error("study browse failed", "user_id", userID, "error", err)
		return BadRequestResponse(c, "failed to browse studies from Lichess")
	}

	return c.JSON(http.StatusOK, result)
}

// StudyTopicsHandler handles GET /api/studies/topics
func (h *StudyImportHandler) StudyTopicsHandler(c *echo.Context) error {
	result, err := h.studyImportService.GetPopularTopics()
	if err != nil {
		if errors.Is(err, services.ErrLichessRateLimited) {
			return ErrorResponse(c, http.StatusTooManyRequests, "Lichess rate limit exceeded, try again later")
		}
		slog.Error("study topics fetch failed", "error", err)
		return BadRequestResponse(c, "failed to fetch study topics from Lichess")
	}

	return c.JSON(http.StatusOK, result)
}
