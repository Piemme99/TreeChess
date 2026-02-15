package services

import (
	"fmt"
	"strings"

	"github.com/google/uuid"
	"github.com/notnil/chess"

	"github.com/kumquat/backend/internal/models"
)

// TemplateLine represents a single named variation in a template.
// Moves is the full move sequence from the starting position to the end of the line.
// BranchName and BranchColor are applied to the node where this line first
// diverges from any sibling line (i.e. the characteristic move of the variation).
type TemplateLine struct {
	Moves       []string // Full SAN move sequence from the starting position
	BranchName  string   // Human-readable variation name (e.g. "Giuoco Piano")
	BranchColor string   // Hex color from the allowed branch color palette
}

// RepertoireTemplate represents a starter repertoire template with multiple
// named variation lines that share common opening moves.
type RepertoireTemplate struct {
	ID          string
	Name        string
	Color       models.Color
	Description string
	Lines       []TemplateLine
}

// RepertoireTemplateSummary is the public-facing summary of a template
type RepertoireTemplateSummary struct {
	ID          string       `json:"id"`
	Name        string       `json:"name"`
	Color       models.Color `json:"color"`
	Description string       `json:"description"`
}

// Branch color constants (matching frontend BRANCH_COLORS palette)
const (
	colorRed    = "#E74C3C"
	colorOrange = "#E67E22"
	colorYellow = "#F1C40F"
	colorGreen  = "#27AE60"
	colorTeal   = "#1ABC9C"
	colorBlue   = "#3498DB"
	colorPurple = "#9B59B6"
	colorPink   = "#E91E8F"
)

