package handlers

import (
	"errors"
	"net/http"

	"github.com/google/uuid"
	"github.com/labstack/echo/v5"

	"github.com/kumquat/backend/internal/models"
	"github.com/kumquat/backend/internal/services"
)

// ListRepertoiresHandler returns all repertoires, optionally filtered by color
// GET /api/repertoires?color=white|black
func ListRepertoiresHandler(svc *services.RepertoireService) echo.HandlerFunc {
	return func(c *echo.Context) error {
		userID, ok := mustUserID(c)
		if !ok {
			return nil
		}
		colorParam := c.QueryParam("color")

		var colorFilter *models.Color
		if colorParam != "" {
			color := models.Color(colorParam)
			if color != models.ColorWhite && color != models.ColorBlack {
				return BadRequestResponse(c, "invalid color. must be 'white' or 'black'")
			}
			colorFilter = &color
		}

		repertoires, err := svc.ListRepertoires(userID, colorFilter)
		if err != nil {
			return InternalErrorResponse(c, "failed to list repertoires")
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
	return func(c *echo.Context) error {
		userID, ok := mustUserID(c)
		if !ok {
			return nil
		}

		var req models.CreateRepertoireRequest
		if err := c.Bind(&req); err != nil {
			return BadRequestResponse(c, "invalid request body")
		}

		if req.Name == "" {
			return BadRequestResponse(c, "name is required")
		}

		if req.Color != models.ColorWhite && req.Color != models.ColorBlack {
			return BadRequestResponse(c, "invalid color. must be 'white' or 'black'")
		}

		// Default isPublic to false if not provided (private by default)
		isPublic := false
		if req.IsPublic != nil {
			isPublic = *req.IsPublic
		}

		rep, err := svc.CreateRepertoireWithVisibility(userID, req.Name, req.Description, req.Color, isPublic)
		if err != nil {
			switch {
			case errors.Is(err, services.ErrLimitReached):
				return ConflictResponse(c, "maximum repertoire limit reached (50)")
			case errors.Is(err, services.ErrNameRequired):
				return BadRequestResponse(c, "name is required")
			case errors.Is(err, services.ErrNameTooLong):
				return BadRequestResponse(c, "name must be 100 characters or less")
			case errors.Is(err, services.ErrDescriptionTooLong):
				return BadRequestResponse(c, "description must be 500 characters or less")
			default:
				return InternalErrorResponse(c, "failed to create repertoire")
			}
		}

		return c.JSON(http.StatusCreated, rep)
	}
}

// GetRepertoireHandler returns a single repertoire by ID
// GET /api/repertoire/:id
func GetRepertoireHandler(svc *services.RepertoireService) echo.HandlerFunc {
	return func(c *echo.Context) error {
		userID, ok := mustUserID(c)
		if !ok {
			return nil
		}
		idParam, ok := ValidateUUIDParam(c, "id")
		if !ok {
			return nil
		}

		if !requireOwnership(c, svc, idParam, userID) {
			return nil
		}

		rep, err := svc.GetRepertoire(idParam)
		if err != nil {
			return mapRepertoireServiceError(c, err, "failed to get repertoire")
		}

		return c.JSON(http.StatusOK, rep)
	}
}

// UpdateRepertoireHandler renames a repertoire
// PATCH /api/repertoire/:id
func UpdateRepertoireHandler(svc *services.RepertoireService) echo.HandlerFunc {
	return func(c *echo.Context) error {
		userID, ok := mustUserID(c)
		if !ok {
			return nil
		}
		idParam, ok := ValidateUUIDParam(c, "id")
		if !ok {
			return nil
		}

		if !requireOwnership(c, svc, idParam, userID) {
			return nil
		}

		var req models.UpdateRepertoireRequest
		if err := c.Bind(&req); err != nil {
			return BadRequestResponse(c, "invalid request body")
		}

		if req.Name == nil && req.Description == nil {
			return BadRequestResponse(c, "at least one of name or description must be provided")
		}

		// Start with the current repertoire state
		var rep *models.Repertoire
		var err error

		// Update name if provided
		if req.Name != nil {
			rep, err = svc.RenameRepertoire(userID, idParam, *req.Name)
			if err != nil {
				switch {
				case errors.Is(err, services.ErrNameRequired):
					return BadRequestResponse(c, "name is required")
				case errors.Is(err, services.ErrNameTooLong):
					return BadRequestResponse(c, "name must be 100 characters or less")
				default:
					return mapRepertoireServiceError(c, err, "failed to update repertoire")
				}
			}
		}

		// Update description if provided
		if req.Description != nil {
			rep, err = svc.UpdateDescription(userID, idParam, *req.Description)
			if err != nil {
				if errors.Is(err, services.ErrDescriptionTooLong) {
					return BadRequestResponse(c, "description must be 500 characters or less")
				}
				return mapRepertoireServiceError(c, err, "failed to update repertoire")
			}
		}

		return c.JSON(http.StatusOK, rep)
	}
}

// DeleteRepertoireHandler deletes a repertoire by ID
// DELETE /api/repertoire/:id
func DeleteRepertoireHandler(svc *services.RepertoireService) echo.HandlerFunc {
	return func(c *echo.Context) error {
		userID, ok := mustUserID(c)
		if !ok {
			return nil
		}
		idParam, ok := ValidateUUIDParam(c, "id")
		if !ok {
			return nil
		}

		if !requireOwnership(c, svc, idParam, userID) {
			return nil
		}

		if err := svc.DeleteRepertoire(userID, idParam); err != nil {
			return mapRepertoireServiceError(c, err, "failed to delete repertoire")
		}

		return c.NoContent(http.StatusNoContent)
	}
}

// AddNodeHandler adds a node to a repertoire
// POST /api/repertoire/:id/node
func AddNodeHandler(svc *services.RepertoireService) echo.HandlerFunc {
	return func(c *echo.Context) error {
		userID, ok := mustUserID(c)
		if !ok {
			return nil
		}
		idParam, ok := validateRepertoireID(c)
		if !ok {
			return nil
		}

		if !requireOwnership(c, svc, idParam, userID) {
			return nil
		}

		var req models.AddNodeRequest
		if err := c.Bind(&req); err != nil {
			return BadRequestResponse(c, "invalid request body")
		}

		if !RequireField(c, "parentId", req.ParentID) {
			return nil
		}
		if !ValidateUUIDField(c, "parentId", req.ParentID) {
			return nil
		}
		if !RequireField(c, "move", req.Move) {
			return nil
		}

		rep, err := svc.AddNode(userID, idParam, req)
		if err != nil {
			switch {
			case errors.Is(err, services.ErrParentNotFound):
				return NotFoundResponse(c, "parent node")
			case errors.Is(err, services.ErrInvalidMove):
				return BadRequestResponse(c, err.Error())
			case errors.Is(err, services.ErrMoveExists):
				return ConflictResponse(c, "move already exists in repertoire")
			default:
				return mapRepertoireServiceError(c, err, "failed to add node")
			}
		}

		return c.JSON(http.StatusOK, rep)
	}
}

// ListTemplatesHandler returns available starter repertoire templates
// GET /api/repertoires/templates
func ListTemplatesHandler() echo.HandlerFunc {
	return func(c *echo.Context) error {
		templates := services.ListTemplates()
		return c.JSON(http.StatusOK, templates)
	}
}

// SeedHandler creates starter repertoires from templates
// POST /api/repertoires/seed
func SeedHandler(svc *services.RepertoireService) echo.HandlerFunc {
	return func(c *echo.Context) error {
		userID, ok := mustUserID(c)
		if !ok {
			return nil
		}

		var req struct {
			TemplateIDs []string `json:"templateIds"`
		}
		if err := c.Bind(&req); err != nil {
			return BadRequestResponse(c, "invalid request body")
		}

		if len(req.TemplateIDs) == 0 {
			return BadRequestResponse(c, "templateIds is required")
		}

		repertoires, err := svc.SeedRepertoires(userID, req.TemplateIDs)
		if err != nil {
			if errors.Is(err, services.ErrLimitReached) {
				return ConflictResponse(c, "maximum repertoire limit reached (50)")
			}
			return BadRequestResponse(c, "failed to seed repertoires")
		}

		return c.JSON(http.StatusCreated, repertoires)
	}
}

// ExtractSubtreeHandler extracts a subtree into a new repertoire
// POST /api/repertoires/:id/extract
func ExtractSubtreeHandler(svc *services.RepertoireService) echo.HandlerFunc {
	return func(c *echo.Context) error {
		userID, ok := mustUserID(c)
		if !ok {
			return nil
		}
		idParam, ok := validateRepertoireID(c)
		if !ok {
			return nil
		}

		if !requireOwnership(c, svc, idParam, userID) {
			return nil
		}

		var req models.ExtractSubtreeRequest
		if err := c.Bind(&req); err != nil {
			return BadRequestResponse(c, "invalid request body")
		}

		if !RequireField(c, "nodeId", req.NodeID) {
			return nil
		}
		if !ValidateUUIDField(c, "nodeId", req.NodeID) {
			return nil
		}

		result, err := svc.ExtractSubtree(userID, idParam, req.NodeID, req.Name)
		if err != nil {
			switch {
			case errors.Is(err, services.ErrCannotExtractRoot):
				return BadRequestResponse(c, "cannot extract root node")
			case errors.Is(err, services.ErrLimitReached):
				return ConflictResponse(c, "maximum repertoire limit reached (50)")
			case errors.Is(err, services.ErrNameTooLong):
				return BadRequestResponse(c, "name must be 100 characters or less")
			default:
				return mapRepertoireServiceError(c, err, "failed to extract subtree")
			}
		}

		return c.JSON(http.StatusCreated, result)
	}
}

// MergeRepertoiresHandler creates a new repertoire by merging multiple source repertoires
// POST /api/repertoires/merge
func MergeRepertoiresHandler(svc *services.RepertoireService) echo.HandlerFunc {
	return func(c *echo.Context) error {
		userID, ok := mustUserID(c)
		if !ok {
			return nil
		}

		var req models.MergeRepertoiresRequest
		if err := c.Bind(&req); err != nil {
			return BadRequestResponse(c, "invalid request body")
		}

		if len(req.IDs) < 2 {
			return BadRequestResponse(c, "at least two repertoire IDs are required")
		}

		if req.Name == "" {
			return BadRequestResponse(c, "name is required")
		}

		// Validate all IDs are valid UUIDs and check ownership
		for _, id := range req.IDs {
			if _, err := uuid.Parse(id); err != nil {
				return BadRequestResponse(c, "all IDs must be valid UUIDs")
			}
			if err := svc.CheckOwnership(id, userID); err != nil {
				return NotFoundResponse(c, "repertoire")
			}
		}

		result, err := svc.MergeRepertoires(userID, req.IDs, req.Name)
		if err != nil {
			switch {
			case errors.Is(err, services.ErrMergeMinimumTwo):
				return BadRequestResponse(c, err.Error())
			case errors.Is(err, services.ErrMergeColorMismatch):
				return BadRequestResponse(c, "cannot merge repertoires of different colors")
			case errors.Is(err, services.ErrMergeDuplicateIDs):
				return BadRequestResponse(c, "duplicate repertoire IDs")
			case errors.Is(err, services.ErrNameRequired):
				return BadRequestResponse(c, "name is required")
			case errors.Is(err, services.ErrNameTooLong):
				return BadRequestResponse(c, "name must be 100 characters or less")
			default:
				return mapRepertoireServiceError(c, err, "failed to merge repertoires")
			}
		}

		return c.JSON(http.StatusCreated, result)
	}
}

// MergeTranspositionsHandler merges transpositions within a single repertoire
// POST /api/repertoires/:id/merge-transpositions
func MergeTranspositionsHandler(svc *services.RepertoireService) echo.HandlerFunc {
	return func(c *echo.Context) error {
		userID, ok := mustUserID(c)
		if !ok {
			return nil
		}
		idParam, ok := validateRepertoireID(c)
		if !ok {
			return nil
		}

		if !requireOwnership(c, svc, idParam, userID) {
			return nil
		}

		rep, err := svc.MergeTranspositions(userID, idParam)
		if err != nil {
			return mapRepertoireServiceError(c, err, "failed to merge transpositions")
		}

		return c.JSON(http.StatusOK, rep)
	}
}

// UpdateNodeCommentHandler updates the comment on a specific node
// PATCH /api/repertoires/:id/nodes/:nodeId/comment
func UpdateNodeCommentHandler(svc *services.RepertoireService) echo.HandlerFunc {
	return func(c *echo.Context) error {
		target, ok := withNode(c, svc)
		if !ok {
			return nil
		}

		var req struct {
			Comment string `json:"comment"`
		}
		if err := c.Bind(&req); err != nil {
			return BadRequestResponse(c, "invalid request body")
		}

		rep, err := svc.UpdateNodeComment(target.UserID, target.RepID, target.NodeID, req.Comment)
		if err != nil {
			return mapRepertoireServiceError(c, err, "failed to update comment")
		}

		return c.JSON(http.StatusOK, rep)
	}
}

// UpdateNodeBranchNameHandler updates the branch name on a specific node
// PATCH /api/repertoires/:id/nodes/:nodeId/branch-name
func UpdateNodeBranchNameHandler(svc *services.RepertoireService) echo.HandlerFunc {
	return func(c *echo.Context) error {
		target, ok := withNode(c, svc)
		if !ok {
			return nil
		}

		var req struct {
			BranchName string `json:"branchName"`
		}
		if err := c.Bind(&req); err != nil {
			return BadRequestResponse(c, "invalid request body")
		}

		rep, err := svc.UpdateNodeBranchName(target.UserID, target.RepID, target.NodeID, req.BranchName)
		if err != nil {
			return mapRepertoireServiceError(c, err, "failed to update branch name")
		}

		return c.JSON(http.StatusOK, rep)
	}
}

// UpdateNodeBranchColorHandler updates the branch color on a specific node
// PATCH /api/repertoires/:id/nodes/:nodeId/branch-color
func UpdateNodeBranchColorHandler(svc *services.RepertoireService) echo.HandlerFunc {
	return func(c *echo.Context) error {
		target, ok := withNode(c, svc)
		if !ok {
			return nil
		}

		var req struct {
			BranchColor string `json:"branchColor"`
		}
		if err := c.Bind(&req); err != nil {
			return BadRequestResponse(c, "invalid request body")
		}

		rep, err := svc.UpdateNodeBranchColor(target.UserID, target.RepID, target.NodeID, req.BranchColor)
		if err != nil {
			if errors.Is(err, services.ErrInvalidBranchColor) {
				return BadRequestResponse(c, "invalid branch color")
			}
			return mapRepertoireServiceError(c, err, "failed to update branch color")
		}

		return c.JSON(http.StatusOK, rep)
	}
}

// UpdateNodeAnnotationsHandler replaces the arrows and highlights on a specific node
// PATCH /api/repertoires/:id/nodes/:nodeId/annotations
func UpdateNodeAnnotationsHandler(svc *services.RepertoireService) echo.HandlerFunc {
	return func(c *echo.Context) error {
		target, ok := withNode(c, svc)
		if !ok {
			return nil
		}

		var req struct {
			Arrows     []models.Arrow           `json:"arrows"`
			Highlights []models.SquareHighlight `json:"highlights"`
		}
		if err := c.Bind(&req); err != nil {
			return BadRequestResponse(c, "invalid request body")
		}

		rep, err := svc.UpdateNodeAnnotations(target.UserID, target.RepID, target.NodeID, req.Arrows, req.Highlights)
		if err != nil {
			if errors.Is(err, services.ErrInvalidAnnotation) {
				return BadRequestResponse(c, "invalid annotation")
			}
			return mapRepertoireServiceError(c, err, "failed to update annotations")
		}

		return c.JSON(http.StatusOK, rep)
	}
}

// ToggleNodeCollapsedHandler toggles the collapsed state on a specific node
// POST /api/repertoires/:id/nodes/:nodeId/toggle-collapsed
func ToggleNodeCollapsedHandler(svc *services.RepertoireService) echo.HandlerFunc {
	return func(c *echo.Context) error {
		target, ok := withNode(c, svc)
		if !ok {
			return nil
		}

		rep, err := svc.ToggleNodeCollapsed(target.UserID, target.RepID, target.NodeID)
		if err != nil {
			return mapRepertoireServiceError(c, err, "failed to toggle collapsed state")
		}

		return c.JSON(http.StatusOK, rep)
	}
}

// ExpandToNodeHandler expands all collapsed ancestors so the node becomes visible
// POST /api/repertoires/:id/nodes/:nodeId/expand-to
func ExpandToNodeHandler(svc *services.RepertoireService) echo.HandlerFunc {
	return func(c *echo.Context) error {
		target, ok := withNode(c, svc)
		if !ok {
			return nil
		}

		rep, err := svc.ExpandToNode(target.UserID, target.RepID, target.NodeID)
		if err != nil {
			return mapRepertoireServiceError(c, err, "failed to expand to node")
		}

		return c.JSON(http.StatusOK, rep)
	}
}

// SetMainLineHandler marks the path from root to the given node as the main line
// POST /api/repertoires/:id/nodes/:nodeId/set-main-line
func SetMainLineHandler(svc *services.RepertoireService) echo.HandlerFunc {
	return func(c *echo.Context) error {
		target, ok := withNode(c, svc)
		if !ok {
			return nil
		}

		rep, err := svc.SetMainLine(target.UserID, target.RepID, target.NodeID)
		if err != nil {
			return mapRepertoireServiceError(c, err, "failed to set main line")
		}

		return c.JSON(http.StatusOK, rep)
	}
}

// ClearMainLineHandler clears the main line from all nodes in a repertoire
// POST /api/repertoires/:id/clear-main-line
func ClearMainLineHandler(svc *services.RepertoireService) echo.HandlerFunc {
	return func(c *echo.Context) error {
		userID, ok := mustUserID(c)
		if !ok {
			return nil
		}
		idParam, ok := validateRepertoireID(c)
		if !ok {
			return nil
		}

		if !requireOwnership(c, svc, idParam, userID) {
			return nil
		}

		rep, err := svc.ClearMainLine(userID, idParam)
		if err != nil {
			return mapRepertoireServiceError(c, err, "failed to clear main line")
		}

		return c.JSON(http.StatusOK, rep)
	}
}

// DeleteNodeHandler deletes a node from a repertoire
// DELETE /api/repertoire/:id/node/:nodeId
func DeleteNodeHandler(svc *services.RepertoireService) echo.HandlerFunc {
	return func(c *echo.Context) error {
		target, ok := withNode(c, svc)
		if !ok {
			return nil
		}

		rep, err := svc.DeleteNode(target.UserID, target.RepID, target.NodeID)
		if err != nil {
			if errors.Is(err, services.ErrCannotDeleteRoot) {
				return BadRequestResponse(c, "cannot delete root node")
			}
			return mapRepertoireServiceError(c, err, "failed to delete node")
		}

		return c.JSON(http.StatusOK, rep)
	}
}

// UpdateVisibilityHandler updates the public/private visibility of a repertoire
// PATCH /api/repertoires/:id/visibility
func UpdateVisibilityHandler(svc *services.RepertoireService) echo.HandlerFunc {
	return func(c *echo.Context) error {
		userID, ok := mustUserID(c)
		if !ok {
			return nil
		}
		idParam, ok := ValidateUUIDParam(c, "id")
		if !ok {
			return nil
		}

		if !requireOwnership(c, svc, idParam, userID) {
			return nil
		}

		var req struct {
			IsPublic bool `json:"isPublic"`
		}
		if err := c.Bind(&req); err != nil {
			return BadRequestResponse(c, "invalid request body")
		}

		rep, err := svc.UpdateVisibility(userID, idParam, req.IsPublic)
		if err != nil {
			return mapRepertoireServiceError(c, err, "failed to update visibility")
		}

		return c.JSON(http.StatusOK, rep)
	}
}
