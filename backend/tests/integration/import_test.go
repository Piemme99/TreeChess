//go:build integration

package integration

import (
	"bytes"
	"encoding/json"
	"fmt"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/kumquat/backend/config"
	"github.com/kumquat/backend/internal/models"
	"github.com/kumquat/backend/internal/repository"
	"github.com/kumquat/backend/internal/services"
	"github.com/kumquat/backend/internal/testhelpers"
)

func TestImportPipeline_FullCycle(t *testing.T) {
	testDB.TruncateAll(t)
	repos := testDB.Repos()
	user := testhelpers.SeedUser(t, repos, "importuser", "password123")

	repertoireSvc := services.NewRepertoireService(repos.Repertoire)
	engineSvc := services.NewEngineService(repos.EngineEval, repos.Analysis, repos.OpeningExplorerCache)
	importSvc := services.NewImportService(repertoireSvc, repos.Analysis,
		services.WithFingerprintRepo(repos.Fingerprint),
		services.WithEngineService(engineSvc),
	)

	// Create white repertoire with e4 -> e5 -> Nf3
	rep, _ := repertoireSvc.CreateRepertoire(user.ID, "White e4", models.ColorWhite)
	rep, _ = repertoireSvc.AddNode(user.ID, rep.ID, models.AddNodeRequest{ParentID: rep.TreeData.ID, Move: "e4", MoveNumber: 1})
	e4ID := rep.TreeData.Children[0].ID
	rep, _ = repertoireSvc.AddNode(user.ID, rep.ID, models.AddNodeRequest{ParentID: e4ID, Move: "e5", MoveNumber: 1})
	e5ID := rep.TreeData.Children[0].Children[0].ID
	_, _ = repertoireSvc.AddNode(user.ID, rep.ID, models.AddNodeRequest{ParentID: e5ID, Move: "Nf3", MoveNumber: 2})

	pgn := testhelpers.SimplePGN("importuser", "opponent")
	summary, results, err := importSvc.ParseAndAnalyze("test.pgn", "importuser", user.ID, pgn)
	require.NoError(t, err)

	assert.Equal(t, 1, summary.GameCount)
	assert.Equal(t, "importuser", summary.Username)
	assert.NotEmpty(t, summary.ID)

	// Verify move statuses
	require.Len(t, results, 1)
	game := results[0]
	assert.Equal(t, models.Color("white"), game.UserColor)

	// The game plays 1.e4 e5 2.Nf3 Nc6 3.Bb5 a6
	// e4, Nf3, Bb5 are user moves (white)
	// e4 and Nf3 are in repertoire; after Nf3 the repertoire ends,
	// so Bb5 and subsequent moves are "out-of-book" (beyond the repertoire tree)
	hasInRepertoire := false
	hasOutOfBook := false
	for _, move := range game.Moves {
		if move.Status == "in-repertoire" {
			hasInRepertoire = true
		}
		if move.Status == "out-of-book" {
			hasOutOfBook = true
		}
	}
	assert.True(t, hasInRepertoire, "should have in-repertoire moves")
	assert.True(t, hasOutOfBook, "should have out-of-book moves after repertoire ends")

	// Verify matched repertoire
	require.NotNil(t, game.MatchedRepertoire)
	assert.Equal(t, rep.ID, game.MatchedRepertoire.ID)

	// Verify analysis is persisted and retrievable
	detail, err := importSvc.GetAnalysisByID(summary.ID, user.ID)
	require.NoError(t, err)
	assert.Equal(t, 1, detail.GameCount)
	assert.Equal(t, "importuser", detail.Username)
	assert.Len(t, detail.Results, 1)
}

