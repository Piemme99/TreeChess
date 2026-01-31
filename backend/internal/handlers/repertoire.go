package handlers

import (
	"errors"
	"net/http"

	"github.com/google/uuid"
	"github.com/labstack/echo/v4"

	"github.com/treechess/backend/internal/models"
	"github.com/treechess/backend/internal/services"
)

// ListRepertoiresHandler returns all repertoires, optionally filtered by color
// GET /api/repertoires?color=white|black
func ListRepertoiresHandler(svc *services.RepertoireService) echo.HandlerFunc {
	return func(c echo.Context) error {
		userID := c.Get("userID").(string)
		colorParam := c.QueryParam("color")

		var colorFilter *models.Color
		if colorParam != "" {
			color := models.Color(colorParam)
			if color != models.ColorWhite && color != models.ColorBlack {
				return c.JSON(http.StatusBadRequest, map[string]string{
					"error": "invalid color. must be 'white' or 'black'",
				})
			}
			colorFilter = &color
		}

		repertoires, err := svc.ListRepertoires(userID, colorFilter)
		if err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{
				"error": "failed to list repertoires",
			})
		}

		// Return empty array instead of null
		if repertoires == nil {
			repertoires = []models.Repertoire{}
		}

		return c.JSON(http.StatusOK, repertoires)
	}
}

// CreateRepertoireHandler creates a new repertoire
// POST /api/repertoires
func CreateRepertoireHandler(svc *services.RepertoireService) echo.HandlerFunc {
	return func(c echo.Context) error {
		userID := c.Get("userID").(string)

		var req models.CreateRepertoireRequest
		if err := c.Bind(&req); err != nil {
			return c.JSON(http.StatusBadRequest, map[string]string{
				"error": "invalid request body",
			})
		}

		if req.Name == "" {
			return c.JSON(http.StatusBadRequest, map[string]string{
				"error": "name is required",
			})
		}

		if req.Color != models.ColorWhite && req.Color != models.ColorBlack {
			return c.JSON(http.StatusBadRequest, map[string]string{
				"error": "invalid color. must be 'white' or 'black'",
			})
		}

		rep, err := svc.CreateRepertoire(userID, req.Name, req.Color)
		if err != nil {
			if errors.Is(err, services.ErrLimitReached) {
				return c.JSON(http.StatusConflict, map[string]string{
					"error": "maximum repertoire limit reached (50)",
				})
			}
			if errors.Is(err, services.ErrNameRequired) {
				return c.JSON(http.StatusBadRequest, map[string]string{
					"error": "name is required",
				})
			}
			if errors.Is(err, services.ErrNameTooLong) {
				return c.JSON(http.StatusBadRequest, map[string]string{
					"error": "name must be 100 characters or less",
				})
			}
			return c.JSON(http.StatusInternalServerError, map[string]string{
				"error": "failed to create repertoire",
			})
		}

		return c.JSON(http.StatusCreated, rep)
	}
}

// GetRepertoireHandler returns a single repertoire by ID
// GET /api/repertoire/:id
func GetRepertoireHandler(svc *services.RepertoireService) echo.HandlerFunc {
	return func(c echo.Context) error {
		userID := c.Get("userID").(string)
		idParam := c.Param("id")

		// Validate ID is a valid UUID
		if _, err := uuid.Parse(idParam); err != nil {
			return c.JSON(http.StatusBadRequest, map[string]string{
				"error": "id must be a valid UUID",
			})
		}

		if err := svc.CheckOwnership(idParam, userID); err != nil {
			return c.JSON(http.StatusNotFound, map[string]string{"error": "repertoire not found"})
		}

		rep, err := svc.GetRepertoire(idParam)
		if err != nil {
			if errors.Is(err, services.ErrNotFound) {
				return c.JSON(http.StatusNotFound, map[string]string{
					"error": "repertoire not found",
				})
			}
			return c.JSON(http.StatusInternalServerError, map[string]string{
				"error": "failed to get repertoire",
			})
		}

		return c.JSON(http.StatusOK, rep)
	}
}

