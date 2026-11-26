//go:build integration

package integration

import (
	"context"
	"encoding/json"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/kumquat/backend/internal/models"
	"github.com/kumquat/backend/internal/testhelpers"
)

// ---------- helpers ----------

// requestWithCookie creates an HTTP request and attaches the given cookie.
func requestWithCookie(method, path string, body []byte, cookie *http.Cookie) *http.Request {
	req := testhelpers.AuthRequest(method, path, body, "")
	if cookie != nil {
		req.AddCookie(cookie)
	}
	return req
}

func deleteAccountJSON(username string) []byte {
	b, _ := json.Marshal(models.DeleteAccountRequest{Username: username})
	return b
}

// seedLegacyEmailUser inserts an account created by the removed email/password
// sign-up, as some still exist in production: no Lichess link.
func seedLegacyEmailUser(t *testing.T, username string) string {
	t.Helper()
	var id string
	err := testDB.Pool.QueryRow(context.Background(),
		`INSERT INTO users (username) VALUES ($1) RETURNING id`, username).Scan(&id)
	require.NoError(t, err)
	return id
}

// ========================================================================
// Me
// ========================================================================

func TestAuth_Me_ReturnsTheSignedInUser(t *testing.T) {
	testDB.TruncateAll(t)
	repos := testDB.Repos()
	ts := testhelpers.SetupTestServer(t, repos)
	user := testhelpers.SeedUser(t, repos, "alice")
	session := ts.SignIn(t, user.ID)

	rec := ts.DoRequest(testhelpers.AuthRequest(http.MethodGet, "/api/auth/me", nil, session.Token))
	require.Equal(t, http.StatusOK, rec.Code)

	var me models.User
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &me))
	assert.Equal(t, user.ID, me.ID)
	assert.Equal(t, "alice", me.Username)
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
		{http.MethodGet, "/api/v2/state"},
		{http.MethodGet, "/api/auth/me"},
	}

	for _, ep := range endpoints {
		req := testhelpers.AuthRequest(ep.method, ep.path, nil, "")
		rec := ts.DoRequest(req)
		assert.Equal(t, http.StatusUnauthorized, rec.Code, "expected 401 for %s %s", ep.method, ep.path)
	}

	// Invalid token → 401
	req := testhelpers.AuthRequest(http.MethodGet, "/api/v2/state", nil, "invalid.jwt.token")
	rec := ts.DoRequest(req)
	assert.Equal(t, http.StatusUnauthorized, rec.Code)
}

// ========================================================================
// Refresh token flow
// ========================================================================

func TestAuth_RefreshToken_Success(t *testing.T) {
	testDB.TruncateAll(t)
	repos := testDB.Repos()
	ts := testhelpers.SetupTestServer(t, repos)
	user := testhelpers.SeedUser(t, repos, "alice")
	cookie := ts.SignIn(t, user.ID).RefreshCookie

	// Use the refresh token to get a new access token.
	rec := ts.DoRequest(requestWithCookie(http.MethodPost, "/api/auth/refresh", nil, cookie))
	require.Equal(t, http.StatusOK, rec.Code)

	var resp models.AuthResponse
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &resp))
	assert.NotEmpty(t, resp.Token, "should return new access token")
	assert.Equal(t, "alice", resp.User.Username)

	// A new refresh cookie should be set (rotation).
	newCookie := testhelpers.RefreshCookie(rec)
	require.NotNil(t, newCookie, "refresh should set new refresh_token cookie")
	assert.NotEqual(t, cookie.Value, newCookie.Value, "refresh token should rotate")
}

func TestAuth_RefreshToken_Rotation_OldTokenInvalid(t *testing.T) {
	testDB.TruncateAll(t)
	repos := testDB.Repos()
	ts := testhelpers.SetupTestServer(t, repos)
	user := testhelpers.SeedUser(t, repos, "bob")
	oldCookie := ts.SignIn(t, user.ID).RefreshCookie

	// Refresh once — consumes the old token.
	rec2 := ts.DoRequest(requestWithCookie(http.MethodPost, "/api/auth/refresh", nil, oldCookie))
	require.Equal(t, http.StatusOK, rec2.Code)

	// Try using the old cookie again — should fail.
	rec3 := ts.DoRequest(requestWithCookie(http.MethodPost, "/api/auth/refresh", nil, oldCookie))
	assert.Equal(t, http.StatusUnauthorized, rec3.Code)
}

