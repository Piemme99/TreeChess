package models

import "time"

// Color represents the repertoire color (white/black)
type Color string

const (
	ColorWhite Color = "white"
	ColorBlack Color = "black"
)

// ChessColor represents the color to move in a chess position (w/b)
// This matches the FEN format and chess.js conventions
type ChessColor string

const (
	ChessColorWhite ChessColor = "w"
	ChessColorBlack ChessColor = "b"
)

type Arrow struct {
	From  string `json:"from"`
	To    string `json:"to"`
	Color string `json:"color"`
}

type SquareHighlight struct {
	Square string `json:"square"`
	Color  string `json:"color"`
}

type RepertoireNode struct {
	ID              string            `json:"id"`
	FEN             string            `json:"fen"`
	Move            *string           `json:"move,omitempty"`
	MoveNumber      int               `json:"moveNumber"`
	ColorToMove     ChessColor        `json:"colorToMove"`
	ParentID        *string           `json:"parentId,omitempty"`
	Comment         *string           `json:"comment,omitempty"`
	Arrows          []Arrow           `json:"arrows,omitempty"`
	Highlights      []SquareHighlight `json:"highlights,omitempty"`
	BranchName      *string           `json:"branchName,omitempty"`
	BranchColor     *string           `json:"branchColor,omitempty"`
	Collapsed       bool              `json:"collapsed,omitempty"`
	IsMainLine      bool              `json:"isMainLine,omitempty"`
	TranspositionOf *string           `json:"transpositionOf,omitempty"`
	Children        []*RepertoireNode `json:"children"`
}

type Metadata struct {
	TotalNodes   int `json:"totalNodes"`
	TotalMoves   int `json:"totalMoves"`
	DeepestDepth int `json:"deepestDepth"`
}

// RepertoireOrigin tracks where a repertoire was imported from (e.g. Lichess study)
type RepertoireOrigin struct {
	Type    string `json:"type"`              // "lichess"
	URL     string `json:"url,omitempty"`     // e.g. "https://lichess.org/study/abcdef12"
	Creator string `json:"creator,omitempty"` // study author username
}

type Repertoire struct {
	ID          string            `json:"id"`
	Name        string            `json:"name"`
	Description string            `json:"description"`
	Color       Color             `json:"color"`
	IsPublic    bool              `json:"isPublic"`
	CategoryID  *string           `json:"categoryId,omitempty"`
	TreeData    RepertoireNode    `json:"treeData"`
	Metadata    Metadata          `json:"metadata"`
	Origin      *RepertoireOrigin `json:"origin,omitempty"`
	AuthorName  string            `json:"authorName,omitempty"`
	// Version is an optimistic-lock counter that is bumped on every tree mutation.
	// Clients echo it back via the If-Match header so the server can reject writes
	// based on a stale snapshot (see RepertoireRepository.Save).
	Version   int       `json:"version"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

// CreateRepertoireRequest represents a request to create a new repertoire
type CreateRepertoireRequest struct {
	Name        string `json:"name"`
	Description string `json:"description,omitempty"`
	Color       Color  `json:"color"`
	IsPublic    *bool  `json:"isPublic,omitempty"` // defaults to false if not provided
}

// UpdateRepertoireRequest represents a request to update a repertoire
type UpdateRepertoireRequest struct {
	Name        *string `json:"name,omitempty"`
	Description *string `json:"description,omitempty"`
}

// RepertoireRef is a lightweight reference to a repertoire
type RepertoireRef struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

// RepertoireFilterOption represents a repertoire in the games filter dropdown
type RepertoireFilterOption struct {
	ID    string `json:"id"`
	Name  string `json:"name"`
	Color Color  `json:"color"`
}

// MergeRepertoiresRequest represents a request to merge multiple repertoires into a new one
type MergeRepertoiresRequest struct {
	IDs  []string `json:"ids"`
	Name string   `json:"name"`
}

// MergeRepertoiresResponse contains the newly created merged repertoire
type MergeRepertoiresResponse struct {
	Merged *Repertoire `json:"merged"`
}

// ExtractSubtreeRequest represents a request to extract a subtree into a new repertoire
type ExtractSubtreeRequest struct {
	NodeID string `json:"nodeId"`
	Name   string `json:"name"`
}

// ExtractSubtreeResponse contains both the pruned original and the new extracted repertoire
type ExtractSubtreeResponse struct {
	Original  *Repertoire `json:"original"`
	Extracted *Repertoire `json:"extracted"`
}

type AddNodeRequest struct {
	ParentID   string `json:"parentId"`
	Move       string `json:"move"`
	MoveNumber int    `json:"moveNumber"`
	// FEN and ColorToMove are computed by the backend from the parent position
	// They are optional in the request and will be overridden
}

// StudyImportRepertoireSpec describes one repertoire to persist as part of a
// study import: its name/color, whether it should be assigned to the optional
// category created in the same transaction, the parsed tree, and an origin.
type StudyImportRepertoireSpec struct {
	Name        string
	Color       Color
	UseCategory bool
	Tree        RepertoireNode
	Origin      *RepertoireOrigin
}

// StudyImportCategorySpec describes a category to create in the import transaction.
type StudyImportCategorySpec struct {
	Name  string
	Color Color
}

// StudyImportPlan is the fully validated set of writes for a study import. The
// caller resolves name conflicts and limits before building this plan; the plan
// is then executed atomically (see RepertoireManager.PersistStudyImport).
type StudyImportPlan struct {
	// Category, when non-nil, is created first and assigned to every spec whose
	// UseCategory is true.
	Category    *StudyImportCategorySpec
	Repertoires []StudyImportRepertoireSpec
}

// StudyImportPersistResult is the outcome of a successful study import persist.
type StudyImportPersistResult struct {
	Category    *Category
	Repertoires []Repertoire
}
