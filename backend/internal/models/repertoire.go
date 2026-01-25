package models

import (
	"time"
)

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

type RepertoireNode struct {
	ID          string            `json:"id"`
	FEN         string            `json:"fen"`
	Move        *string           `json:"move,omitempty"`
	MoveNumber  int               `json:"moveNumber"`
	ColorToMove ChessColor        `json:"colorToMove"`
	ParentID    *string           `json:"parentId,omitempty"`
	Children    []*RepertoireNode `json:"children"`
}

type Metadata struct {
	TotalNodes   int `json:"totalNodes"`
	TotalMoves   int `json:"totalMoves"`
	DeepestDepth int `json:"deepestDepth"`
}

type Repertoire struct {
	ID        string         `json:"id"`
	Color     Color          `json:"color"`
	TreeData  RepertoireNode `json:"treeData"`
	Metadata  Metadata       `json:"metadata"`
	CreatedAt time.Time      `json:"createdAt"`
	UpdatedAt time.Time      `json:"updatedAt"`
}

type AddNodeRequest struct {
	ParentID   string `json:"parentId"`
	Move       string `json:"move"`
	MoveNumber int    `json:"moveNumber"`
	// FEN and ColorToMove are computed by the backend from the parent position
	// They are optional in the request and will be overridden
}

type PGNHeaders map[string]string

type MoveAnalysis struct {
	PlyNumber    int    `json:"plyNumber"`
	SAN          string `json:"san"`
	FEN          string `json:"fen"`
	Status       string `json:"status"`
	ExpectedMove string `json:"expectedMove,omitempty"`
	IsUserMove   bool   `json:"isUserMove"`
}

type GameAnalysis struct {
	GameIndex int            `json:"gameIndex"`
	Headers   PGNHeaders     `json:"headers"`
	Moves     []MoveAnalysis `json:"moves"`
	UserColor Color          `json:"userColor"` // Which color the user played as in this game
}

type AnalysisSummary struct {
	ID         string    `json:"id"`
	Username   string    `json:"username"`
	Filename   string    `json:"filename"`
	GameCount  int       `json:"gameCount"`
	UploadedAt time.Time `json:"uploadedAt"`
}

type AnalysisDetail struct {
	ID         string         `json:"id"`
	Username   string         `json:"username"`
	Filename   string         `json:"filename"`
	GameCount  int            `json:"gameCount"`
	UploadedAt time.Time      `json:"uploadedAt"`
	Results    []GameAnalysis `json:"results"`
}

// LichessImportOptions represents options for importing games from Lichess
type LichessImportOptions struct {
	Max      int    `json:"max,omitempty"`      // Max games to fetch (default: 20, max: 100)
	Since    int64  `json:"since,omitempty"`    // Timestamp Unix ms (start date)
	Until    int64  `json:"until,omitempty"`    // Timestamp Unix ms (end date)
	Rated    *bool  `json:"rated,omitempty"`    // Only rated games
	PerfType string `json:"perfType,omitempty"` // Game type: bullet, blitz, rapid, classical
}

// LichessImportRequest represents a request to import games from Lichess
type LichessImportRequest struct {
	Username string               `json:"username"`
	Options  LichessImportOptions `json:"options"`
}

// GameSummary represents a single game for the games list
type GameSummary struct {
	AnalysisID string    `json:"analysisId"`
	GameIndex  int       `json:"gameIndex"`
	White      string    `json:"white"`
	Black      string    `json:"black"`
	Result     string    `json:"result"`
	Date       string    `json:"date"`
	UserColor  Color     `json:"userColor"`
	Status     string    `json:"status"` // "ok", "error", "new-line"
	ImportedAt time.Time `json:"importedAt"`
}

// GamesResponse represents the paginated response for games list
type GamesResponse struct {
	Games  []GameSummary `json:"games"`
	Total  int           `json:"total"`
	Limit  int           `json:"limit"`
	Offset int           `json:"offset"`
}
