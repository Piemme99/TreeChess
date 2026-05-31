//go:build integration

package integration

import (
	"context"
	"encoding/json"
	"net/http"
	"strconv"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/kumquat/backend/internal/models"
	"github.com/kumquat/backend/internal/testhelpers"
)

func TestAuth_RegisterAndLogin(t *testing.T) {
	testDB.TruncateAll(t)
	repos := testDB.Repos()
	ts := testhelpers.SetupTestServer(t, repos)

	// Register
	regBody, _ := json.Marshal(models.RegisterRequest{Email: "authuser@test.com", Username: "authuser", Password: "password123"})
	req := testhelpers.AuthRequest(http.MethodPost, "/api/auth/register", regBody, "")
	rec := ts.DoRequest(req)
	require.Equal(t, http.StatusCreated, rec.Code)

	var regResp models.AuthResponse
	err := json.Unmarshal(rec.Body.Bytes(), &regResp)
	require.NoError(t, err)
	assert.NotEmpty(t, regResp.Token)
	assert.Equal(t, "authuser", regResp.User.Username)

	// Login with same credentials
	loginBody, _ := json.Marshal(models.LoginRequest{Email: "authuser@test.com", Password: "password123"})
	req = testhelpers.AuthRequest(http.MethodPost, "/api/auth/login", loginBody, "")
	rec = ts.DoRequest(req)
	require.Equal(t, http.StatusOK, rec.Code)

	var loginResp models.AuthResponse
	err = json.Unmarshal(rec.Body.Bytes(), &loginResp)
	require.NoError(t, err)
	assert.NotEmpty(t, loginResp.Token)

	// Use token to access /api/auth/me
	req = testhelpers.AuthRequest(http.MethodGet, "/api/auth/me", nil, loginResp.Token)
	rec = ts.DoRequest(req)
	assert.Equal(t, http.StatusOK, rec.Code)
}

func TestAuth_DuplicateUsername(t *testing.T) {
	testDB.TruncateAll(t)
	repos := testDB.Repos()
	ts := testhelpers.SetupTestServer(t, repos)

	regBody, _ := json.Marshal(models.RegisterRequest{Email: "dupname@test.com", Username: "dupname", Password: "password123"})

	// First registration succeeds
	req := testhelpers.AuthRequest(http.MethodPost, "/api/auth/register", regBody, "")
	rec := ts.DoRequest(req)
	require.Equal(t, http.StatusCreated, rec.Code)

	// Second registration with same username fails
	req = testhelpers.AuthRequest(http.MethodPost, "/api/auth/register", regBody, "")
	rec = ts.DoRequest(req)
	assert.Equal(t, http.StatusConflict, rec.Code)
}

func TestAuth_InvalidCredentials(t *testing.T) {
	testDB.TruncateAll(t)
	repos := testDB.Repos()
	ts := testhelpers.SetupTestServer(t, repos)

	// Register
	regBody, _ := json.Marshal(models.RegisterRequest{Email: "logintest@test.com", Username: "logintest", Password: "password123"})
	req := testhelpers.AuthRequest(http.MethodPost, "/api/auth/register", regBody, "")
	ts.DoRequest(req)

	// Login with wrong password
	loginBody, _ := json.Marshal(models.LoginRequest{Email: "logintest@test.com", Password: "wrongpassword"})
	req = testhelpers.AuthRequest(http.MethodPost, "/api/auth/login", loginBody, "")
	rec := ts.DoRequest(req)
	assert.Equal(t, http.StatusUnauthorized, rec.Code)
}

func TestAuth_UnauthenticatedAccess(t *testing.T) {
	testDB.TruncateAll(t)
	repos := testDB.Repos()
	ts := testhelpers.SetupTestServer(t, repos)

	// No token → 401 on protected endpoints
	endpoints := []struct {
		method string
		path   string
	}{
		{http.MethodGet, "/api/repertoires"},
		{http.MethodGet, "/api/analyses"},
		{http.MethodGet, "/api/auth/me"},
	}

	for _, ep := range endpoints {
		req := testhelpers.AuthRequest(ep.method, ep.path, nil, "")
		rec := ts.DoRequest(req)
		assert.Equal(t, http.StatusUnauthorized, rec.Code, "expected 401 for %s %s", ep.method, ep.path)
	}

	// Invalid token → 401
	req := testhelpers.AuthRequest(http.MethodGet, "/api/repertoires", nil, "invalid.jwt.token")
	rec := ts.DoRequest(req)
	assert.Equal(t, http.StatusUnauthorized, rec.Code)
}

