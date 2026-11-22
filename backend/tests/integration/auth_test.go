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

// seedLegacyPasswordUser inserts an account created by the removed email/password
// sign-up, as some still exist in production.
func seedLegacyPasswordUser(t *testing.T, username string) string {
	t.Helper()
	var id string
	err := testDB.Pool.QueryRow(context.Background(),
		`INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id`,
		username, username+"@test.com", "$2a$04$legacyhashlegacyhashlegacyhashlegacyhashlegacyhashleg").Scan(&id)
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

func TestAuth_DeleteAccount_WithUsername(t *testing.T) {
	testDB.TruncateAll(t)
	repos := testDB.Repos()
	ts := testhelpers.SetupTestServer(t, repos)
	user := testhelpers.SeedUser(t, repos, "mike")
	session := ts.SignIn(t, user.ID)

	rec := ts.DoRequest(testhelpers.AuthRequest(http.MethodDelete, "/api/auth/account", deleteAccountJSON("mike"), session.Token))
	require.Equal(t, http.StatusNoContent, rec.Code)

	// The access token and the refresh cookie no longer open anything.
	recMe := ts.DoRequest(testhelpers.AuthRequest(http.MethodGet, "/api/auth/me", nil, session.Token))
	assert.Equal(t, http.StatusUnauthorized, recMe.Code)
	recRefresh := ts.DoRequest(requestWithCookie(http.MethodPost, "/api/auth/refresh", nil, session.RefreshCookie))
	assert.Equal(t, http.StatusUnauthorized, recRefresh.Code)
}

func TestAuth_DeleteAccount_WrongUsername(t *testing.T) {
	testDB.TruncateAll(t)
	repos := testDB.Repos()
	ts := testhelpers.SetupTestServer(t, repos)
	user := testhelpers.SeedUser(t, repos, "nancy")
	session := ts.SignIn(t, user.ID)

	rec := ts.DoRequest(testhelpers.AuthRequest(http.MethodDelete, "/api/auth/account", deleteAccountJSON("someoneelse"), session.Token))
	assert.Equal(t, http.StatusBadRequest, rec.Code)
	assert.Equal(t, 1, countRows(t, "users"))
}

func TestAuth_DeleteAccount_LegacyPasswordAccountConfirmsWithUsername(t *testing.T) {
	testDB.TruncateAll(t)
	repos := testDB.Repos()
	ts := testhelpers.SetupTestServer(t, repos)
	userID := seedLegacyPasswordUser(t, "legacy")
	session := ts.SignIn(t, userID)

	rec := ts.DoRequest(testhelpers.AuthRequest(http.MethodDelete, "/api/auth/account", deleteAccountJSON("legacy"), session.Token))
	require.Equal(t, http.StatusNoContent, rec.Code)
	assert.Zero(t, countRows(t, "users"))
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
	// Plus rien n'écrit dans cette table, mais la production en garde des lignes.
	_, err = testDB.Pool.Exec(ctx,
		`INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, 'legacy-reset', NOW())`, user.ID)
	require.NoError(t, err)

	recDel := ts.DoRequest(testhelpers.AuthRequest(http.MethodDelete, "/api/auth/account", deleteAccountJSON("oscar"), session.Token))
	require.Equal(t, http.StatusNoContent, recDel.Code)

	for _, table := range []string{"users", "refresh_tokens", "password_reset_tokens", "player_state", "played_games", "played_game_imports"} {
		assert.Zero(t, countRows(t, table), table)
	}
}

func TestAuth_DeleteAccount_Unauthenticated(t *testing.T) {
	testDB.TruncateAll(t)
	repos := testDB.Repos()
	ts := testhelpers.SetupTestServer(t, repos)

	rec := ts.DoRequest(testhelpers.AuthRequest(http.MethodDelete, "/api/auth/account", deleteAccountJSON("anyone"), ""))
	assert.Equal(t, http.StatusUnauthorized, rec.Code)
}