func TestImportPipeline_AsBlack(t *testing.T) {
	testDB.TruncateAll(t)
	repos := testDB.Repos()
	user := testhelpers.SeedUser(t, repos, "blackuser", "password123")

	repertoireSvc := services.NewRepertoireService(repos.Repertoire)
	importSvc := services.NewImportService(repertoireSvc, repos.Analysis,
		services.WithFingerprintRepo(repos.Fingerprint),
	)

	// Create a black repertoire with e4 -> e5
	rep, _ := repertoireSvc.CreateRepertoire(user.ID, "Black vs e4", models.ColorBlack)
	rep, _ = repertoireSvc.AddNode(user.ID, rep.ID, models.AddNodeRequest{ParentID: rep.TreeData.ID, Move: "e4", MoveNumber: 1})
	e4ID := rep.TreeData.Children[0].ID
	_, _ = repertoireSvc.AddNode(user.ID, rep.ID, models.AddNodeRequest{ParentID: e4ID, Move: "e5", MoveNumber: 1})

	// Import a game where user plays as black
	pgn := `[Event "Test"]
[Site "Test"]
[Date "2024.01.01"]
[White "opponent"]
[Black "blackuser"]
[Result "0-1"]

1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 0-1`

	summary, results, err := importSvc.ParseAndAnalyze("test.pgn", "blackuser", user.ID, pgn)
	require.NoError(t, err)
	assert.Equal(t, 1, summary.GameCount)
	require.Len(t, results, 1)
	assert.Equal(t, models.Color("black"), results[0].UserColor)

	// Should match the black repertoire
	require.NotNil(t, results[0].MatchedRepertoire)
	assert.Equal(t, rep.ID, results[0].MatchedRepertoire.ID)
}

func TestImportPipeline_FingerprintDedup(t *testing.T) {
	testDB.TruncateAll(t)
	repos := testDB.Repos()
	user := testhelpers.SeedUser(t, repos, "dedupuser", "password123")

	repertoireSvc := services.NewRepertoireService(repos.Repertoire)
	importSvc := services.NewImportService(repertoireSvc, repos.Analysis,
		services.WithFingerprintRepo(repos.Fingerprint),
	)

	pgn := testhelpers.SimplePGN("dedupuser", "opponent")

	// First import
	_, _, err := importSvc.ParseAndAnalyze("test.pgn", "dedupuser", user.ID, pgn)
	require.NoError(t, err)

	// Second import of same PGN → all duplicates
	_, _, err = importSvc.ParseAndAnalyze("test2.pgn", "dedupuser", user.ID, pgn)
	assert.ErrorIs(t, err, services.ErrAllGamesDuplicate)
}

func TestImportPipeline_FingerprintDedup_Partial(t *testing.T) {
	testDB.TruncateAll(t)
	repos := testDB.Repos()
	user := testhelpers.SeedUser(t, repos, "partialdedup", "password123")

	repertoireSvc := services.NewRepertoireService(repos.Repertoire)
	importSvc := services.NewImportService(repertoireSvc, repos.Analysis,
		services.WithFingerprintRepo(repos.Fingerprint),
	)

	// Import 2 games
	twoGamePGN := testhelpers.TwoGamePGN("partialdedup", "opponent")
	summary1, _, err := importSvc.ParseAndAnalyze("batch1.pgn", "partialdedup", user.ID, twoGamePGN)
	require.NoError(t, err)
	assert.Equal(t, 2, summary1.GameCount)

	// Import PGN with 1 duplicate (same as Game 1 from TwoGamePGN) + 1 new game
	mixedPGN := `[Event "Game 1"]
[Site "Test"]
[Date "2024.01.01"]
[White "partialdedup"]
[Black "opponent"]
[Result "1-0"]

1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 1-0

[Event "Brand New"]
[Site "Test"]
[Date "2024.03.01"]
[White "partialdedup"]
[Black "newopponent"]
[Result "0-1"]

1. d4 Nf6 2. c4 e6 3. Nc3 Bb4 0-1`

	summary2, _, err := importSvc.ParseAndAnalyze("batch2.pgn", "partialdedup", user.ID, mixedPGN)
	require.NoError(t, err)
	assert.Equal(t, 1, summary2.GameCount)
	assert.Equal(t, 1, summary2.SkippedDuplicates)
}