func TestUserIsolation_RepertoireAccess(t *testing.T) {
	testDB.TruncateAll(t)
	repos := testDB.Repos()
	ts := testhelpers.SetupTestServer(t, repos)

	tokenA := ts.AuthToken(t, "usera_rep", "password123")
	tokenB := ts.AuthToken(t, "userb_rep", "password123")

	// User A creates a repertoire
	createBody, _ := json.Marshal(models.CreateRepertoireRequest{
		Name:  "UserA Rep",
		Color: models.ColorWhite,
	})
	req := testhelpers.AuthRequest(http.MethodPost, "/api/repertoires", createBody, tokenA)
	rec := ts.DoRequest(req)
	require.Equal(t, http.StatusCreated, rec.Code)

	var rep models.Repertoire
	err := json.Unmarshal(rec.Body.Bytes(), &rep)
	require.NoError(t, err)

	// User A can access it
	req = testhelpers.AuthRequest(http.MethodGet, "/api/repertoires/"+rep.ID, nil, tokenA)
	rec = ts.DoRequest(req)
	assert.Equal(t, http.StatusOK, rec.Code)

	// User B cannot access it
	req = testhelpers.AuthRequest(http.MethodGet, "/api/repertoires/"+rep.ID, nil, tokenB)
	rec = ts.DoRequest(req)
	assert.Equal(t, http.StatusNotFound, rec.Code)

	// User B cannot delete it
	req = testhelpers.AuthRequest(http.MethodDelete, "/api/repertoires/"+rep.ID, nil, tokenB)
	rec = ts.DoRequest(req)
	assert.Equal(t, http.StatusNotFound, rec.Code)

	// User B cannot update it
	hackedName := "Hacked"
	updateBody, _ := json.Marshal(models.UpdateRepertoireRequest{Name: &hackedName})
	req = testhelpers.AuthRequest(http.MethodPatch, "/api/repertoires/"+rep.ID, updateBody, tokenB)
	rec = ts.DoRequest(req)
	assert.Equal(t, http.StatusNotFound, rec.Code)
}

func TestUserIsolation_AnalysisAccess(t *testing.T) {
	testDB.TruncateAll(t)
	repos := testDB.Repos()
	ts := testhelpers.SetupTestServer(t, repos)

	tokenA := ts.AuthToken(t, "usera_ana", "password123")
	tokenB := ts.AuthToken(t, "userb_ana", "password123")

	// User A imports a PGN via service
	pgn := testhelpers.SimplePGN("usera_ana", "opponent")
	summary, _, err := ts.ImportSvc.ParseAndAnalyze(context.Background(), "test.pgn", "usera_ana", getUserID(t, ts, tokenA), pgn)
	require.NoError(t, err)

	// User A can access analysis
	req := testhelpers.AuthRequest(http.MethodGet, "/api/analyses/"+summary.ID, nil, tokenA)
	rec := ts.DoRequest(req)
	assert.Equal(t, http.StatusOK, rec.Code)

	// User B cannot access it
	req = testhelpers.AuthRequest(http.MethodGet, "/api/analyses/"+summary.ID, nil, tokenB)
	rec = ts.DoRequest(req)
	assert.Equal(t, http.StatusNotFound, rec.Code)

	// User B cannot delete it
	req = testhelpers.AuthRequest(http.MethodDelete, "/api/analyses/"+summary.ID, nil, tokenB)
	rec = ts.DoRequest(req)
	assert.Equal(t, http.StatusNotFound, rec.Code)
}

func TestUserIsolation_ReanalyzeGame(t *testing.T) {
	testDB.TruncateAll(t)
	repos := testDB.Repos()
	ts := testhelpers.SetupTestServer(t, repos)

	tokenA := ts.AuthToken(t, "usera_reana", "password123")
	tokenB := ts.AuthToken(t, "userb_reana", "password123")

	userIDA := getUserID(t, ts, tokenA)
	userIDB := getUserID(t, ts, tokenB)

	// User A imports a PGN (usera plays white)
	pgn := testhelpers.SimplePGN("usera_reana", "opponent")
	summary, games, err := ts.ImportSvc.ParseAndAnalyze(context.Background(), "test.pgn", "usera_reana", userIDA, pgn)
	require.NoError(t, err)
	require.NotEmpty(t, games)
	gameIndex := games[0].GameIndex

	// User B owns a white repertoire to reanalyze against
	repB, err := repos.Repertoire.Create(context.Background(), userIDB, "UserB Rep", models.ColorWhite)
	require.NoError(t, err)

	// User B cannot reanalyze User A's game (404 at the ownership boundary)
	reqURL := "/api/games/" + summary.ID + "/" + strconv.Itoa(gameIndex) + "/reanalyze"
	body, _ := json.Marshal(map[string]string{"repertoireId": repB.ID})
	req := testhelpers.AuthRequest(http.MethodPost, reqURL, body, tokenB)
	rec := ts.DoRequest(req)
	assert.Equal(t, http.StatusNotFound, rec.Code)

	// The analysis is untouched: User A can still read it
	req = testhelpers.AuthRequest(http.MethodGet, "/api/analyses/"+summary.ID, nil, tokenA)
	rec = ts.DoRequest(req)
	assert.Equal(t, http.StatusOK, rec.Code)
}

