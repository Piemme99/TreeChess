package services

import (
	"fmt"
	"strings"

	"github.com/google/uuid"
	"github.com/notnil/chess"

	"github.com/treechess/backend/internal/models"
)

// RepertoireTemplate represents a starter repertoire template
type RepertoireTemplate struct {
	ID          string
	Name        string
	Color       models.Color
	Description string
	Moves       []string // SAN moves for the main line
}

// RepertoireTemplateSummary is the public-facing summary of a template
type RepertoireTemplateSummary struct {
	ID          string       `json:"id"`
	Name        string       `json:"name"`
	Color       models.Color `json:"color"`
	Description string       `json:"description"`
}

var starterTemplates = []RepertoireTemplate{
	// White openings
	{
		ID:          "italian",
		Name:        "Italian Game",
		Color:       models.ColorWhite,
		Description: "1.e4 e5 2.Nf3 Nc6 3.Bc4 Bc5 4.c3 Nf6 5.d4",
		Moves:       []string{"e4", "e5", "Nf3", "Nc6", "Bc4", "Bc5", "c3", "Nf6", "d4"},
	},
	{
		ID:          "london",
		Name:        "London System",
		Color:       models.ColorWhite,
		Description: "1.d4 d5 2.Bf4 Nf6 3.e3 e6 4.Nd2 c5 5.c3",
		Moves:       []string{"d4", "d5", "Bf4", "Nf6", "e3", "e6", "Nd2", "c5", "c3"},
	},
	{
		ID:          "scotch",
		Name:        "Scotch Game",
		Color:       models.ColorWhite,
		Description: "1.e4 e5 2.Nf3 Nc6 3.d4 exd4 4.Nxd4 Nf6 5.Nc3",
		Moves:       []string{"e4", "e5", "Nf3", "Nc6", "d4", "exd4", "Nxd4", "Nf6", "Nc3"},
	},
	{
		ID:          "ruy-lopez",
		Name:        "Ruy López",
		Color:       models.ColorWhite,
		Description: "1.e4 e5 2.Nf3 Nc6 3.Bb5 a6 4.Ba4 Nf6 5.O-O",
		Moves:       []string{"e4", "e5", "Nf3", "Nc6", "Bb5", "a6", "Ba4", "Nf6", "O-O"},
	},
	{
		ID:          "queens-gambit",
		Name:        "Queen's Gambit",
		Color:       models.ColorWhite,
		Description: "1.d4 d5 2.c4 e6 3.Nc3 Nf6 4.Bg5 Be7 5.e3",
		Moves:       []string{"d4", "d5", "c4", "e6", "Nc3", "Nf6", "Bg5", "Be7", "e3"},
	},
	{
		ID:          "vienna",
		Name:        "Vienna Game",
		Color:       models.ColorWhite,
		Description: "1.e4 e5 2.Nc3 Nf6 3.f4 d5 4.fxe5 Nxe4 5.Nf3",
		Moves:       []string{"e4", "e5", "Nc3", "Nf6", "f4", "d5", "fxe5", "Nxe4", "Nf3"},
	},
	// Black openings
	{
		ID:          "sicilian",
		Name:        "Sicilian Najdorf",
		Color:       models.ColorBlack,
		Description: "1.e4 c5 2.Nf3 d6 3.d4 cxd4 4.Nxd4 Nf6 5.Nc3 a6",
		Moves:       []string{"e4", "c5", "Nf3", "d6", "d4", "cxd4", "Nxd4", "Nf6", "Nc3", "a6"},
	},
	{
		ID:          "french",
		Name:        "French Defense",
		Color:       models.ColorBlack,
		Description: "1.e4 e6 2.d4 d5 3.Nc3 Nf6 4.e5 Nfd7 5.f4",
		Moves:       []string{"e4", "e6", "d4", "d5", "Nc3", "Nf6", "e5", "Nfd7", "f4"},
	},
	{
		ID:          "scandinavian",
		Name:        "Scandinavian Defense",
		Color:       models.ColorBlack,
		Description: "1.e4 d5 2.exd5 Qxd5 3.Nc3 Qa5 4.d4 Nf6 5.Nf3",
		Moves:       []string{"e4", "d5", "exd5", "Qxd5", "Nc3", "Qa5", "d4", "Nf6", "Nf3"},
	},
	{
		ID:          "caro-kann",
		Name:        "Caro-Kann Defense",
		Color:       models.ColorBlack,
		Description: "1.e4 c6 2.d4 d5 3.Nc3 dxe4 4.Nxe4 Bf5 5.Ng3",
		Moves:       []string{"e4", "c6", "d4", "d5", "Nc3", "dxe4", "Nxe4", "Bf5", "Ng3"},
	},
	{
		ID:          "kings-indian",
		Name:        "King's Indian Defense",
		Color:       models.ColorBlack,
		Description: "1.d4 Nf6 2.c4 g6 3.Nc3 Bg7 4.e4 d6 5.Nf3",
		Moves:       []string{"d4", "Nf6", "c4", "g6", "Nc3", "Bg7", "e4", "d6", "Nf3"},
	},
	{
		ID:          "slav",
		Name:        "Slav Defense",
		Color:       models.ColorBlack,
		Description: "1.d4 d5 2.c4 c6 3.Nf3 Nf6 4.Nc3 dxc4 5.a4",
		Moves:       []string{"d4", "d5", "c4", "c6", "Nf3", "Nf6", "Nc3", "dxc4", "a4"},
	},
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

// BuildTemplateTree builds a valid RepertoireNode tree from the template moves
func BuildTemplateTree(tmpl *RepertoireTemplate) (models.RepertoireNode, error) {
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

	current := &root
	for i, moveSAN := range tmpl.Moves {
		if err := game.MoveStr(moveSAN); err != nil {
			return models.RepertoireNode{}, fmt.Errorf("invalid move %q at index %d: %w", moveSAN, i, err)
		}

		resultFEN := normalizeFEN(game.Position().String())
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

	return root, nil
}