func TestImportPipeline_DeleteAnalysis_CascadeAll(t *testing.T) {
	testDB.TruncateAll(t)
	repos := testDB.Repos()
	user := testhelpers.SeedUser(t, repos, "delanalysis", "password123")

	repertoireSvc := services.NewRepertoireService(repos.Repertoire)
	engineSvc := services.NewEngineService(repos.EngineEval, repos.Analysis, repos.OpeningExplorerCache)
	importSvc := services.NewImportService(repertoireSvc, repos.Analysis,
		services.WithFingerprintRepo(repos.Fingerprint),
		services.WithEngineService(engineSvc),
	)

	pgn := testhelpers.SimplePGN("delanalysis", "opponent")
	summary, _, err := importSvc.ParseAndAnalyze("test.pgn", "delanalysis", user.ID, pgn)
	require.NoError(t, err)

	// Delete the analysis
	err = importSvc.DeleteAnalysis(summary.ID, user.ID)
	require.NoError(t, err)

	// Verify analysis is gone
	analyses, err := importSvc.GetAnalyses(user.ID)
	require.NoError(t, err)
	assert.Len(t, analyses, 0)

	// Re-importing should succeed (fingerprints cascaded)
	_, _, err = importSvc.ParseAndAnalyze("test2.pgn", "delanalysis", user.ID, pgn)
	require.NoError(t, err)
}

func TestImportPipeline_ListGames_Pagination(t *testing.T) {
	testDB.TruncateAll(t)
	repos := testDB.Repos()
	user := testhelpers.SeedUser(t, repos, "paginuser", "password123")

	repertoireSvc := services.NewRepertoireService(repos.Repertoire)
	importSvc := services.NewImportService(repertoireSvc, repos.Analysis,
		services.WithFingerprintRepo(repos.Fingerprint),
	)

	// Import 3 batches of 3 games each
	for i := 0; i < 3; i++ {
		pgn := testhelpers.ThreeGamePGN(
			"paginuser",
			fmt.Sprintf("opp%d", i),
		)
		_, _, err := importSvc.ParseAndAnalyze(fmt.Sprintf("batch%d.pgn", i), "paginuser", user.ID, pgn)
		require.NoError(t, err)
	}

	// Get all games with limit/offset
	page1, err := importSvc.GetAllGames(user.ID, 5, 0, "", "", "", false)
	require.NoError(t, err)
	assert.Equal(t, 9, page1.Total)
	assert.Len(t, page1.Games, 5)

	page2, err := importSvc.GetAllGames(user.ID, 5, 5, "", "", "", false)
	require.NoError(t, err)
	assert.Len(t, page2.Games, 4)
}

func TestImportPipeline_ListGames_SourceFilter(t *testing.T) {
	testDB.TruncateAll(t)
	repos := testDB.Repos()
	user := testhelpers.SeedUser(t, repos, "filteruser", "password123")

	repertoireSvc := services.NewRepertoireService(repos.Repertoire)
	importSvc := services.NewImportService(repertoireSvc, repos.Analysis,
		services.WithFingerprintRepo(repos.Fingerprint),
	)

	// Import with regular PGN filename
	pgn1 := testhelpers.SimplePGN("filteruser", "opp1")
	_, _, err := importSvc.ParseAndAnalyze("my_games.pgn", "filteruser", user.ID, pgn1)
	require.NoError(t, err)

	// Import with lichess-style filename
	pgn2 := `[Event "Lichess Game"]
[Site "Test"]
[Date "2024.02.01"]
[White "filteruser"]
[Black "opp2"]
[Result "1-0"]

1. d4 d5 2. c4 e6 3. Nc3 Nf6 1-0`
	_, _, err = importSvc.ParseAndAnalyze("lichess_filteruser.pgn", "filteruser", user.ID, pgn2)
	require.NoError(t, err)

	// Filter by source=pgn
	pgnGames, err := importSvc.GetAllGames(user.ID, 20, 0, "", "", "pgn", false)
	require.NoError(t, err)
	assert.Equal(t, 1, pgnGames.Total)

	// Filter by source=lichess
	lichessGames, err := importSvc.GetAllGames(user.ID, 20, 0, "", "", "lichess", false)
	require.NoError(t, err)
	assert.Equal(t, 1, lichessGames.Total)

	// No filter returns all
	allGames, err := importSvc.GetAllGames(user.ID, 20, 0, "", "", "", false)
	require.NoError(t, err)
	assert.Equal(t, 2, allGames.Total)
}