// UpdateRepertoireHandler renames a repertoire
// PATCH /api/repertoire/:id
func UpdateRepertoireHandler(svc *services.RepertoireService) echo.HandlerFunc {
	return func(c echo.Context) error {
		userID := c.Get("userID").(string)
		idParam := c.Param("id")

		// Validate ID is a valid UUID
		if _, err := uuid.Parse(idParam); err != nil {
			return c.JSON(http.StatusBadRequest, map[string]string{
				"error": "id must be a valid UUID",
			})
		}

		if err := svc.CheckOwnership(idParam, userID); err != nil {
			return c.JSON(http.StatusNotFound, map[string]string{"error": "repertoire not found"})
		}

		var req models.UpdateRepertoireRequest
		if err := c.Bind(&req); err != nil {
			return c.JSON(http.StatusBadRequest, map[string]string{
				"error": "invalid request body",
			})
		}

		rep, err := svc.RenameRepertoire(idParam, req.Name)
		if err != nil {
			if errors.Is(err, services.ErrNotFound) {
				return c.JSON(http.StatusNotFound, map[string]string{
					"error": "repertoire not found",
				})
			}
			if errors.Is(err, services.ErrNameRequired) {
				return c.JSON(http.StatusBadRequest, map[string]string{
					"error": "name is required",
				})
			}
			if errors.Is(err, services.ErrNameTooLong) {
				return c.JSON(http.StatusBadRequest, map[string]string{
					"error": "name must be 100 characters or less",
				})
			}
			return c.JSON(http.StatusInternalServerError, map[string]string{
				"error": "failed to update repertoire",
			})
		}

		return c.JSON(http.StatusOK, rep)
	}
}

// DeleteRepertoireHandler deletes a repertoire by ID
// DELETE /api/repertoire/:id
func DeleteRepertoireHandler(svc *services.RepertoireService) echo.HandlerFunc {
	return func(c echo.Context) error {
		userID := c.Get("userID").(string)
		idParam := c.Param("id")

		// Validate ID is a valid UUID
		if _, err := uuid.Parse(idParam); err != nil {
			return c.JSON(http.StatusBadRequest, map[string]string{
				"error": "id must be a valid UUID",
			})
		}

		if err := svc.CheckOwnership(idParam, userID); err != nil {
			return c.JSON(http.StatusNotFound, map[string]string{"error": "repertoire not found"})
		}

		err := svc.DeleteRepertoire(idParam)
		if err != nil {
			if errors.Is(err, services.ErrNotFound) {
				return c.JSON(http.StatusNotFound, map[string]string{
					"error": "repertoire not found",
				})
			}
			return c.JSON(http.StatusInternalServerError, map[string]string{
				"error": "failed to delete repertoire",
			})
		}

		return c.NoContent(http.StatusNoContent)
	}
}

