package models

import (
	"time"
)

type Color string

const (
	ColorWhite Color = "white"
	ColorBlack Color = "black"
)

type RepertoireNode struct {
	ID          string            `json:"id"`
	FEN         string            `json:"fen"`
	Move        *string           `json:"move,omitempty"`
	MoveNumber  int               `json:"moveNumber"`
	ColorToMove Color             `json:"colorToMove"`
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
	ParentID    string `json:"parentId"`
	Move        string `json:"move"`
	FEN         string `json:"fen"`
	MoveNumber  int    `json:"moveNumber"`
	ColorToMove Color  `json:"colorToMove"`
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
}

type AnalysisSummary struct {
	ID         string    `json:"id"`
	Color      Color     `json:"color"`
	Filename   string    `json:"filename"`
	GameCount  int       `json:"gameCount"`
	UploadedAt time.Time `json:"uploadedAt"`
}

type AnalysisDetail struct {
	ID         string         `json:"id"`
	Color      Color          `json:"color"`
	Filename   string         `json:"filename"`
	GameCount  int            `json:"gameCount"`
	UploadedAt time.Time      `json:"uploadedAt"`
	Results    []GameAnalysis `json:"results"`
}
