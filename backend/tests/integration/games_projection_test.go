//go:build integration

package integration

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/kumquat/backend/internal/models"
	"github.com/kumquat/backend/internal/testhelpers"
)

// makeProjectionGame builds a GameAnalysis carrying the headers the games
// projection denormalizes (White/Black/Result/Date/TimeControl/Opening) plus an
// optional matched repertoire.
func makeProjectionGame(idx int, white, black, timeControl string, rep *models.RepertoireRef) models.GameAnalysis {
	return models.GameAnalysis{
		GameIndex: idx,
		Headers: models.PGNHeaders{
			"White":       white,
			"Black":       black,
			"Result":      "1-0",
			"Date":        "2024.01.01",
			"TimeControl": timeControl,
			"Opening":     "Ruy Lopez",
		},
		UserColor: models.ColorWhite,
		Moves: []models.MoveAnalysis{
			{PlyNumber: 0, SAN: "e4", Status: "in-repertoire", IsUserMove: true},
		},
		MatchedRepertoire: rep,
	}
}

// countGamesRows reads the row count of the `games` projection directly, proving
// the write path materialized one row per game (no JSONB unmarshal involved).
func countGamesRows(t *testing.T, userID string) int {
	t.Helper()
	var n int
	err := testDB.Pool.QueryRow(context.Background(),
		`SELECT COUNT(*) FROM games WHERE user_id = $1`, userID).Scan(&n)
	require.NoError(t, err)
	return n
}

// TestGamesProjection_BoundedPagination seeds far more games than a single page
// and asserts each paginated GetAllGames call returns at most `limit` rows with
// the correct global Total. The page query is a SQL LIMIT/OFFSET over the `games`
// projection, so per-page work is bounded regardless of total history size —
// this is the core acceptance criterion of issue #123.
func TestGamesProjection_BoundedPagination(t *testing.T) {
	testDB.TruncateAll(t)
	repos := testDB.Repos()
	user := testhelpers.SeedUser(t, repos, "projuser", "password123")

	const analyses = 30
	const gamesPer = 10
	const totalGames = analyses * gamesPer

	for a := 0; a < analyses; a++ {
		games := make([]models.GameAnalysis, gamesPer)
		for g := 0; g < gamesPer; g++ {
			games[g] = makeProjectionGame(g, "projuser", fmt.Sprintf("opp-%d-%d", a, g), "600+0", nil)
		}
		_, err := repos.Analysis.Save(user.ID, "projuser", fmt.Sprintf("batch%d.pgn", a), gamesPer, games)
		require.NoError(t, err)
	}

	// Write path must have materialized exactly one projection row per game.
	assert.Equal(t, totalGames, countGamesRows(t, user.ID))

	// Each page returns at most `limit` rows and the same Total.
	const limit = 25
	seen := 0
	for offset := 0; offset < totalGames; offset += limit {
		page, err := repos.Analysis.GetAllGames(user.ID, limit, offset, "", "", "", false)
		require.NoError(t, err)
		assert.Equal(t, totalGames, page.Total)
		assert.LessOrEqual(t, len(page.Games), limit, "page must never exceed the requested limit")
		seen += len(page.Games)
	}
	assert.Equal(t, totalGames, seen, "pagination must enumerate every game exactly once")

	// Offset past the end yields an empty (non-nil) slice with the real Total.
	beyond, err := repos.Analysis.GetAllGames(user.ID, limit, totalGames+limit, "", "", "", false)
	require.NoError(t, err)
	assert.Empty(t, beyond.Games)
	assert.Equal(t, totalGames, beyond.Total)
}

