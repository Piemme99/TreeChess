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
	ID              string            `json:"id"`
	FEN             string            `json:"fen"`
	Move            *string           `json:"move,omitempty"`
	MoveNumber      int               `json:"moveNumber"`
	ColorToMove     ChessColor        `json:"colorToMove"`
	ParentID        *string           `json:"parentId,omitempty"`
	Comment         *string           `json:"comment,omitempty"`
	BranchName      *string           `json:"branchName,omitempty"`
	Collapsed       bool              `json:"collapsed,omitempty"`
	TranspositionOf *string           `json:"transpositionOf,omitempty"`
	Children        []*RepertoireNode `json:"children"`
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
	ID                string    `json:"id"`
	Username          string    `json:"username"`
	Filename          string    `json:"filename"`
	GameCount         int       `json:"gameCount"`
	UploadedAt        time.Time `json:"uploadedAt"`
	SkippedDuplicates int       `json:"-"` // not persisted, set after save
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

// StudyChapterInfo represents metadata about a single Lichess study chapter
type StudyChapterInfo struct {
	Index       int    `json:"index"`
	Name        string `json:"name"`
	Orientation string `json:"orientation"`
	MoveCount   int    `json:"moveCount"`
}

// StudyInfo represents metadata about a Lichess study
type StudyInfo struct {
	StudyID   string             `json:"studyId"`
	StudyName string             `json:"studyName"`
	Chapters  []StudyChapterInfo `json:"chapters"`
}

// StudyImportRequest represents a request to import chapters from a Lichess study
type StudyImportRequest struct {
	StudyURL       string `json:"studyUrl"`
	ChapterIndices []int  `json:"chapters"`
	MergeAsOne     bool   `json:"mergeAsOne"`
	MergeName      string `json:"mergeName,omitempty"`
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
	RepertoireID   string    `json:"repertoireId,omitempty"`
	Source         string    `json:"source"` // "lichess", "chesscom", "pgn"
	Synced         bool      `json:"synced"`
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

// GameRef is a lightweight reference to a game within an analysis
type GameRef struct {
	AnalysisID string `json:"analysisId"`
	GameIndex  int    `json:"gameIndex"`
	PlyNumber  int    `json:"plyNumber"`
	White      string `json:"white"`
	Black      string `json:"black"`
	Result     string `json:"result"`
	Date       string `json:"date"`
}

// ExplorerMoveStats represents opening explorer data for a single user move
type ExplorerMoveStats struct {
	PlyNumber     int     `json:"plyNumber"`
	FEN           string  `json:"fen"`
	PlayedMove    string  `json:"playedMove"`
	PlayedWinrate float64 `json:"playedWinrate"`
	BestMove      string  `json:"bestMove"`
	BestWinrate   float64 `json:"bestWinrate"`
	WinrateDrop   float64 `json:"winrateDrop"`
	TotalGames    int     `json:"totalGames"`
}

// EngineEval represents a pending/completed opening analysis for a game
type EngineEval struct {
	ID         string              `json:"id"`
	UserID     string              `json:"userId"`
	AnalysisID string              `json:"analysisId"`
	GameIndex  int                 `json:"gameIndex"`
	Status     string              `json:"status"` // pending, processing, done, failed
	Evals      []ExplorerMoveStats `json:"evals,omitempty"`
	CreatedAt  time.Time           `json:"createdAt"`
	UpdatedAt  time.Time           `json:"updatedAt"`
}

// OpeningMistake represents a recurring opening mistake detected via explorer stats
type OpeningMistake struct {
	FEN         string    `json:"fen"`
	PlayedMove  string    `json:"playedMove"`
	BestMove    string    `json:"bestMove"`
	WinrateDrop float64   `json:"winrateDrop"`
	Frequency   int       `json:"frequency"`
	Score       float64   `json:"score"`
	Games       []GameRef `json:"games"`
}

// InsightsResponse is the response for the GET /api/games/insights endpoint
type InsightsResponse struct {
	WorstMistakes           []OpeningMistake `json:"worstMistakes"`
	EngineAnalysisDone      bool             `json:"engineAnalysisDone"`
	EngineAnalysisTotal     int              `json:"engineAnalysisTotal"`
	EngineAnalysisCompleted int              `json:"engineAnalysisCompleted"`
}

// RawAnalysis represents a full analysis with all game data, used for insights computation
type RawAnalysis struct {
	ID         string         `json:"id"`
	Filename   string         `json:"filename"`
	Results    []GameAnalysis `json:"results"`
	UploadedAt time.Time      `json:"uploadedAt"`
}

// GamesResponse represents the paginated response for games list
type GamesResponse struct {
	Games  []GameSummary `json:"games"`
	Total  int           `json:"total"`
	Limit  int           `json:"limit"`
	Offset int           `json:"offset"`
}
