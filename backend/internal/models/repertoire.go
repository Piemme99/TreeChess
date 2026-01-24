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