func TestImportPipeline_MatchesBestRepertoire(t *testing.T) {
	testDB.TruncateAll(t)
	repos := testDB.Repos()
	user := testhelpers.SeedUser(t, repos, "matchuser", "password123")

	repertoireSvc := services.NewRepertoireService(repos.Repertoire)
	importSvc := services.NewImportService(repertoireSvc, repos.Analysis,
		services.WithFingerprintRepo(repos.Fingerprint),
	)

	// Create e4 repertoire
	e4Rep, _ := repertoireSvc.CreateRepertoire(user.ID, "e4 Rep", models.ColorWhite)
	e4Rep, _ = repertoireSvc.AddNode(user.ID, e4Rep.ID, models.AddNodeRequest{ParentID: e4Rep.TreeData.ID, Move: "e4", MoveNumber: 1})

	// Create d4 repertoire
	_, _ = repertoireSvc.CreateRepertoire(user.ID, "d4 Rep", models.ColorWhite)

	// Import an e4 game
	pgn := testhelpers.SimplePGN("matchuser", "opponent")
	_, results, err := importSvc.ParseAndAnalyze("test.pgn", "matchuser", user.ID, pgn)
	require.NoError(t, err)
	require.Len(t, results, 1)

	// Should match e4 repertoire
	require.NotNil(t, results[0].MatchedRepertoire, "should have matched a repertoire")
	assert.Equal(t, e4Rep.ID, results[0].MatchedRepertoire.ID)
}

func TestImportPipeline_NoRepertoire_StillSaves(t *testing.T) {
	testDB.TruncateAll(t)
	repos := testDB.Repos()
	user := testhelpers.SeedUser(t, repos, "norepuser", "password123")

	repertoireSvc := services.NewRepertoireService(repos.Repertoire)
	importSvc := services.NewImportService(repertoireSvc, repos.Analysis,
		services.WithFingerprintRepo(repos.Fingerprint),
	)

	pgn := testhelpers.SimplePGN("norepuser", "opponent")
	summary, results, err := importSvc.ParseAndAnalyze("test.pgn", "norepuser", user.ID, pgn)
	require.NoError(t, err)
	assert.Equal(t, 1, summary.GameCount)
	assert.Len(t, results, 1)

	// MatchedRepertoire should be nil
	assert.Nil(t, results[0].MatchedRepertoire)
}

func TestImportPipeline_ReanalyzeColorMismatch(t *testing.T) {
	testDB.TruncateAll(t)
	repos := testDB.Repos()
	user := testhelpers.SeedUser(t, repos, "mismatchuser", "password123")

	repertoireSvc := services.NewRepertoireService(repos.Repertoire)
	importSvc := services.NewImportService(repertoireSvc, repos.Analysis,
		services.WithFingerprintRepo(repos.Fingerprint),
	)

	// Create a BLACK repertoire
	blackRep, _ := repertoireSvc.CreateRepertoire(user.ID, "Black Rep", models.ColorBlack)

	// Import a game where user plays WHITE
	pgn := testhelpers.SimplePGN("mismatchuser", "opponent")
	summary, _, err := importSvc.ParseAndAnalyze("test.pgn", "mismatchuser", user.ID, pgn)
	require.NoError(t, err)

	// Reanalyze a white game against a black repertoire → color mismatch
	_, err = importSvc.ReanalyzeGame(summary.ID, user.ID, 0, blackRep.ID)
	assert.ErrorIs(t, err, services.ErrColorMismatch)
}

func TestImportPipeline_HandlerLevel_Upload(t *testing.T) {
	testDB.TruncateAll(t)
	repos := testDB.Repos()
	ts := testhelpers.SetupTestServer(t, repos)
	token := ts.AuthToken(t, "uploaduser", "password123")

	// Create multipart form
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	_ = writer.WriteField("username", "uploaduser")
	part, err := writer.CreateFormFile("file", "test.pgn")
	require.NoError(t, err)
	_, _ = part.Write([]byte(testhelpers.SimplePGN("uploaduser", "opponent")))
	_ = writer.Close()

	req := httptest.NewRequest(http.MethodPost, "/api/imports", body)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	req.Header.Set("Authorization", "Bearer "+token)

	rec := ts.DoRequest(req)
	assert.Equal(t, http.StatusCreated, rec.Code)

	var resp map[string]interface{}
	err = json.Unmarshal(rec.Body.Bytes(), &resp)
	require.NoError(t, err)
	assert.Equal(t, float64(1), resp["gameCount"])
	assert.NotEmpty(t, resp["id"])
}

