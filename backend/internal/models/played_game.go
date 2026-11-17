package models

import "time"

// PlayedGame est une partie du joueur telle que la v2 la lit : sa couleur, ses coups en SAN, son résultat.
type PlayedGame struct {
	Source   string  `json:"-"`
	SourceID string  `json:"id"`
	Color    string  `json:"color"`
	Moves    string  `json:"moves"`
	Score    float64 `json:"score"`
	Rating   *int    `json:"rating,omitempty"`
	PlayedAt string  `json:"playedAt"`
}

// PlayedGameImport est l'état du dernier import des parties d'un joueur.
type PlayedGameImport struct {
	Status     string     `json:"status"`
	Imported   int        `json:"imported"`
	Error      string     `json:"error,omitempty"`
	StartedAt  time.Time  `json:"startedAt"`
	FinishedAt *time.Time `json:"finishedAt,omitempty"`
}

const (
	PlayedGameImportRunning = "running"
	PlayedGameImportDone    = "done"
	PlayedGameImportFailed  = "failed"
)
