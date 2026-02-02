//go:build integration

package integration

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/treechess/backend/internal/models"
	"github.com/treechess/backend/internal/services"
	"github.com/treechess/backend/internal/testhelpers"
)

func TestEngineEvalPipeline(t *testing.T) {
	testDB.TruncateAll(t)
	repos := testDB.Repos()
	user := testhelpers.SeedUser(t, repos, "evaluser", "password123")

	repertoireSvc := services.NewRepertoireService(repos.Repertoire)
	engineSvc := services.NewEngineService(repos.EngineEval, repos.Analysis)
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
	engineSvc := services.NewEngineService(repos.EngineEval, repos.Analysis)
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
	e4Rep, _ = repertoireSvc.AddNode(e4Rep.ID, models.AddNodeRequest{ParentID: e4Rep.TreeData.ID, Move: "e4", MoveNumber: 1})

	// Create d4 repertoire
	d4Rep, _ := repertoireSvc.CreateRepertoire(user.ID, "d4", "white")
	d4Rep, _ = repertoireSvc.AddNode(d4Rep.ID, models.AddNodeRequest{ParentID: d4Rep.TreeData.ID, Move: "d4", MoveNumber: 1})

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