func TestAuth_RefreshToken_MissingCookie(t *testing.T) {
	testDB.TruncateAll(t)
	repos := testDB.Repos()
	ts := testhelpers.SetupTestServer(t, repos)

	rec := ts.DoRequest(testhelpers.AuthRequest(http.MethodPost, "/api/auth/refresh", nil, ""))
	assert.Equal(t, http.StatusUnauthorized, rec.Code)
}

func TestAuth_RefreshToken_InvalidToken(t *testing.T) {
	testDB.TruncateAll(t)
	repos := testDB.Repos()
	ts := testhelpers.SetupTestServer(t, repos)

	fakeCookie := &http.Cookie{Name: "refresh_token", Value: "totally-invalid-token", Path: "/api/auth"}
	rec := ts.DoRequest(requestWithCookie(http.MethodPost, "/api/auth/refresh", nil, fakeCookie))
	assert.Equal(t, http.StatusUnauthorized, rec.Code)
}

// ========================================================================
// Logout
// ========================================================================

func TestAuth_Logout_Success(t *testing.T) {
	testDB.TruncateAll(t)
	repos := testDB.Repos()
	ts := testhelpers.SetupTestServer(t, repos)
	user := testhelpers.SeedUser(t, repos, "carol")
	cookie := ts.SignIn(t, user.ID).RefreshCookie

	// Logout — should revoke the token and clear the cookie.
	rec2 := ts.DoRequest(requestWithCookie(http.MethodPost, "/api/auth/logout", nil, cookie))
	require.Equal(t, http.StatusOK, rec2.Code)

	// The cookie should be cleared (MaxAge=-1).
	clearedCookie := testhelpers.RefreshCookie(rec2)
	require.NotNil(t, clearedCookie)
	assert.Equal(t, -1, clearedCookie.MaxAge, "cookie should be cleared on logout")

	// Using the old refresh token should now fail.
	rec3 := ts.DoRequest(requestWithCookie(http.MethodPost, "/api/auth/refresh", nil, cookie))
	assert.Equal(t, http.StatusUnauthorized, rec3.Code)
}

func TestAuth_Logout_NoCookie(t *testing.T) {
	testDB.TruncateAll(t)
	repos := testDB.Repos()
	ts := testhelpers.SetupTestServer(t, repos)

	// Logout without any cookie should still return 200.
	rec := ts.DoRequest(testhelpers.AuthRequest(http.MethodPost, "/api/auth/logout", nil, ""))
	assert.Equal(t, http.StatusOK, rec.Code)
}

// ========================================================================
// Delete account
// ========================================================================

// deletionRequest : ce qu'envoie le frontend, avec le cookie de rafraîchissement que le navigateur joint à /api/auth.
func deletionRequest(username string, session testhelpers.Session, withCookie bool) *http.Request {
	req := testhelpers.AuthRequest(http.MethodPost, "/api/auth/account/deletion", deleteAccountJSON(username), session.Token)
	if withCookie {
		req.AddCookie(session.RefreshCookie)
	}
	return req
}

func TestAuth_DeleteAccount_LichessAccountIsOnlySentToLichess(t *testing.T) {
	testDB.TruncateAll(t)
	repos := testDB.Repos()
	ts := testhelpers.SetupTestServer(t, repos)
	user := testhelpers.SeedUser(t, repos, "mike")
	session := ts.SignIn(t, user.ID)

	rec := ts.DoRequest(deletionRequest("mike", session, true))
	require.Equal(t, http.StatusOK, rec.Code)

	var body map[string]string
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &body))
	assert.Contains(t, body["redirect"], "https://lichess.org/oauth?")
	assert.Equal(t, 1, countRows(t, "users"))
}