var starterTemplates = []RepertoireTemplate{
	// =====================================================================
	// White openings
	// =====================================================================
	{
		ID:          "italian",
		Name:        "Italian Game",
		Color:       models.ColorWhite,
		Description: "1.e4 e5 2.Nf3 Nc6 3.Bc4 — Giuoco Piano, Evans Gambit, Two Knights",
		Lines: []TemplateLine{
			{
				BranchName:  "Giuoco Piano",
				BranchColor: colorRed,
				Moves:       []string{"e4", "e5", "Nf3", "Nc6", "Bc4", "Bc5", "c3", "Nf6", "d4"},
			},
			{
				BranchName:  "Evans Gambit",
				BranchColor: colorBlue,
				Moves:       []string{"e4", "e5", "Nf3", "Nc6", "Bc4", "Bc5", "b4"},
			},
			{
				BranchName:  "Two Knights",
				BranchColor: colorGreen,
				Moves:       []string{"e4", "e5", "Nf3", "Nc6", "Bc4", "Nf6", "d4", "exd4", "O-O"},
			},
		},
	},
	{
		ID:          "london",
		Name:        "London System",
		Color:       models.ColorWhite,
		Description: "1.d4 d5 2.Bf4 — Classical, Anti-Sicilian, Symmetrical",
		Lines: []TemplateLine{
			{
				BranchName:  "Classical",
				BranchColor: colorBlue,
				Moves:       []string{"d4", "d5", "Bf4", "Nf6", "e3", "e6", "Nd2", "c5", "c3"},
			},
			{
				BranchName:  "Anti-c5",
				BranchColor: colorOrange,
				Moves:       []string{"d4", "d5", "Bf4", "c5", "e3", "Nc6", "c3", "Nf6", "Nd2"},
			},
			{
				BranchName:  "Symmetrical",
				BranchColor: colorTeal,
				Moves:       []string{"d4", "d5", "Bf4", "Bf5", "e3", "e6", "Nf3", "Nf6", "Bd3"},
			},
		},
	},
	{
		ID:          "scotch",
		Name:        "Scotch Game",
		Color:       models.ColorWhite,
		Description: "1.e4 e5 2.Nf3 Nc6 3.d4 exd4 4.Nxd4 — Classical, Schmidt, Steinitz",
		Lines: []TemplateLine{
			{
				BranchName:  "Classical",
				BranchColor: colorRed,
				Moves:       []string{"e4", "e5", "Nf3", "Nc6", "d4", "exd4", "Nxd4", "Bc5", "Be3", "Qf6"},
			},
			{
				BranchName:  "Schmidt",
				BranchColor: colorBlue,
				Moves:       []string{"e4", "e5", "Nf3", "Nc6", "d4", "exd4", "Nxd4", "Nf6", "Nc3"},
			},
			{
				BranchName:  "Steinitz",
				BranchColor: colorPurple,
				Moves:       []string{"e4", "e5", "Nf3", "Nc6", "d4", "exd4", "Nxd4", "Qh4", "Nb5"},
			},
		},
	},
	{
		ID:          "ruy-lopez",
		Name:        "Ruy López",
		Color:       models.ColorWhite,
		Description: "1.e4 e5 2.Nf3 Nc6 3.Bb5 — Morphy, Berlin, Classical",
		Lines: []TemplateLine{
			{
				BranchName:  "Morphy Defense",
				BranchColor: colorRed,
				Moves:       []string{"e4", "e5", "Nf3", "Nc6", "Bb5", "a6", "Ba4", "Nf6", "O-O", "Be7", "Re1"},
			},
			{
				BranchName:  "Berlin Defense",
				BranchColor: colorBlue,
				Moves:       []string{"e4", "e5", "Nf3", "Nc6", "Bb5", "Nf6", "O-O", "Nxe4", "d4"},
			},
			{
				BranchName:  "Classical",
				BranchColor: colorGreen,
				Moves:       []string{"e4", "e5", "Nf3", "Nc6", "Bb5", "Bc5", "c3"},
			},
		},
	},
	{
		ID:          "queens-gambit",
		Name:        "Queen's Gambit",
		Color:       models.ColorWhite,
		Description: "1.d4 d5 2.c4 — QGD, QGA, Slav",
		Lines: []TemplateLine{
			{
				BranchName:  "Queen's Gambit Declined",
				BranchColor: colorPurple,
				Moves:       []string{"d4", "d5", "c4", "e6", "Nc3", "Nf6", "Bg5", "Be7", "e3"},
			},
			{
				BranchName:  "Queen's Gambit Accepted",
				BranchColor: colorOrange,
				Moves:       []string{"d4", "d5", "c4", "dxc4", "Nf3", "Nf6", "e3", "e6", "Bxc4"},
			},
			{
				BranchName:  "Slav",
				BranchColor: colorTeal,
				Moves:       []string{"d4", "d5", "c4", "c6", "Nf3", "Nf6", "Nc3", "dxc4", "a4"},
			},
		},
	},
	{
		ID:          "vienna",
		Name:        "Vienna Game",
		Color:       models.ColorWhite,
		Description: "1.e4 e5 2.Nc3 — Vienna Gambit, Falkbeer, Copycat",
		Lines: []TemplateLine{
			{
				BranchName:  "Vienna Gambit",
				BranchColor: colorRed,
				Moves:       []string{"e4", "e5", "Nc3", "Nf6", "f4", "d5", "fxe5", "Nxe4", "Nf3"},
			},
			{
				BranchName:  "Falkbeer",
				BranchColor: colorYellow,
				Moves:       []string{"e4", "e5", "Nc3", "Nf6", "Bc4", "Nxe4", "Qh5"},
			},
			{
				BranchName:  "Copycat",
				BranchColor: colorGreen,
				Moves:       []string{"e4", "e5", "Nc3", "Nc6", "Bc4", "Bc5", "Qg4"},
			},
		},
	},

	// =====================================================================
	// Black openings
	// =====================================================================
	{
		ID:          "sicilian",
		Name:        "Sicilian Najdorf",
		Color:       models.ColorBlack,
		Description: "1.e4 c5 2.Nf3 d6 3.d4 cxd4 4.Nxd4 Nf6 5.Nc3 a6 — English Attack, Classical, Adams Attack",
		Lines: []TemplateLine{
			{
				BranchName:  "English Attack",
				BranchColor: colorRed,
				Moves:       []string{"e4", "c5", "Nf3", "d6", "d4", "cxd4", "Nxd4", "Nf6", "Nc3", "a6", "Be3", "e5", "Nb3"},
			},
			{
				BranchName:  "Classical",
				BranchColor: colorBlue,
				Moves:       []string{"e4", "c5", "Nf3", "d6", "d4", "cxd4", "Nxd4", "Nf6", "Nc3", "a6", "Be2", "e5", "Nb3"},
			},
			{
				BranchName:  "Adams Attack",
				BranchColor: colorGreen,
				Moves:       []string{"e4", "c5", "Nf3", "d6", "d4", "cxd4", "Nxd4", "Nf6", "Nc3", "a6", "h3"},
			},
		},
	},
	{
		ID:          "french",
		Name:        "French Defense",
		Color:       models.ColorBlack,
		Description: "1.e4 e6 — Advance, Winawer, Classical, Exchange",
		Lines: []TemplateLine{
			{
				BranchName:  "Advance",
				BranchColor: colorRed,
				Moves:       []string{"e4", "e6", "d4", "d5", "e5", "c5", "c3", "Nc6", "Nf3"},
			},
			{
				BranchName:  "Winawer",
				BranchColor: colorPurple,
				Moves:       []string{"e4", "e6", "d4", "d5", "Nc3", "Bb4", "e5", "c5", "a3"},
			},
			{
				BranchName:  "Classical",
				BranchColor: colorBlue,
				Moves:       []string{"e4", "e6", "d4", "d5", "Nc3", "Nf6", "Bg5", "Be7", "e5"},
			},
			{
				BranchName:  "Exchange",
				BranchColor: colorOrange,
				Moves:       []string{"e4", "e6", "d4", "d5", "exd5", "exd5", "Nc3", "Nf6", "Bd3"},
			},
		},
	},
	{
		ID:          "scandinavian",
		Name:        "Scandinavian Defense",
		Color:       models.ColorBlack,
		Description: "1.e4 d5 — Main Line, Modern, Icelandic Gambit",
		Lines: []TemplateLine{
			{
				BranchName:  "Main Line",
				BranchColor: colorRed,
				Moves:       []string{"e4", "d5", "exd5", "Qxd5", "Nc3", "Qa5", "d4", "Nf6", "Nf3"},
			},
			{
				BranchName:  "Modern",
				BranchColor: colorTeal,
				Moves:       []string{"e4", "d5", "exd5", "Nf6", "d4", "Nxd5", "c4", "Nb6", "Nf3"},
			},
			{
				BranchName:  "Icelandic Gambit",
				BranchColor: colorYellow,
				Moves:       []string{"e4", "d5", "exd5", "c6"},
			},
		},
	},
	{
		ID:          "caro-kann",
		Name:        "Caro-Kann Defense",
		Color:       models.ColorBlack,
		Description: "1.e4 c6 — Advance, Classical, Exchange, Fantasy",
		Lines: []TemplateLine{
			{
				BranchName:  "Advance",
				BranchColor: colorRed,
				Moves:       []string{"e4", "c6", "d4", "d5", "e5", "Bf5", "Nf3", "e6", "Be2"},
			},
			{
				BranchName:  "Classical",
				BranchColor: colorBlue,
				Moves:       []string{"e4", "c6", "d4", "d5", "Nc3", "dxe4", "Nxe4", "Bf5", "Ng3", "Bg6"},
			},
			{
				BranchName:  "Exchange",
				BranchColor: colorOrange,
				Moves:       []string{"e4", "c6", "d4", "d5", "exd5", "cxd5", "Bd3", "Nc6", "c3"},
			},
			{
				BranchName:  "Fantasy",
				BranchColor: colorPink,
				Moves:       []string{"e4", "c6", "d4", "d5", "f3", "dxe4", "fxe4"},
			},
		},
	},
	{
		ID:          "kings-indian",
		Name:        "King's Indian Defense",
		Color:       models.ColorBlack,
		Description: "1.d4 Nf6 2.c4 g6 3.Nc3 Bg7 — Classical, Sämisch, Four Pawns",
		Lines: []TemplateLine{
			{
				BranchName:  "Classical",
				BranchColor: colorBlue,
				Moves:       []string{"d4", "Nf6", "c4", "g6", "Nc3", "Bg7", "e4", "d6", "Nf3", "O-O", "Be2", "e5"},
			},
			{
				BranchName:  "Sämisch",
				BranchColor: colorRed,
				Moves:       []string{"d4", "Nf6", "c4", "g6", "Nc3", "Bg7", "e4", "d6", "f3", "O-O", "Be3"},
			},
			{
				BranchName:  "Four Pawns",
				BranchColor: colorOrange,
				Moves:       []string{"d4", "Nf6", "c4", "g6", "Nc3", "Bg7", "e4", "d6", "f4", "O-O", "Nf3"},
			},
		},
	},
	{
		ID:          "slav",
		Name:        "Slav Defense",
		Color:       models.ColorBlack,
		Description: "1.d4 d5 2.c4 c6 — Main Line, Exchange, Chebanenko",
		Lines: []TemplateLine{
			{
				BranchName:  "Main Line",
				BranchColor: colorBlue,
				Moves:       []string{"d4", "d5", "c4", "c6", "Nf3", "Nf6", "Nc3", "dxc4", "a4", "Bf5"},
			},
			{
				BranchName:  "Exchange",
				BranchColor: colorOrange,
				Moves:       []string{"d4", "d5", "c4", "c6", "cxd5", "cxd5", "Nc3", "Nf6", "Bf4"},
			},
			{
				BranchName:  "Chebanenko",
				BranchColor: colorGreen,
				Moves:       []string{"d4", "d5", "c4", "c6", "Nf3", "Nf6", "Nc3", "a6", "e3"},
			},
		},
	},
}

