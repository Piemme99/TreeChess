package handlers

import (
	"errors"
	"log"
	"net/http"

	"github.com/labstack/echo/v4"

	"github.com/treechess/backend/internal/models"
	"github.com/treechess/backend/internal/services"
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
func (h *StudyImportHandler) PreviewStudyHandler(c echo.Context) error {
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
		log.Printf("Study preview error for user %s: %v", userID, err)
		return BadRequestResponse(c, "failed to fetch study from Lichess")
	}

	return c.JSON(http.StatusOK, info)
}

// ImportStudyHandler handles POST /api/studies/import
func (h *StudyImportHandler) ImportStudyHandler(c echo.Context) error {
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
		merged, err := h.studyImportService.ImportStudyChaptersMerged(userID, studyID, authToken, req.ChapterIndices, req.MergeName)
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
			log.Printf("Study merged import error for user %s: %v", userID, err)
			return BadRequestResponse(c, "failed to import study")
		}

		return c.JSON(http.StatusCreated, map[string]interface{}{
			"repertoires": []models.Repertoire{*merged},
			"count":       1,
		})
	}

	result, err := h.studyImportService.ImportStudyChaptersWithCategory(userID, studyID, authToken, req.ChapterIndices, req.CreateCategory, req.CategoryName)
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
		log.Printf("Study import error for user %s: %v", userID, err)
		return BadRequestResponse(c, "failed to import study")
	}

	response := map[string]interface{}{
		"repertoires": result.Repertoires,
		"count":       len(result.Repertoires),
	}
	if result.Category != nil {
		response["category"] = result.Category
	}
	return c.JSON(http.StatusCreated, response)
}