func TestAuth_DeleteAccount_WrongUsername(t *testing.T) {
	testDB.TruncateAll(t)
	repos := testDB.Repos()
	ts := testhelpers.SetupTestServer(t, repos)
	user := testhelpers.SeedUser(t, repos, "nancy")
	session := ts.SignIn(t, user.ID)

	rec := ts.DoRequest(deletionRequest("someoneelse", session, true))
	assert.Equal(t, http.StatusBadRequest, rec.Code)
	assert.Equal(t, 1, countRows(t, "users"))
}

func TestAuth_DeleteAccount_LegacyAccountConfirmsWithItsRefreshCookie(t *testing.T) {
	testDB.TruncateAll(t)
	repos := testDB.Repos()
	ts := testhelpers.SetupTestServer(t, repos)
	userID := seedLegacyEmailUser(t, "legacy")
	session := ts.SignIn(t, userID)

	rec := ts.DoRequest(deletionRequest("legacy", session, true))
	require.Equal(t, http.StatusNoContent, rec.Code)
	assert.Zero(t, countRows(t, "users"))

	recMe := ts.DoRequest(testhelpers.AuthRequest(http.MethodGet, "/api/auth/me", nil, session.Token))
	assert.Equal(t, http.StatusUnauthorized, recMe.Code)
	recRefresh := ts.DoRequest(requestWithCookie(http.MethodPost, "/api/auth/refresh", nil, session.RefreshCookie))
	assert.Equal(t, http.StatusUnauthorized, recRefresh.Code)
}

func TestAuth_DeleteAccount_AccessTokenAloneDeletesNothing(t *testing.T) {
	testDB.TruncateAll(t)
	repos := testDB.Repos()
	ts := testhelpers.SetupTestServer(t, repos)
	userID := seedLegacyEmailUser(t, "legacy")
	session := ts.SignIn(t, userID)

	rec := ts.DoRequest(deletionRequest("legacy", session, false))
	assert.Equal(t, http.StatusForbidden, rec.Code)
	assert.Equal(t, 1, countRows(t, "users"))
}

func TestAuth_DeleteAccount_CascadesData(t *testing.T) {
	testDB.TruncateAll(t)
	repos := testDB.Repos()
	ts := testhelpers.SetupTestServer(t, repos)
	ctx := context.Background()
	user := testhelpers.SeedUser(t, repos, "oscar")
	session := ts.SignIn(t, user.ID)

	recState := ts.DoRequest(testhelpers.AuthRequest(http.MethodPut, "/api/v2/state/additions", []byte(`["e4"]`), session.Token))
	require.Equal(t, http.StatusNoContent, recState.Code)
	_, err := repos.PlayedGame.SaveGames(ctx, user.ID, []models.PlayedGame{{
		Source: "lichess", SourceID: "abcd1234", Color: "white", Moves: "e4 e5", Score: 1, PlayedAt: "2026-11-01",
	}})
	require.NoError(t, err)
	_, err = repos.PlayedGame.StartImport(ctx, user.ID)
	require.NoError(t, err)
	_, err = repos.PlayedGame.LinkChesscom(ctx, user.ID, "oscar")
	require.NoError(t, err)

	// Ce que fait le retour de Lichess quand il authentifie le compte lié (SeedUser : "lichess-" + nom).
	require.NoError(t, ts.AuthSvc.DeleteAccountConfirmedByLichess(ctx, user.ID, "lichess-oscar"))

	for _, table := range []string{"users", "refresh_tokens", "player_state", "played_games", "played_game_imports", "chesscom_accounts"} {
		assert.Zero(t, countRows(t, table), table)
	}
}

func TestAuth_DeleteAccount_Unauthenticated(t *testing.T) {
	testDB.TruncateAll(t)
	repos := testDB.Repos()
	ts := testhelpers.SetupTestServer(t, repos)

	rec := ts.DoRequest(testhelpers.AuthRequest(http.MethodPost, "/api/auth/account/deletion", deleteAccountJSON("anyone"), ""))
	assert.Equal(t, http.StatusUnauthorized, rec.Code)
}