// ExploreTemplate is a fully-built template with tree data and metadata,
// shaped like a Repertoire so the frontend can render it with the same card.
type ExploreTemplate struct {
	ID          string                `json:"id"`
	Name        string                `json:"name"`
	Description string                `json:"description"`
	Color       models.Color          `json:"color"`
	TreeData    models.RepertoireNode `json:"treeData"`
	Metadata    models.Metadata       `json:"metadata"`
}

// ListTemplatesWithPreview builds full tree data for each starter template
// so the explore page can render previews (board position, stats, etc.).
func ListTemplatesWithPreview() []ExploreTemplate {
	result := make([]ExploreTemplate, 0, len(starterTemplates))
	for _, tmpl := range starterTemplates {
		tree, err := BuildTemplateTree(&tmpl)
		if err != nil {
			continue // skip broken templates
		}
		meta := calculateMetadata(tree)
		result = append(result, ExploreTemplate{
			ID:          tmpl.ID,
			Name:        tmpl.Name,
			Description: tmpl.Description,
			Color:       tmpl.Color,
			TreeData:    tree,
			Metadata:    meta,
		})
	}
	return result
}

// GetTemplate returns a template by ID, or nil if not found
func GetTemplate(id string) *RepertoireTemplate {
	for i := range starterTemplates {
		if starterTemplates[i].ID == id {
			return &starterTemplates[i]
		}
	}
	return nil
}