func TestUserIsolation_MergeRepertoires(t *testing.T) {
	testDB.TruncateAll(t)
	repos := testDB.Repos()
	ts := testhelpers.SetupTestServer(t, repos)

	tokenA := ts.AuthToken(t, "usera_merge", "password123")
	tokenB := ts.AuthToken(t, "userb_merge", "password123")

	userIDA := getUserID(t, ts, tokenA)
	userIDB := getUserID(t, ts, tokenB)

	// User A owns two repertoires
	repA1, err := repos.Repertoire.Create(context.Background(), userIDA, "A Merge 1", models.ColorWhite)
	require.NoError(t, err)
	repA2, err := repos.Repertoire.Create(context.Background(), userIDA, "A Merge 2", models.ColorWhite)
	require.NoError(t, err)

	// User B owns one repertoire
	repB1, err := repos.Repertoire.Create(context.Background(), userIDB, "B Merge 1", models.ColorWhite)
	require.NoError(t, err)

	// User B tries to merge one of their own repertoires with one of User A's
	body, _ := json.Marshal(models.MergeRepertoiresRequest{
		IDs:  []string{repB1.ID, repA1.ID},
		Name: "Hijacked Merge",
	})
	req := testhelpers.AuthRequest(http.MethodPost, "/api/repertoires/merge", body, tokenB)
	rec := ts.DoRequest(req)
	assert.Equal(t, http.StatusNotFound, rec.Code)

	// User A's repertoires both survive (merge deletes sources, so this proves no
	// cross-tenant tree was fetched or deleted).
	for _, id := range []string{repA1.ID, repA2.ID} {
		got, err := repos.Repertoire.GetByID(context.Background(), id, userIDA)
		require.NoError(t, err, "User A repertoire %s should still exist", id)
		assert.Equal(t, id, got.ID)
	}
}

func TestUserIsolation_ExtractSubtree(t *testing.T) {
	testDB.TruncateAll(t)
	repos := testDB.Repos()
	ts := testhelpers.SetupTestServer(t, repos)

	tokenA := ts.AuthToken(t, "usera_extract", "password123")
	tokenB := ts.AuthToken(t, "userb_extract", "password123")

	// User A creates a repertoire and adds a node so there is a subtree to extract
	createBody, _ := json.Marshal(models.CreateRepertoireRequest{Name: "Extract Rep", Color: models.ColorWhite})
	req := testhelpers.AuthRequest(http.MethodPost, "/api/repertoires", createBody, tokenA)
	rec := ts.DoRequest(req)
	require.Equal(t, http.StatusCreated, rec.Code)

	var rep models.Repertoire
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &rep))

	addBody, _ := json.Marshal(models.AddNodeRequest{ParentID: rep.TreeData.ID, Move: "e4"})
	req = testhelpers.AuthRequest(http.MethodPost, "/api/repertoires/"+rep.ID+"/nodes", addBody, tokenA)
	rec = ts.DoRequest(req)
	require.Equal(t, http.StatusCreated, rec.Code)

	var withNode models.Repertoire
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &withNode))
	require.NotEmpty(t, withNode.TreeData.Children)
	nodeID := withNode.TreeData.Children[0].ID

	// User B cannot extract a subtree from User A's repertoire
	extractBody, _ := json.Marshal(models.ExtractSubtreeRequest{NodeID: nodeID, Name: "Stolen Subtree"})
	req = testhelpers.AuthRequest(http.MethodPost, "/api/repertoires/"+rep.ID+"/extract", extractBody, tokenB)
	rec = ts.DoRequest(req)
	assert.Equal(t, http.StatusNotFound, rec.Code)

	// User B did not gain a new repertoire from the extraction attempt
	req = testhelpers.AuthRequest(http.MethodGet, "/api/repertoires", nil, tokenB)
	rec = ts.DoRequest(req)
	require.Equal(t, http.StatusOK, rec.Code)
	var repsB []models.Repertoire
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &repsB))
	assert.Empty(t, repsB)
}