// AddNodeHandler adds a node to a repertoire
// POST /api/repertoire/:id/node
func AddNodeHandler(svc *services.RepertoireService) echo.HandlerFunc {
	return func(c echo.Context) error {
		userID := c.Get("userID").(string)
		idParam := c.Param("id")

		// Validate repertoire ID is a valid UUID
		if _, err := uuid.Parse(idParam); err != nil {
			return c.JSON(http.StatusBadRequest, map[string]string{
				"error": "repertoire id must be a valid UUID",
			})
		}

		if err := svc.CheckOwnership(idParam, userID); err != nil {
			return c.JSON(http.StatusNotFound, map[string]string{"error": "repertoire not found"})
		}

		var req models.AddNodeRequest
		if err := c.Bind(&req); err != nil {
			return c.JSON(http.StatusBadRequest, map[string]string{
				"error": "invalid request body",
			})
		}

		if req.ParentID == "" {
			return c.JSON(http.StatusBadRequest, map[string]string{
				"error": "parentId is required",
			})
		}

		// Validate parentId is a valid UUID
		if _, err := uuid.Parse(req.ParentID); err != nil {
			return c.JSON(http.StatusBadRequest, map[string]string{
				"error": "parentId must be a valid UUID",
			})
		}

		if req.Move == "" {
			return c.JSON(http.StatusBadRequest, map[string]string{
				"error": "move is required",
			})
		}

		rep, err := svc.AddNode(idParam, req)
		if err != nil {
			if errors.Is(err, services.ErrNotFound) {
				return c.JSON(http.StatusNotFound, map[string]string{
					"error": "repertoire not found",
				})
			}
			if errors.Is(err, services.ErrParentNotFound) {
				return c.JSON(http.StatusNotFound, map[string]string{
					"error": "parent node not found",
				})
			}
			if errors.Is(err, services.ErrInvalidMove) {
				return c.JSON(http.StatusBadRequest, map[string]string{
					"error": err.Error(),
				})
			}
			if errors.Is(err, services.ErrMoveExists) {
				return c.JSON(http.StatusConflict, map[string]string{
					"error": "move already exists in repertoire",
				})
			}
			return c.JSON(http.StatusInternalServerError, map[string]string{
				"error": "failed to add node",
			})
		}

		return c.JSON(http.StatusOK, rep)
	}
}

// ListTemplatesHandler returns available starter repertoire templates
// GET /api/repertoires/templates
func ListTemplatesHandler() echo.HandlerFunc {
	return func(c echo.Context) error {
		templates := services.ListTemplates()
		return c.JSON(http.StatusOK, templates)
	}
}

// SeedHandler creates starter repertoires from templates
// POST /api/repertoires/seed
func SeedHandler(svc *services.RepertoireService) echo.HandlerFunc {
	return func(c echo.Context) error {
		userID := c.Get("userID").(string)

		var req struct {
			TemplateIDs []string `json:"templateIds"`
		}
		if err := c.Bind(&req); err != nil {
			return c.JSON(http.StatusBadRequest, map[string]string{
				"error": "invalid request body",
			})
		}

		if len(req.TemplateIDs) == 0 {
			return c.JSON(http.StatusBadRequest, map[string]string{
				"error": "templateIds is required",
			})
		}

		repertoires, err := svc.SeedRepertoires(userID, req.TemplateIDs)
		if err != nil {
			if errors.Is(err, services.ErrLimitReached) {
				return c.JSON(http.StatusConflict, map[string]string{
					"error": "maximum repertoire limit reached (50)",
				})
			}
			return c.JSON(http.StatusBadRequest, map[string]string{
				"error": err.Error(),
			})
		}

		return c.JSON(http.StatusCreated, repertoires)
	}
}

