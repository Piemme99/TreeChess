//go:build integration

package integration

import (
	"context"
	"fmt"
	"sync"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/kumquat/backend/internal/models"
	"github.com/kumquat/backend/internal/repository"
	"github.com/kumquat/backend/internal/services"
	"github.com/kumquat/backend/internal/testhelpers"
)

func TestCascadeDelete_Analysis(t *testing.T) {
	testDB.TruncateAll(t)
	repos := testDB.Repos()
	user := testhelpers.SeedUser(t, repos, "cascadeuser", "password123")

	repertoireSvc := services.NewRepertoireService(repos.Repertoire)
	engineSvc := services.NewEngineService(repos.EngineEval, repos.Analysis, repos.OpeningExplorerCache)
	importSvc := services.NewImportService(repertoireSvc, repos.Analysis,
		services.WithFingerprintRepo(repos.Fingerprint),
		services.WithEngineService(engineSvc),
	)

	pgn := testhelpers.TwoGamePGN("cascadeuser", "opponent")
	summary, _, err := importSvc.ParseAndAnalyze(context.Background(), "test.pgn", "cascadeuser", user.ID, pgn)
	require.NoError(t, err)

	// Mark a game as viewed
	err = importSvc.MarkGameViewed(context.Background(), user.ID, summary.ID, 0)
	require.NoError(t, err)

	// Verify data exists
	evals, err := repos.EngineEval.GetByUser(context.Background(), user.ID)
	require.NoError(t, err)
	assert.NotEmpty(t, evals)

	viewed, err := repos.Analysis.GetViewedGames(context.Background(), user.ID)
	require.NoError(t, err)
	assert.NotEmpty(t, viewed)

	// Delete the analysis
	err = importSvc.DeleteAnalysis(context.Background(), summary.ID)
	require.NoError(t, err)

	// Verify all cascaded deletes
	_, err = repos.Analysis.GetByID(context.Background(), summary.ID)
	assert.ErrorIs(t, err, repository.ErrAnalysisNotFound)

	evals, err = repos.EngineEval.GetByUser(context.Background(), user.ID)
	require.NoError(t, err)
	assert.Empty(t, evals)

	viewed, err = repos.Analysis.GetViewedGames(context.Background(), user.ID)
	require.NoError(t, err)
	assert.Empty(t, viewed)

	// Fingerprints should be gone (re-import should succeed)
	_, _, err = importSvc.ParseAndAnalyze(context.Background(), "test2.pgn", "cascadeuser", user.ID, pgn)
	require.NoError(t, err)
}

func TestUniqueFingerprint(t *testing.T) {
	testDB.TruncateAll(t)
	repos := testDB.Repos()
	user := testhelpers.SeedUser(t, repos, "uniquefp", "password123")

	repertoireSvc := services.NewRepertoireService(repos.Repertoire)
	importSvc := services.NewImportService(repertoireSvc, repos.Analysis,
		services.WithFingerprintRepo(repos.Fingerprint),
	)

	pgn := testhelpers.SimplePGN("uniquefp", "opponent")

	// Import once
	_, _, err := importSvc.ParseAndAnalyze(context.Background(), "test.pgn", "uniquefp", user.ID, pgn)
	require.NoError(t, err)

	// Same fingerprint again should be rejected
	_, _, err = importSvc.ParseAndAnalyze(context.Background(), "test2.pgn", "uniquefp", user.ID, pgn)
	assert.ErrorIs(t, err, services.ErrAllGamesDuplicate)
}

func TestFingerprintUniquePerUser(t *testing.T) {
	testDB.TruncateAll(t)
	repos := testDB.Repos()
	userA := testhelpers.SeedUser(t, repos, "fpusera", "password123")
	userB := testhelpers.SeedUser(t, repos, "fpuserb", "password123")

	repertoireSvc := services.NewRepertoireService(repos.Repertoire)
	importSvc := services.NewImportService(repertoireSvc, repos.Analysis,
		services.WithFingerprintRepo(repos.Fingerprint),
	)

	pgnA := testhelpers.SimplePGN("fpusera", "opponent")

	// User A imports
	_, _, err := importSvc.ParseAndAnalyze(context.Background(), "test.pgn", "fpusera", userA.ID, pgnA)
	require.NoError(t, err)

	// User B imports a PGN where they appear as a player
	pgnB := testhelpers.SimplePGN("fpuserb", "opponent")
	_, _, err = importSvc.ParseAndAnalyze(context.Background(), "test.pgn", "fpuserb", userB.ID, pgnB)
	require.NoError(t, err)
}