// TestFingerprintRepo_ChunkedBatchOps exercises SaveBatch and CheckExisting
// with far more rows than config.DBBatchSize. Before chunking, SaveBatch would
// emit one INSERT with 4*N parameters (failing past ~16k games) and
// CheckExisting one IN-clause with N parameters (failing past ~65k). This test
// proves the chunked implementation handles a count that spans multiple
// chunks without hitting Postgres's 65535-parameter limit.
func TestFingerprintRepo_ChunkedBatchOps(t *testing.T) {
	testDB.TruncateAll(t)
	repos := testDB.Repos()
	user := testhelpers.SeedUser(t, repos, "chunkuser", "password123")

	// Create a real analysis row so the analysis_id FK is satisfied.
	summary, err := repos.Analysis.Save(user.ID, "chunkuser", "chunk.pgn", 0, []models.GameAnalysis{})
	require.NoError(t, err)

	// 2500 entries forces 3 chunks at DBBatchSize=1000.
	const total = 2*config.DBBatchSize + 500
	entries := make([]repository.FingerprintEntry, total)
	want := make([]string, total)
	for i := 0; i < total; i++ {
		fp := fmt.Sprintf("fp-%05d", i)
		entries[i] = repository.FingerprintEntry{Fingerprint: fp, GameIndex: i}
		want[i] = fp
	}

	// SaveBatch must succeed across all chunks.
	require.NoError(t, repos.Fingerprint.SaveBatch(user.ID, summary.ID, entries))

	// CheckExisting must report every fingerprint as existing.
	existing, err := repos.Fingerprint.CheckExisting(user.ID, want)
	require.NoError(t, err)
	assert.Len(t, existing, total)
	for _, fp := range want {
		assert.True(t, existing[fp], "expected %s to be reported as existing", fp)
	}

	// A fingerprint that was never inserted must not be reported.
	missing, err := repos.Fingerprint.CheckExisting(user.ID, []string{"never-inserted"})
	require.NoError(t, err)
	assert.False(t, missing["never-inserted"])
}

// TestImportPipeline_LargeSyntheticPGN imports a synthetic multi-game PGN with
// more games than DBBatchSize, end-to-end, proving the full import path
// (parse -> dedup CheckExisting -> persist SaveBatch) never hits a Postgres
// parameter-limit crash on a large import.
func TestImportPipeline_LargeSyntheticPGN(t *testing.T) {
	testDB.TruncateAll(t)
	repos := testDB.Repos()
	user := testhelpers.SeedUser(t, repos, "largeuser", "password123")

	repertoireSvc := services.NewRepertoireService(repos.Repertoire)
	importSvc := services.NewImportService(repertoireSvc, repos.Analysis,
		services.WithFingerprintRepo(repos.Fingerprint),
	)

	const games = config.DBBatchSize + 200 // spans 2 SaveBatch/CheckExisting chunks
	pgn := largeSyntheticPGN("largeuser", games)

	summary, results, err := importSvc.ParseAndAnalyze("large.pgn", "largeuser", user.ID, pgn)
	require.NoError(t, err)
	require.NotNil(t, summary)
	assert.Equal(t, games, summary.GameCount)
	assert.Len(t, results, games)

	// Re-importing the same PGN must detect all as duplicates (CheckExisting
	// chunking working) rather than crashing.
	_, _, err = importSvc.ParseAndAnalyze("large2.pgn", "largeuser", user.ID, pgn)
	assert.ErrorIs(t, err, services.ErrAllGamesDuplicate)
}

// largeSyntheticPGN builds a PGN with n unique games where username plays White.
func largeSyntheticPGN(username string, n int) string {
	var b strings.Builder
	for i := 0; i < n; i++ {
		fmt.Fprintf(&b, "[Event \"Game %d\"]\n", i)
		b.WriteString("[Site \"Test\"]\n")
		fmt.Fprintf(&b, "[White \"%s\"]\n", username)
		fmt.Fprintf(&b, "[Black \"opp%d\"]\n", i)
		b.WriteString("[Result \"1-0\"]\n\n")
		// Vary the third move so each game has a distinct fingerprint.
		fmt.Fprintf(&b, "1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 { game %d } 1-0\n\n", i)
	}
	return b.String()
}