func TestUserIsolation_CategoryRename(t *testing.T) {
	testDB.TruncateAll(t)
	repos := testDB.Repos()
	ts := testhelpers.SetupTestServer(t, repos)

	tokenA := ts.AuthToken(t, "usera_catname", "password123")
	tokenB := ts.AuthToken(t, "userb_catname", "password123")

	userIDA := getUserID(t, ts, tokenA)

	// User A owns a category
	cat, err := repos.Category.Create(context.Background(), userIDA, "UserA Category", models.ColorWhite)
	require.NoError(t, err)

	// User B cannot rename it
	body, _ := json.Marshal(models.UpdateCategoryRequest{Name: "Hacked Category"})
	req := testhelpers.AuthRequest(http.MethodPatch, "/api/categories/"+cat.ID, body, tokenB)
	rec := ts.DoRequest(req)
	assert.Equal(t, http.StatusNotFound, rec.Code)

	// The category name is unchanged
	got, err := repos.Category.GetByID(context.Background(), cat.ID, userIDA)
	require.NoError(t, err)
	assert.Equal(t, "UserA Category", got.Name)
}

func TestUserIsolation_CategoryDeleteDoesNotCascadeCrossTenant(t *testing.T) {
	testDB.TruncateAll(t)
	repos := testDB.Repos()
	ts := testhelpers.SetupTestServer(t, repos)

	tokenA := ts.AuthToken(t, "usera_catdel", "password123")
	tokenB := ts.AuthToken(t, "userb_catdel", "password123")

	userIDA := getUserID(t, ts, tokenA)

	// User A owns a category with a repertoire inside it
	cat, err := repos.Category.Create(context.Background(), userIDA, "UserA Category", models.ColorWhite)
	require.NoError(t, err)
	rep, err := repos.Repertoire.CreateWithCategory(context.Background(), userIDA, "Categorized Rep", models.ColorWhite, &cat.ID)
	require.NoError(t, err)

	// User B cannot delete the category — this is the destructive cascade path
	req := testhelpers.AuthRequest(http.MethodDelete, "/api/categories/"+cat.ID, nil, tokenB)
	rec := ts.DoRequest(req)
	assert.Equal(t, http.StatusNotFound, rec.Code)

	// The category and, crucially, User A's repertoire both survive the attempt
	gotCat, err := repos.Category.GetByID(context.Background(), cat.ID, userIDA)
	require.NoError(t, err)
	assert.Equal(t, cat.ID, gotCat.ID)

	gotRep, err := repos.Repertoire.GetByID(context.Background(), rep.ID, userIDA)
	require.NoError(t, err, "victim repertoire must not be cascade-deleted")
	assert.Equal(t, rep.ID, gotRep.ID)
}

func TestUserIsolation_ListRepertoires(t *testing.T) {
	testDB.TruncateAll(t)
	repos := testDB.Repos()
	ts := testhelpers.SetupTestServer(t, repos)

	tokenA := ts.AuthToken(t, "usera_list", "password123")
	tokenB := ts.AuthToken(t, "userb_list", "password123")

	// User A creates 2 repertoires
	for _, name := range []string{"Rep A1", "Rep A2"} {
		body, _ := json.Marshal(models.CreateRepertoireRequest{Name: name, Color: models.ColorWhite})
		req := testhelpers.AuthRequest(http.MethodPost, "/api/repertoires", body, tokenA)
		rec := ts.DoRequest(req)
		require.Equal(t, http.StatusCreated, rec.Code)
	}

	// User B creates 1 repertoire
	body, _ := json.Marshal(models.CreateRepertoireRequest{Name: "Rep B1", Color: models.ColorBlack})
	req := testhelpers.AuthRequest(http.MethodPost, "/api/repertoires", body, tokenB)
	rec := ts.DoRequest(req)
	require.Equal(t, http.StatusCreated, rec.Code)

	// User A should see only 2
	req = testhelpers.AuthRequest(http.MethodGet, "/api/repertoires", nil, tokenA)
	rec = ts.DoRequest(req)
	require.Equal(t, http.StatusOK, rec.Code)

	var repsA []models.Repertoire
	err := json.Unmarshal(rec.Body.Bytes(), &repsA)
	require.NoError(t, err)
	assert.Len(t, repsA, 2)

	// User B should see only 1
	req = testhelpers.AuthRequest(http.MethodGet, "/api/repertoires", nil, tokenB)
	rec = ts.DoRequest(req)
	require.Equal(t, http.StatusOK, rec.Code)

	var repsB []models.Repertoire
	err = json.Unmarshal(rec.Body.Bytes(), &repsB)
	require.NoError(t, err)
	assert.Len(t, repsB, 1)
}