// TestGamesProjection_SQLFilters verifies time-class, source and repertoire
// filters plus distinct-repertoire listing all resolve against the projection in
// SQL (correct counts without scanning JSONB).
func TestGamesProjection_SQLFilters(t *testing.T) {
	testDB.TruncateAll(t)
	repos := testDB.Repos()
	user := testhelpers.SeedUser(t, repos, "filterproj", "password123")

	repA := &models.RepertoireRef{ID: "11111111-1111-1111-1111-111111111111", Name: "Repertoire A"}
	repB := &models.RepertoireRef{ID: "22222222-2222-2222-2222-222222222222", Name: "Repertoire B"}

	// A regular PGN import: 2 blitz games on repA, 1 bullet game on repB.
	pgnGames := []models.GameAnalysis{
		makeProjectionGame(0, "filterproj", "opp0", "300+0", repA),
		makeProjectionGame(1, "filterproj", "opp1", "300+0", repA),
		makeProjectionGame(2, "filterproj", "opp2", "60+0", repB),
	}
	_, err := repos.Analysis.Save(user.ID, "filterproj", "my_games.pgn", len(pgnGames), pgnGames)
	require.NoError(t, err)

	// A synced lichess import: 1 rapid game, no matched repertoire.
	syncGames := []models.GameAnalysis{
		makeProjectionGame(0, "filterproj", "opp3", "900+0", nil),
	}
	_, err = repos.Analysis.Save(user.ID, "filterproj", "sync_lichess_filterproj.pgn", len(syncGames), syncGames)
	require.NoError(t, err)

	// Source filter.
	pgnOnly, err := repos.Analysis.GetAllGames(user.ID, 50, 0, "", "", "pgn", false)
	require.NoError(t, err)
	assert.Equal(t, 3, pgnOnly.Total)

	lichessOnly, err := repos.Analysis.GetAllGames(user.ID, 50, 0, "", "", "lichess", false)
	require.NoError(t, err)
	assert.Equal(t, 1, lichessOnly.Total)

	// Time-class filter (blitz = the two 300+0 games).
	blitz, err := repos.Analysis.GetAllGames(user.ID, 50, 0, "blitz", "", "", false)
	require.NoError(t, err)
	assert.Equal(t, 2, blitz.Total)

	// Repertoire filter.
	repBGames, err := repos.Analysis.GetAllGames(user.ID, 50, 0, "", repB.ID, "", false)
	require.NoError(t, err)
	assert.Equal(t, 1, repBGames.Total)

	// Distinct repertoires (sorted by name) only includes matched repertoires.
	dr, err := repos.Analysis.GetDistinctRepertoires(user.ID)
	require.NoError(t, err)
	require.Len(t, dr, 2)
	assert.Equal(t, "Repertoire A", dr[0].Name)
	assert.Equal(t, "Repertoire B", dr[1].Name)
}

// TestGamesProjection_OnlyNewExcludesViewed proves the synced-and-not-viewed
// "new" flag is computed in SQL against viewed_games: marking a synced game
// viewed drops it from the onlyNew result without re-deserializing anything.
func TestGamesProjection_OnlyNewExcludesViewed(t *testing.T) {
	testDB.TruncateAll(t)
	repos := testDB.Repos()
	user := testhelpers.SeedUser(t, repos, "newproj", "password123")

	syncGames := []models.GameAnalysis{
		makeProjectionGame(0, "newproj", "opp0", "300+0", nil),
		makeProjectionGame(1, "newproj", "opp1", "300+0", nil),
	}
	summary, err := repos.Analysis.Save(user.ID, "newproj", "sync_lichess_newproj.pgn", len(syncGames), syncGames)
	require.NoError(t, err)

	// Both synced games start as "new".
	before, err := repos.Analysis.GetAllGames(user.ID, 50, 0, "", "", "", true)
	require.NoError(t, err)
	assert.Equal(t, 2, before.Total)
	for _, g := range before.Games {
		assert.True(t, g.Synced, "unviewed synced game should report synced=true")
	}

	// Mark one viewed → it is no longer "new".
	require.NoError(t, repos.Analysis.MarkGameViewed(user.ID, summary.ID, 0))

	after, err := repos.Analysis.GetAllGames(user.ID, 50, 0, "", "", "", true)
	require.NoError(t, err)
	assert.Equal(t, 1, after.Total)
}

// TestGamesProjection_UpdateResultsRebuilds proves UpdateResults keeps the
// projection consistent: shrinking an analysis's results removes the stale
// projection rows in the same transaction (no orphans).
func TestGamesProjection_UpdateResultsRebuilds(t *testing.T) {
	testDB.TruncateAll(t)
	repos := testDB.Repos()
	user := testhelpers.SeedUser(t, repos, "rebuildproj", "password123")

	initial := []models.GameAnalysis{
		makeProjectionGame(0, "rebuildproj", "opp0", "300+0", nil),
		makeProjectionGame(1, "rebuildproj", "opp1", "300+0", nil),
		makeProjectionGame(2, "rebuildproj", "opp2", "300+0", nil),
	}
	summary, err := repos.Analysis.Save(user.ID, "rebuildproj", "rebuild.pgn", len(initial), initial)
	require.NoError(t, err)
	assert.Equal(t, 3, countGamesRows(t, user.ID))

	// Re-write with fewer games → projection shrinks, no stale rows remain.
	reduced := initial[:1]
	require.NoError(t, repos.Analysis.UpdateResults(summary.ID, reduced))
	assert.Equal(t, 1, countGamesRows(t, user.ID))

	page, err := repos.Analysis.GetAllGames(user.ID, 50, 0, "", "", "", false)
	require.NoError(t, err)
	assert.Equal(t, 1, page.Total)
}
