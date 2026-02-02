//go:build integration

package testhelpers

import (
	"testing"

	"golang.org/x/crypto/bcrypt"

	"github.com/treechess/backend/internal/models"
)

// SeedUser creates a user with the given credentials using bcrypt.MinCost for speed.
func SeedUser(t *testing.T, repos *Repos, username, password string) *models.User {
	t.Helper()
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.MinCost)
	if err != nil {
		t.Fatalf("SeedUser: bcrypt: %v", err)
	}
	user, err := repos.User.Create(username, string(hash))
	if err != nil {
		t.Fatalf("SeedUser: %v", err)
	}
	return user
}

// SeedRepertoire creates a repertoire for the given user.
func SeedRepertoire(t *testing.T, repos *Repos, userID, name string, color models.Color) *models.Repertoire {
	t.Helper()
	rep, err := repos.Repertoire.Create(userID, name, color)
	if err != nil {
		t.Fatalf("SeedRepertoire: %v", err)
	}
	return rep
}

// SeedAnalysis saves an analysis for the given user.
func SeedAnalysis(t *testing.T, repos *Repos, userID, username, filename string, results []models.GameAnalysis) *models.AnalysisSummary {
	t.Helper()
	summary, err := repos.Analysis.Save(userID, username, filename, len(results), results)
	if err != nil {
		t.Fatalf("SeedAnalysis: %v", err)
	}
	return summary
}

// MakeGameAnalysis creates a GameAnalysis struct for testing.
func MakeGameAnalysis(gameIndex int, white, black string, userColor models.Color, moves []models.MoveAnalysis) models.GameAnalysis {
	headers := models.PGNHeaders{
		"White":  white,
		"Black":  black,
		"Result": "1-0",
		"Date":   "2024.01.01",
	}
	return models.GameAnalysis{
		GameIndex: gameIndex,
		Headers:   headers,
		Moves:     moves,
		UserColor: userColor,
	}
}

// SimplePGN returns a minimal valid PGN string with one game.
func SimplePGN(white, black string) string {
	return `[Event "Test"]
[Site "Test"]
[Date "2024.01.01"]
[White "` + white + `"]
[Black "` + black + `"]
[Result "1-0"]

1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 1-0`
}

// TwoGamePGN returns a PGN with two games.
func TwoGamePGN(white, black string) string {
	return `[Event "Game 1"]
[Site "Test"]
[Date "2024.01.01"]
[White "` + white + `"]
[Black "` + black + `"]
[Result "1-0"]

1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 1-0

[Event "Game 2"]
[Site "Test"]
[Date "2024.01.02"]
[White "` + black + `"]
[Black "` + white + `"]
[Result "0-1"]

1. d4 d5 2. c4 e6 3. Nc3 Nf6 0-1`
}

// ThreeGamePGN returns a PGN with three games.
func ThreeGamePGN(white, black string) string {
	return `[Event "Game 1"]
[Site "Test"]
[Date "2024.01.01"]
[White "` + white + `"]
[Black "` + black + `"]
[Result "1-0"]

1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 1-0

[Event "Game 2"]
[Site "Test"]
[Date "2024.01.02"]
[White "` + black + `"]
[Black "` + white + `"]
[Result "0-1"]

1. d4 d5 2. c4 e6 3. Nc3 Nf6 0-1

[Event "Game 3"]
[Site "Test"]
[Date "2024.01.03"]
[White "` + white + `"]
[Black "` + black + `"]
[Result "1/2-1/2"]

1. c4 e5 2. Nc3 Nf6 3. Nf3 Nc6 1/2-1/2`
}