// ListTemplates returns summaries of all available templates
func ListTemplates() []RepertoireTemplateSummary {
	summaries := make([]RepertoireTemplateSummary, len(starterTemplates))
	for i, t := range starterTemplates {
		summaries[i] = RepertoireTemplateSummary{
			ID:          t.ID,
			Name:        t.Name,
			Color:       t.Color,
			Description: t.Description,
		}
	}
	return summaries
}

// BuildTemplateTree builds a valid RepertoireNode tree from the template's
// variation lines. Lines that share a common move prefix are merged into
// shared nodes; at the point where a line diverges, its BranchName and
// BranchColor are applied to the diverging node.
//
// The algorithm works in two passes:
//  1. Insert all lines into a shared trie-like tree (merging common prefixes).
//  2. Walk each line again to find its true divergence point (a node whose
//     parent has multiple children) and apply the branch label there.
func BuildTemplateTree(tmpl *RepertoireTemplate) (models.RepertoireNode, error) {
	if len(tmpl.Lines) == 0 {
		return models.RepertoireNode{}, fmt.Errorf("template %s has no lines", tmpl.ID)
	}

	game := chess.NewGame()
	startFEN := normalizeFEN(game.Position().String())

	root := models.RepertoireNode{
		ID:          uuid.New().String(),
		FEN:         startFEN,
		Move:        nil,
		MoveNumber:  0,
		ColorToMove: models.ChessColorWhite,
		Children:    []*models.RepertoireNode{},
	}

	// Pass 1: insert all lines into the tree (no labels yet)
	for _, line := range tmpl.Lines {
		if err := insertLine(&root, line); err != nil {
			return models.RepertoireNode{}, fmt.Errorf(
				"template %s, line %q: %w", tmpl.ID, line.BranchName, err,
			)
		}
	}

	// Pass 2: walk each line and label the divergence node
	for _, line := range tmpl.Lines {
		labelDivergenceNode(&root, line)
	}

	return root, nil
}

