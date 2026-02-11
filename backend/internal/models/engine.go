package models

import "time"

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
