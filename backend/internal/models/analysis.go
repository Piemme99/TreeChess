package models

import (
	"fmt"
	"strings"
	"time"
)

type PGNHeaders map[string]string

// MoveStatus classifies a single move in a game relative to the matched
// repertoire. The string values are part of the JSON API contract consumed by
// the frontend and must not change.
type MoveStatus string

const (
	// MoveStatusInRepertoire — the played move matches a repertoire child.
	MoveStatusInRepertoire MoveStatus = "in-repertoire"
	// MoveStatusOutOfRepertoire — a user move that deviates from the repertoire.
	MoveStatusOutOfRepertoire MoveStatus = "out-of-repertoire"
	// MoveStatusOpponentNew — an opponent move not covered by the repertoire.
	MoveStatusOpponentNew MoveStatus = "opponent-new"
	// MoveStatusOutOfBook — the position is no longer in the repertoire tree.
	MoveStatusOutOfBook MoveStatus = "out-of-book"
)

// GameStatus classifies a whole game relative to the matched repertoire. The
// string values are part of the JSON API contract consumed by the frontend and
// must not change.
type GameStatus string

const (
	// GameStatusInRepertoire — every move stayed within the repertoire.
	GameStatusInRepertoire GameStatus = "in-repertoire"
	// GameStatusNewOpening — no repertoire matched the game's opening.
	GameStatusNewOpening GameStatus = "new-opening"
	// GameStatusNewLine — the opponent left the repertoire first.
	GameStatusNewLine GameStatus = "new-line"
	// GameStatusError — the user deviated from the repertoire.
	GameStatusError GameStatus = "error"
)

type MoveAnalysis struct {
	PlyNumber    int        `json:"plyNumber"`
	SAN          string     `json:"san"`
	FEN          string     `json:"fen"`
	Status       MoveStatus `json:"status"`
	ExpectedMove string     `json:"expectedMove,omitempty"`
	IsUserMove   bool       `json:"isUserMove"`
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

// GameSummary represents a single game for the games list
type GameSummary struct {
	AnalysisID     string     `json:"analysisId"`
	GameIndex      int        `json:"gameIndex"`
	White          string     `json:"white"`
	Black          string     `json:"black"`
	Result         string     `json:"result"`
	Date           string     `json:"date"`
	UserColor      Color      `json:"userColor"`
	Status         GameStatus `json:"status"`
	TimeClass      string     `json:"timeClass,omitempty"`
	Opening        string     `json:"opening,omitempty"`
	ImportedAt     time.Time  `json:"importedAt"`
	RepertoireName string     `json:"repertoireName,omitempty"`
	RepertoireID   string     `json:"repertoireId,omitempty"`
	Source         string     `json:"source"` // "lichess", "chesscom", "pgn"
	Synced         bool       `json:"synced"`
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
		_, _ = fmt.Sscanf(parts[1], "%d", &increment)
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

// RawAnalysis represents a full analysis with all game data, used for insights computation
type RawAnalysis struct {
	ID         string         `json:"id"`
	Filename   string         `json:"filename"`
	Results    []GameAnalysis `json:"results"`
	UploadedAt time.Time      `json:"uploadedAt"`
}

// TrainingAnalyzeRequest represents a request to analyze a sequence of moves from explorer training
type TrainingAnalyzeRequest struct {
	Moves     []string `json:"moves"`     // SAN moves in order (e.g. ["e4", "e5", "Nf3"])
	UserColor Color    `json:"userColor"` // "white" or "black"
}

// TrainingAnalyzeResponse returns the best matching repertoire and per-move analysis
type TrainingAnalyzeResponse struct {
	MatchedRepertoire *RepertoireRef `json:"matchedRepertoire"` // nil if no match
	MatchScore        int            `json:"matchScore"`        // Number of user moves matched
	Moves             []MoveAnalysis `json:"moves"`             // Per-ply analysis
}
