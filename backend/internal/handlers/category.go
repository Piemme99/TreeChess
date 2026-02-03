package handlers

import (
	"errors"
	"net/http"

	"github.com/google/uuid"
	"github.com/labstack/echo/v4"

	"github.com/treechess/backend/internal/models"
	"github.com/treechess/backend/internal/services"
)

// ListCategoriesHandler returns all categories for a user, optionally filtered by color
// GET /api/categories?color=white|black
func ListCategoriesHandler(svc *services.CategoryService) echo.HandlerFunc {
	return func(c echo.Context) error {
		userID := c.Get("userID").(string)
		colorParam := c.QueryParam("color")

		var colorFilter *models.Color
		if colorParam != "" {
			color := models.Color(colorParam)
			if color != models.ColorWhite && color != models.ColorBlack {
				return BadRequestResponse(c, "invalid color. must be 'white' or 'black'")
			}
			colorFilter = &color
		}

		categories, err := svc.ListCategories(userID, colorFilter)
		if err != nil {
			return InternalErrorResponse(c, "failed to list categories")
		}

		// Return empty array instead of null
		if categories == nil {
			categories = []models.Category{}
		}

		return c.JSON(http.StatusOK, categories)
	}
}

// CreateCategoryHandler creates a new category
// POST /api/categories
func CreateCategoryHandler(svc *services.CategoryService) echo.HandlerFunc {
	return func(c echo.Context) error {
		userID := c.Get("userID").(string)

		var req models.CreateCategoryRequest
		if err := c.Bind(&req); err != nil {
			return BadRequestResponse(c, "invalid request body")
		}

		if req.Name == "" {
			return BadRequestResponse(c, "name is required")
		}

		if req.Color != models.ColorWhite && req.Color != models.ColorBlack {
			return BadRequestResponse(c, "invalid color. must be 'white' or 'black'")
		}

		cat, err := svc.CreateCategory(userID, req.Name, req.Color)
		if err != nil {
			if errors.Is(err, services.ErrCategoryLimit) {
				return ConflictResponse(c, "maximum category limit reached (50)")
			}
			if errors.Is(err, services.ErrNameRequired) {
				return BadRequestResponse(c, "name is required")
			}
			if errors.Is(err, services.ErrNameTooLong) {
				return BadRequestResponse(c, "name must be 100 characters or less")
			}
			return InternalErrorResponse(c, "failed to create category")
		}

		return c.JSON(http.StatusCreated, cat)
	}
}

// GetCategoryHandler returns a single category by ID with its repertoires
// GET /api/categories/:id
func GetCategoryHandler(svc *services.CategoryService) echo.HandlerFunc {
	return func(c echo.Context) error {
		userID := c.Get("userID").(string)
		idParam := c.Param("id")

		// Validate ID is a valid UUID
		if _, err := uuid.Parse(idParam); err != nil {
			return BadRequestResponse(c, "id must be a valid UUID")
		}

		if err := svc.CheckOwnership(idParam, userID); err != nil {
			return NotFoundResponse(c, "category")
		}

		catWithReps, err := svc.GetCategoryWithRepertoires(idParam)
		if err != nil {
			if errors.Is(err, services.ErrCategoryNotFound) {
				return NotFoundResponse(c, "category")
			}
			return InternalErrorResponse(c, "failed to get category")
		}

		return c.JSON(http.StatusOK, catWithReps)
	}
}

// UpdateCategoryHandler renames a category
// PATCH /api/categories/:id
func UpdateCategoryHandler(svc *services.CategoryService) echo.HandlerFunc {
	return func(c echo.Context) error {
		userID := c.Get("userID").(string)
		idParam := c.Param("id")

		// Validate ID is a valid UUID
		if _, err := uuid.Parse(idParam); err != nil {
			return BadRequestResponse(c, "id must be a valid UUID")
		}

		if err := svc.CheckOwnership(idParam, userID); err != nil {
			return NotFoundResponse(c, "category")
		}

		var req models.UpdateCategoryRequest
		if err := c.Bind(&req); err != nil {
			return BadRequestResponse(c, "invalid request body")
		}

		cat, err := svc.RenameCategory(idParam, req.Name)
		if err != nil {
			if errors.Is(err, services.ErrCategoryNotFound) {
				return NotFoundResponse(c, "category")
			}
			if errors.Is(err, services.ErrNameRequired) {
				return BadRequestResponse(c, "name is required")
			}
			if errors.Is(err, services.ErrNameTooLong) {
				return BadRequestResponse(c, "name must be 100 characters or less")
			}
			return InternalErrorResponse(c, "failed to update category")
		}

		return c.JSON(http.StatusOK, cat)
	}
}

// DeleteCategoryHandler deletes a category and all its repertoires
// DELETE /api/categories/:id
func DeleteCategoryHandler(svc *services.CategoryService) echo.HandlerFunc {
	return func(c echo.Context) error {
		userID := c.Get("userID").(string)
		idParam := c.Param("id")

		// Validate ID is a valid UUID
		if _, err := uuid.Parse(idParam); err != nil {
			return BadRequestResponse(c, "id must be a valid UUID")
		}

		if err := svc.CheckOwnership(idParam, userID); err != nil {
			return NotFoundResponse(c, "category")
		}

		err := svc.DeleteCategory(idParam)
		if err != nil {
			if errors.Is(err, services.ErrCategoryNotFound) {
				return NotFoundResponse(c, "category")
			}
			return InternalErrorResponse(c, "failed to delete category")
		}

		return c.NoContent(http.StatusNoContent)
	}
}

// AssignCategoryHandler assigns a repertoire to a category (or removes from category)
// PATCH /api/repertoires/:id/category
func AssignCategoryHandler(svc *services.RepertoireService, catSvc *services.CategoryService) echo.HandlerFunc {
	return func(c echo.Context) error {
		userID := c.Get("userID").(string)
		idParam := c.Param("id")

		// Validate repertoire ID is a valid UUID
		if _, err := uuid.Parse(idParam); err != nil {
			return BadRequestResponse(c, "id must be a valid UUID")
		}

		if err := svc.CheckOwnership(idParam, userID); err != nil {
			return NotFoundResponse(c, "repertoire")
		}

		var req models.AssignCategoryRequest
		if err := c.Bind(&req); err != nil {
			return BadRequestResponse(c, "invalid request body")
		}

		// If categoryId is provided, validate it belongs to the user
		if req.CategoryID != nil && *req.CategoryID != "" {
			if _, err := uuid.Parse(*req.CategoryID); err != nil {
				return BadRequestResponse(c, "categoryId must be a valid UUID")
			}
			if err := catSvc.CheckOwnership(*req.CategoryID, userID); err != nil {
				return NotFoundResponse(c, "category")
			}
		}

		// Convert empty string to nil for removing from category
		categoryID := req.CategoryID
		if categoryID != nil && *categoryID == "" {
			categoryID = nil
		}

		rep, err := svc.AssignToCategory(idParam, categoryID)
		if err != nil {
			if errors.Is(err, services.ErrNotFound) {
				return NotFoundResponse(c, "repertoire")
			}
			return InternalErrorResponse(c, "failed to assign category")
		}

		return c.JSON(http.StatusOK, rep)
	}
}
