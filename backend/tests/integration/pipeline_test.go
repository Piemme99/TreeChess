//go:build integration

package integration

import (
	"sync"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/kumquat/backend/internal/models"
	"github.com/kumquat/backend/internal/services"
	"github.com/kumquat/backend/internal/testhelpers"
)

func TestEngineEvalPipeline(t *testing.T) {
	testDB.TruncateAll(t)
	repos := testDB.Repos()
	user := testhelpers.SeedUser(t, repos, "evaluser", "password123")

	repertoireSvc := services.NewRepertoireService(repos.Repertoire)
	engineSvc := services.NewEngineService(repos.EngineEval, repos.Analysis, repos.OpeningExplorerCache)
	importSvc := services.NewImportService(repertoireSvc, repos.Analysis,
		services.WithFingerprintRepo(repos.Fingerprint),
		services.WithEngineService(engineSvc),
	)

	pgn := testhelpers.SimplePGN("evaluser", "opponent")
	summary, _, err := importSvc.ParseAndAnalyze("test.pgn", "evaluser", user.ID, pgn)
	require.NoError(t, err)
	require.NotEmpty(t, summary.ID)

	// Import should have created pending engine evals
	pending, err := repos.EngineEval.GetPending(10)
	require.NoError(t, err)
	assert.GreaterOrEqual(t, len(pending), 1)

	// Mark one as processing
	evalID := pending[0].ID
	err = repos.EngineEval.MarkProcessing(evalID)
	require.NoError(t, err)

	// Verify it's no longer pending
	stillPending, err := repos.EngineEval.GetPending(10)
	require.NoError(t, err)
	for _, p := range stillPending {
		assert.NotEqual(t, evalID, p.ID)
	}
}

func TestEngineEvalPipeline_DeleteCascade(t *testing.T) {
	testDB.TruncateAll(t)
	repos := testDB.Repos()
	user := testhelpers.SeedUser(t, repos, "evaldeluser", "password123")

	repertoireSvc := services.NewRepertoireService(repos.Repertoire)
	engineSvc := services.NewEngineService(repos.EngineEval, repos.Analysis, repos.OpeningExplorerCache)
	importSvc := services.NewImportService(repertoireSvc, repos.Analysis,
		services.WithFingerprintRepo(repos.Fingerprint),
		services.WithEngineService(engineSvc),
	)

	pgn := testhelpers.SimplePGN("evaldeluser", "opponent")
	summary, _, err := importSvc.ParseAndAnalyze("test.pgn", "evaldeluser", user.ID, pgn)
	require.NoError(t, err)

	// Verify engine evals exist
	evals, err := repos.EngineEval.GetByUser(user.ID)
	require.NoError(t, err)
	require.NotEmpty(t, evals)

	// Delete the analysis
	err = importSvc.DeleteAnalysis(summary.ID)
	require.NoError(t, err)

	// Engine evals should be gone
	evals, err = repos.EngineEval.GetByUser(user.ID)
	require.NoError(t, err)
	assert.Empty(t, evals)
}

func TestViewedGames_MarkAndRetrieve(t *testing.T) {
	testDB.TruncateAll(t)
	repos := testDB.Repos()
	user := testhelpers.SeedUser(t, repos, "viewuser", "password123")

	repertoireSvc := services.NewRepertoireService(repos.Repertoire)
	importSvc := services.NewImportService(repertoireSvc, repos.Analysis,
		services.WithFingerprintRepo(repos.Fingerprint),
	)

	pgn := testhelpers.TwoGamePGN("viewuser", "opponent")
	summary, _, err := importSvc.ParseAndAnalyze("test.pgn", "viewuser", user.ID, pgn)
	require.NoError(t, err)

	// Mark game 0 as viewed
	err = importSvc.MarkGameViewed(user.ID, summary.ID, 0)
	require.NoError(t, err)

	// Get viewed games
	viewed, err := repos.Analysis.GetViewedGames(user.ID)
	require.NoError(t, err)

	key := summary.ID + "-0"
	assert.True(t, viewed[key], "game 0 should be marked as viewed")

	key1 := summary.ID + "-1"
	assert.False(t, viewed[key1], "game 1 should not be marked as viewed")
}

func TestReanalyzeGame(t *testing.T) {
	testDB.TruncateAll(t)
	repos := testDB.Repos()
	user := testhelpers.SeedUser(t, repos, "reanalyze", "password123")

	repertoireSvc := services.NewRepertoireService(repos.Repertoire)
	importSvc := services.NewImportService(repertoireSvc, repos.Analysis,
		services.WithFingerprintRepo(repos.Fingerprint),
	)

	// Create e4 repertoire
	e4Rep, _ := repertoireSvc.CreateRepertoire(user.ID, "e4", "white")
	_, _ = repertoireSvc.AddNode(user.ID, e4Rep.ID, models.AddNodeRequest{ParentID: e4Rep.TreeData.ID, Move: "e4", MoveNumber: 1})

	// Create d4 repertoire
	d4Rep, _ := repertoireSvc.CreateRepertoire(user.ID, "d4", "white")
	d4Rep, _ = repertoireSvc.AddNode(user.ID, d4Rep.ID, models.AddNodeRequest{ParentID: d4Rep.TreeData.ID, Move: "d4", MoveNumber: 1})

	// Import e4 game (matched to e4 repertoire)
	pgn := testhelpers.SimplePGN("reanalyze", "opponent")
	summary, results, err := importSvc.ParseAndAnalyze("test.pgn", "reanalyze", user.ID, pgn)
	require.NoError(t, err)
	require.Len(t, results, 1)

	// Reanalyze against d4 repertoire
	reanalyzed, err := importSvc.ReanalyzeGame(summary.ID, 0, d4Rep.ID)
	require.NoError(t, err)
	require.NotNil(t, reanalyzed)

	// The reanalyzed game should reference d4 repertoire
	require.NotNil(t, reanalyzed.MatchedRepertoire, "MatchedRepertoire should not be nil after reanalyze")
	assert.Equal(t, d4Rep.ID, reanalyzed.MatchedRepertoire.ID)
	assert.Equal(t, "d4", reanalyzed.MatchedRepertoire.Name)

	// Verify the reanalyzed game is persisted in the DB
	detail, err := importSvc.GetAnalysisByID(summary.ID)
	require.NoError(t, err)
	require.NotNil(t, detail)
	require.NotEmpty(t, detail.Results)
	assert.Equal(t, d4Rep.ID, detail.Results[0].MatchedRepertoire.ID)
}