func TestConcurrentRepertoireWrites(t *testing.T) {
	testDB.TruncateAll(t)
	repos := testDB.Repos()
	user := testhelpers.SeedUser(t, repos, "concuser", "password123")
	svc := services.NewRepertoireService(repos.Repertoire)

	rep, err := svc.CreateRepertoire(context.Background(), user.ID, "Concurrent", models.ColorWhite)
	require.NoError(t, err)
	rootID := rep.TreeData.ID

	// Add e4 first (shared parent)
	rep, err = svc.AddNode(context.Background(), user.ID, rep.ID, models.AddNodeRequest{ParentID: rootID, Move: "e4", MoveNumber: 1})
	require.NoError(t, err)
	e4ID := rep.TreeData.Children[0].ID

	// Multiple goroutines adding different responses to e4
	moves := []string{"e5", "c5", "e6", "d5", "c6"}
	var wg sync.WaitGroup
	errCh := make(chan error, len(moves))

	for _, move := range moves {
		wg.Add(1)
		go func(m string) {
			defer wg.Done()
			_, err := svc.AddNode(context.Background(), user.ID, rep.ID, models.AddNodeRequest{ParentID: e4ID, Move: m, MoveNumber: 1})
			if err != nil {
				errCh <- err
			}
		}(move)
	}

	wg.Wait()
	close(errCh)

	// Some may have conflicted, but the final state should be consistent
	got, err := svc.GetRepertoire(context.Background(), rep.ID)
	require.NoError(t, err)

	// Root -> e4 -> children
	assert.NotNil(t, got.TreeData.Children)
	assert.GreaterOrEqual(t, len(got.TreeData.Children[0].Children), 1,
		"at least one child move should have been added to e4")

	// Verify metadata consistency
	assert.Equal(t, got.Metadata.TotalNodes, countNodes(&got.TreeData))
}

func TestConcurrentRepertoireCreation_LimitRace(t *testing.T) {
	testDB.TruncateAll(t)
	repos := testDB.Repos()
	user := testhelpers.SeedUser(t, repos, "raceuser", "password123")

	// Seed 45 repertoires, leaving exactly 5 slots before the 50 limit.
	const seeded = 45
	for i := 0; i < seeded; i++ {
		color := models.ColorWhite
		if i%2 == 1 {
			color = models.ColorBlack
		}
		_, err := repos.Repertoire.Create(context.Background(), user.ID, fmt.Sprintf("Rep%d", i), color)
		require.NoError(t, err)
	}

	// Many goroutines contend for the final 5 slots simultaneously. Without
	// concurrency-safe limit enforcement, the trigger's COUNT(*) check is a
	// TOCTOU race: parallel transactions each read a stale count below 50 and
	// all insert, overshooting the limit.
	const racers = 30
	var wg sync.WaitGroup
	successes := make(chan bool, racers)

	for i := 0; i < racers; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			_, err := repos.Repertoire.Create(context.Background(), user.ID, fmt.Sprintf("Race%d", idx), models.ColorWhite)
			successes <- (err == nil)
		}(i)
	}

	wg.Wait()
	close(successes)

	successCount := 0
	for s := range successes {
		if s {
			successCount++
		}
	}

	// At most 5 should succeed (the remaining slots up to 50); the rest must be
	// rejected by the limit trigger.
	assert.LessOrEqual(t, successCount, 50-seeded,
		"no goroutine should succeed past the 50-repertoire limit")

	// Verify the final count never exceeds the hard limit.
	count, err := repos.Repertoire.Count(context.Background(), user.ID)
	require.NoError(t, err)
	assert.LessOrEqual(t, count, 50, "repertoire count must never exceed the limit")
}

// countNodes recursively counts all nodes in a tree.
func countNodes(node *models.RepertoireNode) int {
	if node == nil {
		return 0
	}
	count := 1
	for _, child := range node.Children {
		count += countNodes(child)
	}
	return count
}
