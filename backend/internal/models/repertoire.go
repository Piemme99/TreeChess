package models

import (
	"fmt"
	"strings"
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
	Name      string         `json:"name"`
	Color     Color          `json:"color"`
	TreeData  RepertoireNode `json:"treeData"`
	Metadata  Metadata       `json:"metadata"`
	CreatedAt time.Time      `json:"createdAt"`
	UpdatedAt time.Time      `json:"updatedAt"`
}

// CreateRepertoireRequest represents a request to create a new repertoire
type CreateRepertoireRequest struct {
	Name  string `json:"name"`
	Color Color  `json:"color"`
}

// UpdateRepertoireRequest represents a request to update a repertoire (rename)
type UpdateRepertoireRequest struct {
	Name string `json:"name"`
}

// RepertoireRef is a lightweight reference to a repertoire
type RepertoireRef struct {
	ID   string `json:"id"`
	Name string `json:"name"`
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
	GameIndex         int            `json:"gameIndex"`
	Headers           PGNHeaders     `json:"headers"`
	Moves             []MoveAnalysis `json:"moves"`
	UserColor         Color          `json:"userColor"`         // Which color the user played as in this game
	MatchedRepertoire *RepertoireRef `json:"matchedRepertoire"` // Which repertoire was matched (nil if no match)
	MatchScore        int            `json:"matchScore"`        // Number of moves that matched the repertoire
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

// ChesscomImportOptions represents options for importing games from Chess.com
type ChesscomImportOptions struct {
	Max       int    `json:"max,omitempty"`       // Max games to fetch (default: 20, max: 100)
	Since     int64  `json:"since,omitempty"`     // Timestamp Unix ms (start date)
	Until     int64  `json:"until,omitempty"`     // Timestamp Unix ms (end date)
	TimeClass string `json:"timeClass,omitempty"` // Game type: daily, rapid, blitz, bullet
}

// ChesscomImportRequest represents a request to import games from Chess.com
type ChesscomImportRequest struct {
	Username string               `json:"username"`
	Options  ChesscomImportOptions `json:"options"`
}

// GameSummary represents a single game for the games list
type GameSummary struct {
	AnalysisID     string    `json:"analysisId"`
	GameIndex      int       `json:"gameIndex"`
	White          string    `json:"white"`
	Black          string    `json:"black"`
	Result         string    `json:"result"`
	Date           string    `json:"date"`
	UserColor      Color     `json:"userColor"`
	Status         string    `json:"status"` // "ok", "error", "new-line"
	TimeClass      string    `json:"timeClass,omitempty"`
	Opening        string    `json:"opening,omitempty"`
	ImportedAt     time.Time `json:"importedAt"`
	RepertoireName string    `json:"repertoireName,omitempty"`
	Source         string    `json:"source"` // "sync", "lichess", "chesscom", "pgn"
}

// ClassifyTimeControl maps a TimeControl PGN header value to a time class.
// Format: "seconds" or "seconds+increment"
func ClassifyTimeControl(tc string) string {
	if tc == "-" || tc == "" {
		return "daily"
	}

	parts := strings.Split(tc, "+")
	var baseSeconds int
	if _, err := fmt.Sscanf(parts[0], "%d", &baseSeconds); err != nil {
		return ""
	}

	if baseSeconds >= 86400 {
		return "daily"
	}

	var increment int
	if len(parts) > 1 {
		fmt.Sscanf(parts[1], "%d", &increment)
	}
	totalEstimate := baseSeconds + increment*40

	switch {
	case totalEstimate < 180:
		return "bullet"
	case totalEstimate < 600:
		return "blitz"
	case totalEstimate < 1800:
		return "rapid"
	default:
		return "daily"
	}
}

// GamesResponse represents the paginated response for games list
type GamesResponse struct {
	Games  []GameSummary `json:"games"`
	Total  int           `json:"total"`
	Limit  int           `json:"limit"`
	Offset int           `json:"offset"`
}