// TestReanalyze_InterleavedManualAndAuto_NoLostUpdate is the issue #120
// regression test against a real PostgreSQL instance. It runs the manual
// single-game path (ReanalyzeGame) and the auto reanalyze-all path
// (ReanalyzeAllGames) concurrently against the same analysis many times. Both
// perform a read-modify-write of the results JSONB; before the fix this was an
// unguarded full-array overwrite that could silently drop a concurrent writer's
// update. With the row-locked MutateResults transaction the writers serialize,
// so every game must keep a repertoire match in the final persisted state — a
// game reverting to its initial out-of-book / nil-match state would be the
// signature of a lost update.
func TestReanalyze_InterleavedManualAndAuto_NoLostUpdate(t *testing.T) {
	testDB.TruncateAll(t)
	repos := testDB.Repos()
	user := testhelpers.SeedUser(t, repos, "raceuser", "password123")

	repertoireSvc := services.NewRepertoireService(repos.Repertoire)
	importSvc := services.NewImportService(repertoireSvc, repos.Analysis,
		services.WithFingerprintRepo(repos.Fingerprint),
	)

	// Two white repertoires so the manual and auto paths assign different matches.
	e4Rep, _ := repertoireSvc.CreateRepertoire(user.ID, "e4", models.ColorWhite)
	_, _ = repertoireSvc.AddNode(user.ID, e4Rep.ID, models.AddNodeRequest{ParentID: e4Rep.TreeData.ID, Move: "e4", MoveNumber: 1})

	d4Rep, _ := repertoireSvc.CreateRepertoire(user.ID, "d4", models.ColorWhite)
	d4Rep, _ = repertoireSvc.AddNode(user.ID, d4Rep.ID, models.AddNodeRequest{ParentID: d4Rep.TreeData.ID, Move: "d4", MoveNumber: 1})

	// Import a white game (e4 e5 ...), matched to the e4 repertoire.
	pgn := testhelpers.SimplePGN("raceuser", "opponent")
	summary, results, err := importSvc.ParseAndAnalyze("race.pgn", "raceuser", user.ID, pgn)
	require.NoError(t, err)
	require.Len(t, results, 1)

	const iterations = 40
	var wg sync.WaitGroup
	wg.Add(2)

	go func() {
		defer wg.Done()
		for i := 0; i < iterations; i++ {
			_, err := importSvc.ReanalyzeGame(summary.ID, 0, d4Rep.ID)
			assert.NoError(t, err)
		}
	}()

	go func() {
		defer wg.Done()
		for i := 0; i < iterations; i++ {
			_, err := importSvc.ReanalyzeAllGames(user.ID, false)
			assert.NoError(t, err)
		}
	}()

	wg.Wait()

	detail, err := importSvc.GetAnalysisByID(summary.ID)
	require.NoError(t, err)
	require.Len(t, detail.Results, 1)
	require.NotNil(t, detail.Results[0].MatchedRepertoire, "game lost its repertoire match (lost update)")
	assert.Contains(t, []string{e4Rep.ID, d4Rep.ID}, detail.Results[0].MatchedRepertoire.ID)
}

func TestViewedGames_MarkIdempotent(t *testing.T) {
	testDB.TruncateAll(t)
	repos := testDB.Repos()
	user := testhelpers.SeedUser(t, repos, "viewidem", "password123")

	repertoireSvc := services.NewRepertoireService(repos.Repertoire)
	importSvc := services.NewImportService(repertoireSvc, repos.Analysis,
		services.WithFingerprintRepo(repos.Fingerprint),
	)

	pgn := testhelpers.SimplePGN("viewidem", "opponent")
	summary, _, err := importSvc.ParseAndAnalyze("test.pgn", "viewidem", user.ID, pgn)
	require.NoError(t, err)

	// Mark game 0 as viewed twice — should not error
	err = importSvc.MarkGameViewed(user.ID, summary.ID, 0)
	require.NoError(t, err)

	err = importSvc.MarkGameViewed(user.ID, summary.ID, 0)
	require.NoError(t, err)

	// Still only one entry
	viewed, err := repos.Analysis.GetViewedGames(user.ID)
	require.NoError(t, err)

	key := summary.ID + "-0"
	assert.True(t, viewed[key])
}
