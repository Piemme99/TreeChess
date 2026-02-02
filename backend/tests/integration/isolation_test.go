//go:build integration

package integration

import (
	"encoding/json"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/treechess/backend/internal/models"
	"github.com/treechess/backend/internal/testhelpers"
)

func TestAuth_RegisterAndLogin(t *testing.T) {
	testDB.TruncateAll(t)
	repos := testDB.Repos()
	ts := testhelpers.SetupTestServer(t, repos)

	// Register
	regBody, _ := json.Marshal(models.RegisterRequest{Username: "authuser", Password: "password123"})
	req := testhelpers.AuthRequest(http.MethodPost, "/api/auth/register", regBody, "")
	rec := ts.DoRequest(req)
	require.Equal(t, http.StatusCreated, rec.Code)

	var regResp models.AuthResponse
	err := json.Unmarshal(rec.Body.Bytes(), &regResp)
	require.NoError(t, err)
	assert.NotEmpty(t, regResp.Token)
	assert.Equal(t, "authuser", regResp.User.Username)

	// Login with same credentials
	loginBody, _ := json.Marshal(models.LoginRequest{Username: "authuser", Password: "password123"})
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

	regBody, _ := json.Marshal(models.RegisterRequest{Username: "dupname", Password: "password123"})

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
	regBody, _ := json.Marshal(models.RegisterRequest{Username: "logintest", Password: "password123"})
	req := testhelpers.AuthRequest(http.MethodPost, "/api/auth/register", regBody, "")
	ts.DoRequest(req)

	// Login with wrong password
	loginBody, _ := json.Marshal(models.LoginRequest{Username: "logintest", Password: "wrongpassword"})
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
	updateBody, _ := json.Marshal(models.UpdateRepertoireRequest{Name: "Hacked"})
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
	summary, _, err := ts.ImportSvc.ParseAndAnalyze("test.pgn", "usera_ana", getUserID(t, ts, tokenA), pgn)
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
	_, _, err := ts.ImportSvc.ParseAndAnalyze("test.pgn", "usera_analist", userIDA, pgn)
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
		_, err := repos.Repertoire.Create(user.ID, "Rep "+string(rune('A'+i%26))+string(rune('0'+i/26)), color)
		require.NoError(t, err, "failed to create repertoire %d", i)
	}

	// 51st should fail (PostgreSQL trigger)
	_, err := repos.Repertoire.Create(user.ID, "Too Many", models.ColorWhite)
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
		_, err := repos.Repertoire.Create(userA.ID, "A Rep "+string(rune('0'+i/10))+string(rune('0'+i%10)), color)
		require.NoError(t, err)
	}

	// User B can still create
	_, err := repos.Repertoire.Create(userB.ID, "B Rep", models.ColorWhite)
	assert.NoError(t, err)

	// User A cannot
	_, err = repos.Repertoire.Create(userA.ID, "Too Many", models.ColorWhite)
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