// ExtractSubtreeHandler extracts a subtree into a new repertoire
// POST /api/repertoires/:id/extract
func ExtractSubtreeHandler(svc *services.RepertoireService) echo.HandlerFunc {
	return func(c echo.Context) error {
		userID := c.Get("userID").(string)
		idParam := c.Param("id")

		// Validate repertoire ID is a valid UUID
		if _, err := uuid.Parse(idParam); err != nil {
			return c.JSON(http.StatusBadRequest, map[string]string{
				"error": "repertoire id must be a valid UUID",
			})
		}

		if err := svc.CheckOwnership(idParam, userID); err != nil {
			return c.JSON(http.StatusNotFound, map[string]string{"error": "repertoire not found"})
		}

		var req models.ExtractSubtreeRequest
		if err := c.Bind(&req); err != nil {
			return c.JSON(http.StatusBadRequest, map[string]string{
				"error": "invalid request body",
			})
		}

		if req.NodeID == "" {
			return c.JSON(http.StatusBadRequest, map[string]string{
				"error": "nodeId is required",
			})
		}

		// Validate nodeId is a valid UUID
		if _, err := uuid.Parse(req.NodeID); err != nil {
			return c.JSON(http.StatusBadRequest, map[string]string{
				"error": "nodeId must be a valid UUID",
			})
		}

		result, err := svc.ExtractSubtree(userID, idParam, req.NodeID, req.Name)
		if err != nil {
			if errors.Is(err, services.ErrCannotExtractRoot) {
				return c.JSON(http.StatusBadRequest, map[string]string{
					"error": "cannot extract root node",
				})
			}
			if errors.Is(err, services.ErrNodeNotFound) {
				return c.JSON(http.StatusNotFound, map[string]string{
					"error": "node not found",
				})
			}
			if errors.Is(err, services.ErrLimitReached) {
				return c.JSON(http.StatusConflict, map[string]string{
					"error": "maximum repertoire limit reached (50)",
				})
			}
			if errors.Is(err, services.ErrNameTooLong) {
				return c.JSON(http.StatusBadRequest, map[string]string{
					"error": "name must be 100 characters or less",
				})
			}
			if errors.Is(err, services.ErrNotFound) {
				return c.JSON(http.StatusNotFound, map[string]string{
					"error": "repertoire not found",
				})
			}
			return c.JSON(http.StatusInternalServerError, map[string]string{
				"error": "failed to extract subtree",
			})
		}

		return c.JSON(http.StatusCreated, result)
	}
}

// MergeRepertoiresHandler creates a new repertoire by merging multiple source repertoires
// POST /api/repertoires/merge
func MergeRepertoiresHandler(svc *services.RepertoireService) echo.HandlerFunc {
	return func(c echo.Context) error {
		userID := c.Get("userID").(string)

		var req models.MergeRepertoiresRequest
		if err := c.Bind(&req); err != nil {
			return c.JSON(http.StatusBadRequest, map[string]string{
				"error": "invalid request body",
			})
		}

		if len(req.IDs) < 2 {
			return c.JSON(http.StatusBadRequest, map[string]string{
				"error": "at least two repertoire IDs are required",
			})
		}

		if req.Name == "" {
			return c.JSON(http.StatusBadRequest, map[string]string{
				"error": "name is required",
			})
		}

		// Validate all IDs are valid UUIDs and check ownership
		for _, id := range req.IDs {
			if _, err := uuid.Parse(id); err != nil {
				return c.JSON(http.StatusBadRequest, map[string]string{
					"error": "all IDs must be valid UUIDs",
				})
			}
			if err := svc.CheckOwnership(id, userID); err != nil {
				return c.JSON(http.StatusNotFound, map[string]string{
					"error": "repertoire not found",
				})
			}
		}

		result, err := svc.MergeRepertoires(userID, req.IDs, req.Name)
		if err != nil {
			if errors.Is(err, services.ErrMergeMinimumTwo) {
				return c.JSON(http.StatusBadRequest, map[string]string{
					"error": err.Error(),
				})
			}
			if errors.Is(err, services.ErrMergeColorMismatch) {
				return c.JSON(http.StatusBadRequest, map[string]string{
					"error": "cannot merge repertoires of different colors",
				})
			}
			if errors.Is(err, services.ErrMergeDuplicateIDs) {
				return c.JSON(http.StatusBadRequest, map[string]string{
					"error": "duplicate repertoire IDs",
				})
			}
			if errors.Is(err, services.ErrNameRequired) {
				return c.JSON(http.StatusBadRequest, map[string]string{
					"error": "name is required",
				})
			}
			if errors.Is(err, services.ErrNameTooLong) {
				return c.JSON(http.StatusBadRequest, map[string]string{
					"error": "name must be 100 characters or less",
				})
			}
			if errors.Is(err, services.ErrNotFound) {
				return c.JSON(http.StatusNotFound, map[string]string{
					"error": "repertoire not found",
				})
			}
			return c.JSON(http.StatusInternalServerError, map[string]string{
				"error": "failed to merge repertoires",
			})
		}

		return c.JSON(http.StatusCreated, result)
	}
}