// insertLine walks the existing tree following the line's moves, reusing nodes
// where they already exist, and creating new ones where needed.
func insertLine(root *models.RepertoireNode, line TemplateLine) error {
	game := chess.NewGame()
	current := root

	for i, moveSAN := range line.Moves {
		if err := game.MoveStr(moveSAN); err != nil {
			return fmt.Errorf("invalid move %q at index %d: %w", moveSAN, i, err)
		}

		resultFEN := normalizeFEN(game.Position().String())

		// Check if a child with this move already exists
		existing := findChildByMove(current, moveSAN)
		if existing != nil {
			current = existing
			continue
		}

		// New node
		colorToMove := models.ChessColorWhite
		if strings.Fields(resultFEN)[1] == "b" {
			colorToMove = models.ChessColorBlack
		}

		move := moveSAN
		moveNumber := (i / 2) + 1

		node := &models.RepertoireNode{
			ID:          uuid.New().String(),
			FEN:         resultFEN,
			Move:        &move,
			MoveNumber:  moveNumber,
			ColorToMove: colorToMove,
			ParentID:    &current.ID,
			Children:    []*models.RepertoireNode{},
		}

		current.Children = append(current.Children, node)
		current = node
	}

	return nil
}

// labelDivergenceNode walks the tree following the line's moves and sets
// BranchName/BranchColor on the node at the deepest (last) branching point
// along the line's path. This ensures that when two lines share a sub-path
// (e.g. Italian: Giuoco Piano and Evans Gambit both go through Bc5), the
// label is placed where each line truly diverges from its closest sibling,
// not at a higher-level branch point.
// If the template has only one line, the label is placed on the first move.
func labelDivergenceNode(root *models.RepertoireNode, line TemplateLine) {
	if line.BranchName == "" {
		return
	}

	current := root
	var lastBranchChild *models.RepertoireNode

	for _, moveSAN := range line.Moves {
		child := findChildByMove(current, moveSAN)
		if child == nil {
			return // should not happen after insertLine
		}

		// Track the deepest divergence point along the path
		if len(current.Children) > 1 {
			lastBranchChild = child
		}

		current = child
	}

	if lastBranchChild != nil {
		lastBranchChild.BranchName = &line.BranchName
		if line.BranchColor != "" {
			lastBranchChild.BranchColor = &line.BranchColor
		}
		return
	}

	// No branch point found (single-line template) — label the first move.
	if len(root.Children) > 0 {
		root.Children[0].BranchName = &line.BranchName
		if line.BranchColor != "" {
			root.Children[0].BranchColor = &line.BranchColor
		}
	}
}

// findChildByMove returns the child node with the given SAN move, or nil.
func findChildByMove(parent *models.RepertoireNode, moveSAN string) *models.RepertoireNode {
	for _, child := range parent.Children {
		if child.Move != nil && *child.Move == moveSAN {
			return child
		}
	}
	return nil
}