func TestUserIsolation_ListAnalyses(t *testing.T) {
	testDB.TruncateAll(t)
	repos := testDB.Repos()
	ts := testhelpers.SetupTestServer(t, repos)

	tokenA := ts.AuthToken(t, "usera_analist", "password123")
	tokenB := ts.AuthToken(t, "userb_analist", "password123")

	userIDA := getUserID(t, ts, tokenA)

	// User A imports a PGN
	pgn := testhelpers.SimplePGN("usera_analist", "opponent")
	_, _, err := ts.ImportSvc.ParseAndAnalyze(context.Background(), "test.pgn", "usera_analist", userIDA, pgn)
	require.NoError(t, err)

	// User A sees 1 analysis
	req := testhelpers.AuthRequest(http.MethodGet, "/api/analyses", nil, tokenA)
	rec := ts.DoRequest(req)
	require.Equal(t, http.StatusOK, rec.Code)

	var analysesA []map[string]interface{}
	err = json.Unmarshal(rec.Body.Bytes(), &analysesA)
	require.NoError(t, err)
	assert.Len(t, analysesA, 1)

	// User B sees 0 analyses
	req = testhelpers.AuthRequest(http.MethodGet, "/api/analyses", nil, tokenB)
	rec = ts.DoRequest(req)
	require.Equal(t, http.StatusOK, rec.Code)

	var analysesB []map[string]interface{}
	err = json.Unmarshal(rec.Body.Bytes(), &analysesB)
	require.NoError(t, err)
	assert.Len(t, analysesB, 0)
}

func TestRepertoireLimitTrigger(t *testing.T) {
	testDB.TruncateAll(t)
	repos := testDB.Repos()
	user := testhelpers.SeedUser(t, repos, "limituser", "password123")

	// Create 50 repertoires (the max)
	for i := 0; i < 50; i++ {
		color := models.ColorWhite
		if i%2 == 1 {
			color = models.ColorBlack
		}
		_, err := repos.Repertoire.Create(context.Background(), user.ID, "Rep "+string(rune('A'+i%26))+string(rune('0'+i/26)), color)
		require.NoError(t, err, "failed to create repertoire %d", i)
	}

	// 51st should fail (PostgreSQL trigger)
	_, err := repos.Repertoire.Create(context.Background(), user.ID, "Too Many", models.ColorWhite)
	assert.Error(t, err)
}

func TestRepertoireLimitTrigger_DifferentUsers(t *testing.T) {
	testDB.TruncateAll(t)
	repos := testDB.Repos()
	userA := testhelpers.SeedUser(t, repos, "limitusera", "password123")
	userB := testhelpers.SeedUser(t, repos, "limituserb", "password123")

	// User A creates 50 repertoires
	for i := 0; i < 50; i++ {
		color := models.ColorWhite
		if i%2 == 1 {
			color = models.ColorBlack
		}
		_, err := repos.Repertoire.Create(context.Background(), userA.ID, "A Rep "+string(rune('0'+i/10))+string(rune('0'+i%10)), color)
		require.NoError(t, err)
	}

	// User B can still create
	_, err := repos.Repertoire.Create(context.Background(), userB.ID, "B Rep", models.ColorWhite)
	assert.NoError(t, err)

	// User A cannot
	_, err = repos.Repertoire.Create(context.Background(), userA.ID, "Too Many", models.ColorWhite)
	assert.Error(t, err)
}

// getUserID extracts the userID from a JWT token by calling the /api/auth/me endpoint.
func getUserID(t *testing.T, ts *testhelpers.TestServer, token string) string {
	t.Helper()
	req := testhelpers.AuthRequest(http.MethodGet, "/api/auth/me", nil, token)
	rec := ts.DoRequest(req)
	require.Equal(t, http.StatusOK, rec.Code)

	var user models.User
	err := json.Unmarshal(rec.Body.Bytes(), &user)
	require.NoError(t, err)
	return user.ID
}