// UpdateNodeCommentHandler updates the comment on a specific node
// PATCH /api/repertoires/:id/nodes/:nodeId/comment
func UpdateNodeCommentHandler(svc *services.RepertoireService) echo.HandlerFunc {
	return func(c echo.Context) error {
		userID := c.Get("userID").(string)
		idParam := c.Param("id")
		nodeID := c.Param("nodeId")

		// Validate repertoire ID is a valid UUID
		if _, err := uuid.Parse(idParam); err != nil {
			return c.JSON(http.StatusBadRequest, map[string]string{
				"error": "repertoire id must be a valid UUID",
			})
		}

		// Validate nodeId is a valid UUID
		if _, err := uuid.Parse(nodeID); err != nil {
			return c.JSON(http.StatusBadRequest, map[string]string{
				"error": "node id must be a valid UUID",
			})
		}

		if err := svc.CheckOwnership(idParam, userID); err != nil {
			return c.JSON(http.StatusNotFound, map[string]string{"error": "repertoire not found"})
		}

		var req struct {
			Comment string `json:"comment"`
		}
		if err := c.Bind(&req); err != nil {
			return c.JSON(http.StatusBadRequest, map[string]string{
				"error": "invalid request body",
			})
		}

		rep, err := svc.UpdateNodeComment(idParam, nodeID, req.Comment)
		if err != nil {
			if errors.Is(err, services.ErrNotFound) {
				return c.JSON(http.StatusNotFound, map[string]string{
					"error": "repertoire not found",
				})
			}
			if errors.Is(err, services.ErrNodeNotFound) {
				return c.JSON(http.StatusNotFound, map[string]string{
					"error": "node not found",
				})
			}
			return c.JSON(http.StatusInternalServerError, map[string]string{
				"error": "failed to update comment",
			})
		}

		return c.JSON(http.StatusOK, rep)
	}
}

// DeleteNodeHandler deletes a node from a repertoire
// DELETE /api/repertoire/:id/node/:nodeId
func DeleteNodeHandler(svc *services.RepertoireService) echo.HandlerFunc {
	return func(c echo.Context) error {
		userID := c.Get("userID").(string)
		idParam := c.Param("id")
		nodeID := c.Param("nodeId")

		// Validate repertoire ID is a valid UUID
		if _, err := uuid.Parse(idParam); err != nil {
			return c.JSON(http.StatusBadRequest, map[string]string{
				"error": "repertoire id must be a valid UUID",
			})
		}

		// Validate nodeId is a valid UUID
		if _, err := uuid.Parse(nodeID); err != nil {
			return c.JSON(http.StatusBadRequest, map[string]string{
				"error": "node id must be a valid UUID",
			})
		}

		if err := svc.CheckOwnership(idParam, userID); err != nil {
			return c.JSON(http.StatusNotFound, map[string]string{"error": "repertoire not found"})
		}

		rep, err := svc.DeleteNode(idParam, nodeID)
		if err != nil {
			if errors.Is(err, services.ErrNotFound) {
				return c.JSON(http.StatusNotFound, map[string]string{
					"error": "repertoire not found",
				})
			}
			if errors.Is(err, services.ErrCannotDeleteRoot) {
				return c.JSON(http.StatusBadRequest, map[string]string{
					"error": "cannot delete root node",
				})
			}
			if errors.Is(err, services.ErrNodeNotFound) {
				return c.JSON(http.StatusNotFound, map[string]string{
					"error": "node not found",
				})
			}
			return c.JSON(http.StatusInternalServerError, map[string]string{
				"error": "failed to delete node",
			})
		}

		return c.JSON(http.StatusOK, rep)
	}
}
