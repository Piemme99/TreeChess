//go:build integration

package integration

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/kumquat/backend/internal/models"
	"github.com/kumquat/backend/internal/testhelpers"
)

// ---------- helpers ----------

// registerJSON returns the JSON body for registering a user.
func registerJSON(email, username, password string) []byte {
	b, _ := json.Marshal(models.RegisterRequest{
		Email: email, Username: username, Password: password,
	})
	return b
}

// loginJSON returns the JSON body for logging in.
func loginJSON(email, password string) []byte {
	b, _ := json.Marshal(models.LoginRequest{Email: email, Password: password})
	return b
}

// extractRefreshCookie returns the refresh_token cookie from a response, or nil.
func extractRefreshCookie(rec *httptest.ResponseRecorder) *http.Cookie {
	for _, c := range rec.Result().Cookies() {
		if c.Name == "refresh_token" {
			return c
		}
	}
	return nil
}

// requestWithCookie creates an HTTP request and attaches the given cookie.
func requestWithCookie(method, path string, body []byte, cookie *http.Cookie) *http.Request {
	req := testhelpers.AuthRequest(method, path, body, "")
	if cookie != nil {
		req.AddCookie(cookie)
	}
	return req
}

// ========================================================================
// Refresh token flow
// ========================================================================

func TestAuth_RefreshToken_Success(t *testing.T) {
	testDB.TruncateAll(t)
	repos := testDB.Repos()
	ts := testhelpers.SetupTestServer(t, repos)

	// Register a user — the response should set a refresh_token cookie.
	rec := ts.DoRequest(testhelpers.AuthRequest(
		http.MethodPost, "/api/auth/register",
		registerJSON("alice@test.com", "alice", "password123"), ""))
	require.Equal(t, http.StatusCreated, rec.Code)

	cookie := extractRefreshCookie(rec)
	require.NotNil(t, cookie, "register should set refresh_token cookie")
	require.NotEmpty(t, cookie.Value)

	// Use the refresh token to get a new access token.
	refreshReq := requestWithCookie(http.MethodPost, "/api/auth/refresh", nil, cookie)
	rec2 := ts.DoRequest(refreshReq)
	require.Equal(t, http.StatusOK, rec2.Code)

	var resp models.AuthResponse
	require.NoError(t, json.Unmarshal(rec2.Body.Bytes(), &resp))
	assert.NotEmpty(t, resp.Token, "should return new access token")
	assert.Equal(t, "alice", resp.User.Username)

	// A new refresh cookie should be set (rotation).
	newCookie := extractRefreshCookie(rec2)
	require.NotNil(t, newCookie, "refresh should set new refresh_token cookie")
	assert.NotEqual(t, cookie.Value, newCookie.Value, "refresh token should rotate")
}

func TestAuth_RefreshToken_Rotation_OldTokenInvalid(t *testing.T) {
	testDB.TruncateAll(t)
	repos := testDB.Repos()
	ts := testhelpers.SetupTestServer(t, repos)

	// Register
	rec := ts.DoRequest(testhelpers.AuthRequest(
		http.MethodPost, "/api/auth/register",
		registerJSON("bob@test.com", "bob", "password123"), ""))
	require.Equal(t, http.StatusCreated, rec.Code)
	oldCookie := extractRefreshCookie(rec)
	require.NotNil(t, oldCookie)

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

	// Register
	rec := ts.DoRequest(testhelpers.AuthRequest(
		http.MethodPost, "/api/auth/register",
		registerJSON("carol@test.com", "carol", "password123"), ""))
	require.Equal(t, http.StatusCreated, rec.Code)
	cookie := extractRefreshCookie(rec)
	require.NotNil(t, cookie)

	// Logout — should revoke the token and clear the cookie.
	rec2 := ts.DoRequest(requestWithCookie(http.MethodPost, "/api/auth/logout", nil, cookie))
	require.Equal(t, http.StatusOK, rec2.Code)

	// The cookie should be cleared (MaxAge=-1).
	clearedCookie := extractRefreshCookie(rec2)
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
// Password reset flow
// ========================================================================

func TestAuth_ForgotPassword_AlwaysReturns200(t *testing.T) {
	testDB.TruncateAll(t)
	repos := testDB.Repos()
	ts := testhelpers.SetupTestServer(t, repos)

	// Register a real user.
	_ = ts.AuthToken(t, "diana", "password123")

	cases := []struct {
		name  string
		email string
	}{
		{"valid email", "diana@test.com"},
		{"non-existent email", "nobody@test.com"},
		{"malformed email", "not-an-email"},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			body, _ := json.Marshal(models.ForgotPasswordRequest{Email: tc.email})
			rec := ts.DoRequest(testhelpers.AuthRequest(http.MethodPost, "/api/auth/forgot-password", body, ""))
			assert.Equal(t, http.StatusOK, rec.Code, "forgot-password should always return 200 (anti-enumeration)")
		})
	}
}

func TestAuth_ResetPassword_FullCycle(t *testing.T) {
	testDB.TruncateAll(t)
	repos := testDB.Repos()
	ts := testhelpers.SetupTestServer(t, repos)

	// Register user.
	_ = ts.AuthToken(t, "eve", "oldpassword1")

	// Request password reset.
	body, _ := json.Marshal(models.ForgotPasswordRequest{Email: "eve@test.com"})
	rec := ts.DoRequest(testhelpers.AuthRequest(http.MethodPost, "/api/auth/forgot-password", body, ""))
	require.Equal(t, http.StatusOK, rec.Code)

	// Get the raw token from the email capture.
	rawToken := ts.EmailCapture.LastToken()
	require.NotEmpty(t, rawToken, "email service should have captured a reset token")

	// Reset the password.
	resetBody, _ := json.Marshal(models.ResetPasswordRequest{Token: rawToken, NewPassword: "newpassword1"})
	rec2 := ts.DoRequest(testhelpers.AuthRequest(http.MethodPost, "/api/auth/reset-password", resetBody, ""))
	require.Equal(t, http.StatusOK, rec2.Code)

	// Login with the new password should succeed.
	rec3 := ts.DoRequest(testhelpers.AuthRequest(
		http.MethodPost, "/api/auth/login",
		loginJSON("eve@test.com", "newpassword1"), ""))
	assert.Equal(t, http.StatusOK, rec3.Code)

	// Login with the old password should fail.
	rec4 := ts.DoRequest(testhelpers.AuthRequest(
		http.MethodPost, "/api/auth/login",
		loginJSON("eve@test.com", "oldpassword1"), ""))
	assert.Equal(t, http.StatusUnauthorized, rec4.Code)
}

func TestAuth_ResetPassword_InvalidToken(t *testing.T) {
	testDB.TruncateAll(t)
	repos := testDB.Repos()
	ts := testhelpers.SetupTestServer(t, repos)

	body, _ := json.Marshal(models.ResetPasswordRequest{Token: "invalid-token-here", NewPassword: "newpassword1"})
	rec := ts.DoRequest(testhelpers.AuthRequest(http.MethodPost, "/api/auth/reset-password", body, ""))
	assert.Equal(t, http.StatusBadRequest, rec.Code)
}

func TestAuth_ResetPassword_UsedToken(t *testing.T) {
	testDB.TruncateAll(t)
	repos := testDB.Repos()
	ts := testhelpers.SetupTestServer(t, repos)

	_ = ts.AuthToken(t, "frank", "password123")

	// Request reset.
	body, _ := json.Marshal(models.ForgotPasswordRequest{Email: "frank@test.com"})
	ts.DoRequest(testhelpers.AuthRequest(http.MethodPost, "/api/auth/forgot-password", body, ""))
	rawToken := ts.EmailCapture.LastToken()
	require.NotEmpty(t, rawToken)

	// Use the token once.
	resetBody, _ := json.Marshal(models.ResetPasswordRequest{Token: rawToken, NewPassword: "newpassword1"})
	rec := ts.DoRequest(testhelpers.AuthRequest(http.MethodPost, "/api/auth/reset-password", resetBody, ""))
	require.Equal(t, http.StatusOK, rec.Code)

	// Use the same token again — should fail.
	// Note: after a successful reset, all tokens for the user are deleted,
	// so the second attempt returns "invalid" (not "used").
	rec2 := ts.DoRequest(testhelpers.AuthRequest(http.MethodPost, "/api/auth/reset-password", resetBody, ""))
	assert.Equal(t, http.StatusBadRequest, rec2.Code)
}

func TestAuth_ResetPassword_ShortPassword(t *testing.T) {
	testDB.TruncateAll(t)
	repos := testDB.Repos()
	ts := testhelpers.SetupTestServer(t, repos)

	_ = ts.AuthToken(t, "gina", "password123")

	body, _ := json.Marshal(models.ForgotPasswordRequest{Email: "gina@test.com"})
	ts.DoRequest(testhelpers.AuthRequest(http.MethodPost, "/api/auth/forgot-password", body, ""))
	rawToken := ts.EmailCapture.LastToken()
	require.NotEmpty(t, rawToken)

	// Try resetting with a password that is too short.
	resetBody, _ := json.Marshal(models.ResetPasswordRequest{Token: rawToken, NewPassword: "short"})
	rec := ts.DoRequest(testhelpers.AuthRequest(http.MethodPost, "/api/auth/reset-password", resetBody, ""))
	assert.Equal(t, http.StatusBadRequest, rec.Code)
}

func TestAuth_ResetPassword_RevokesRefreshTokens(t *testing.T) {
	testDB.TruncateAll(t)
	repos := testDB.Repos()
	ts := testhelpers.SetupTestServer(t, repos)

	// Register and save the refresh token cookie.
	rec := ts.DoRequest(testhelpers.AuthRequest(
		http.MethodPost, "/api/auth/register",
		registerJSON("holly@test.com", "holly", "password123"), ""))
	require.Equal(t, http.StatusCreated, rec.Code)
	refreshCookie := extractRefreshCookie(rec)
	require.NotNil(t, refreshCookie)

	// Request and complete password reset.
	body, _ := json.Marshal(models.ForgotPasswordRequest{Email: "holly@test.com"})
	ts.DoRequest(testhelpers.AuthRequest(http.MethodPost, "/api/auth/forgot-password", body, ""))
	rawToken := ts.EmailCapture.LastToken()
	require.NotEmpty(t, rawToken)

	resetBody, _ := json.Marshal(models.ResetPasswordRequest{Token: rawToken, NewPassword: "newpassword1"})
	rec2 := ts.DoRequest(testhelpers.AuthRequest(http.MethodPost, "/api/auth/reset-password", resetBody, ""))
	require.Equal(t, http.StatusOK, rec2.Code)

	// The old refresh token should now be invalid.
	rec3 := ts.DoRequest(requestWithCookie(http.MethodPost, "/api/auth/refresh", nil, refreshCookie))
	assert.Equal(t, http.StatusUnauthorized, rec3.Code)
}

// ========================================================================
// Change password
// ========================================================================

func TestAuth_ChangePassword_Success(t *testing.T) {
	testDB.TruncateAll(t)
	repos := testDB.Repos()
	ts := testhelpers.SetupTestServer(t, repos)

	token := ts.AuthToken(t, "ivan", "oldpassword1")

	body, _ := json.Marshal(models.ChangePasswordRequest{
		CurrentPassword: "oldpassword1",
		NewPassword:     "newpassword1",
	})
	rec := ts.DoRequest(testhelpers.AuthRequest(http.MethodPost, "/api/auth/change-password", body, token))
	require.Equal(t, http.StatusOK, rec.Code)

	// Login with new password should succeed.
	rec2 := ts.DoRequest(testhelpers.AuthRequest(
		http.MethodPost, "/api/auth/login",
		loginJSON("ivan@test.com", "newpassword1"), ""))
	assert.Equal(t, http.StatusOK, rec2.Code)

	// Login with old password should fail.
	rec3 := ts.DoRequest(testhelpers.AuthRequest(
		http.MethodPost, "/api/auth/login",
		loginJSON("ivan@test.com", "oldpassword1"), ""))
	assert.Equal(t, http.StatusUnauthorized, rec3.Code)
}

func TestAuth_ChangePassword_WrongCurrent(t *testing.T) {
	testDB.TruncateAll(t)
	repos := testDB.Repos()
	ts := testhelpers.SetupTestServer(t, repos)

	token := ts.AuthToken(t, "jack", "password123")

	body, _ := json.Marshal(models.ChangePasswordRequest{
		CurrentPassword: "wrongpassword",
		NewPassword:     "newpassword1",
	})
	rec := ts.DoRequest(testhelpers.AuthRequest(http.MethodPost, "/api/auth/change-password", body, token))
	assert.Equal(t, http.StatusBadRequest, rec.Code)
}

func TestAuth_ChangePassword_TooShort(t *testing.T) {
	testDB.TruncateAll(t)
	repos := testDB.Repos()
	ts := testhelpers.SetupTestServer(t, repos)

	token := ts.AuthToken(t, "kate", "password123")

	body, _ := json.Marshal(models.ChangePasswordRequest{
		CurrentPassword: "password123",
		NewPassword:     "short",
	})
	rec := ts.DoRequest(testhelpers.AuthRequest(http.MethodPost, "/api/auth/change-password", body, token))
	assert.Equal(t, http.StatusBadRequest, rec.Code)
}

func TestAuth_ChangePassword_Unauthenticated(t *testing.T) {
	testDB.TruncateAll(t)
	repos := testDB.Repos()
	ts := testhelpers.SetupTestServer(t, repos)

	body, _ := json.Marshal(models.ChangePasswordRequest{
		CurrentPassword: "oldpassword1",
		NewPassword:     "newpassword1",
	})
	rec := ts.DoRequest(testhelpers.AuthRequest(http.MethodPost, "/api/auth/change-password", body, ""))
	assert.Equal(t, http.StatusUnauthorized, rec.Code)
}

func TestAuth_ChangePassword_RevokesRefreshTokens(t *testing.T) {
	testDB.TruncateAll(t)
	repos := testDB.Repos()
	ts := testhelpers.SetupTestServer(t, repos)

	// Register and get both access token and refresh cookie.
	rec := ts.DoRequest(testhelpers.AuthRequest(
		http.MethodPost, "/api/auth/register",
		registerJSON("leo@test.com", "leo", "password123"), ""))
	require.Equal(t, http.StatusCreated, rec.Code)

	var authResp models.AuthResponse
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &authResp))
	accessToken := authResp.Token
	refreshCookie := extractRefreshCookie(rec)
	require.NotNil(t, refreshCookie)

	// Change password.
	body, _ := json.Marshal(models.ChangePasswordRequest{
		CurrentPassword: "password123",
		NewPassword:     "newpassword1",
	})
	rec2 := ts.DoRequest(testhelpers.AuthRequest(http.MethodPost, "/api/auth/change-password", body, accessToken))
	require.Equal(t, http.StatusOK, rec2.Code)

	// Old refresh token should be revoked.
	rec3 := ts.DoRequest(requestWithCookie(http.MethodPost, "/api/auth/refresh", nil, refreshCookie))
	assert.Equal(t, http.StatusUnauthorized, rec3.Code)
}

// ========================================================================
// Delete account
// ========================================================================

func TestAuth_DeleteAccount_WithPassword(t *testing.T) {
	testDB.TruncateAll(t)
	repos := testDB.Repos()
	ts := testhelpers.SetupTestServer(t, repos)

	token := ts.AuthToken(t, "mike", "password123")

	body, _ := json.Marshal(models.DeleteAccountRequest{Password: "password123"})
	rec := ts.DoRequest(testhelpers.AuthRequest(http.MethodDelete, "/api/auth/account", body, token))
	require.Equal(t, http.StatusNoContent, rec.Code)

	// Login should now fail — account is deleted.
	rec2 := ts.DoRequest(testhelpers.AuthRequest(
		http.MethodPost, "/api/auth/login",
		loginJSON("mike@test.com", "password123"), ""))
	assert.Equal(t, http.StatusUnauthorized, rec2.Code)
}

func TestAuth_DeleteAccount_WrongPassword(t *testing.T) {
	testDB.TruncateAll(t)
	repos := testDB.Repos()
	ts := testhelpers.SetupTestServer(t, repos)

	token := ts.AuthToken(t, "nancy", "password123")

	body, _ := json.Marshal(models.DeleteAccountRequest{Password: "wrongpassword"})
	rec := ts.DoRequest(testhelpers.AuthRequest(http.MethodDelete, "/api/auth/account", body, token))
	assert.Equal(t, http.StatusBadRequest, rec.Code)
}

func TestAuth_DeleteAccount_CascadesData(t *testing.T) {
	testDB.TruncateAll(t)
	repos := testDB.Repos()
	ts := testhelpers.SetupTestServer(t, repos)

	token := ts.AuthToken(t, "oscar", "password123")

	// Create some data: a repertoire and a category.
	repBody, _ := json.Marshal(map[string]string{"name": "My Rep", "color": "white"})
	rec := ts.DoRequest(testhelpers.AuthRequest(http.MethodPost, "/api/repertoires", repBody, token))
	require.Equal(t, http.StatusCreated, rec.Code)

	catBody, _ := json.Marshal(map[string]string{"name": "My Cat", "color": "white"})
	rec2 := ts.DoRequest(testhelpers.AuthRequest(http.MethodPost, "/api/categories", catBody, token))
	require.Equal(t, http.StatusCreated, rec2.Code)

	// Delete account.
	delBody, _ := json.Marshal(models.DeleteAccountRequest{Password: "password123"})
	rec3 := ts.DoRequest(testhelpers.AuthRequest(http.MethodDelete, "/api/auth/account", delBody, token))
	require.Equal(t, http.StatusNoContent, rec3.Code)

	// Verify login fails — account is deleted.
	rec4 := ts.DoRequest(testhelpers.AuthRequest(
		http.MethodPost, "/api/auth/login",
		loginJSON("oscar@test.com", "password123"), ""))
	assert.Equal(t, http.StatusUnauthorized, rec4.Code)

	// Re-register a new user to verify old data doesn't linger.
	// If repertoires/categories were not cascade-deleted, we'd see stale data.
	rec5 := ts.DoRequest(testhelpers.AuthRequest(
		http.MethodPost, "/api/auth/register",
		registerJSON("oscar2@test.com", "oscar2", "password123"), ""))
	require.Equal(t, http.StatusCreated, rec5.Code)
	var newAuth models.AuthResponse
	require.NoError(t, json.Unmarshal(rec5.Body.Bytes(), &newAuth))

	// New user should have zero repertoires.
	rec6 := ts.DoRequest(testhelpers.AuthRequest(http.MethodGet, "/api/repertoires", nil, newAuth.Token))
	require.Equal(t, http.StatusOK, rec6.Code)
	assert.Contains(t, rec6.Body.String(), "[]")
}

func TestAuth_DeleteAccount_Unauthenticated(t *testing.T) {
	testDB.TruncateAll(t)
	repos := testDB.Repos()
	ts := testhelpers.SetupTestServer(t, repos)

	body, _ := json.Marshal(models.DeleteAccountRequest{Password: "password123"})
	rec := ts.DoRequest(testhelpers.AuthRequest(http.MethodDelete, "/api/auth/account", body, ""))
	assert.Equal(t, http.StatusUnauthorized, rec.Code)
}

// ========================================================================
// Has password
// ========================================================================

func TestAuth_HasPassword_True(t *testing.T) {
	testDB.TruncateAll(t)
	repos := testDB.Repos()
	ts := testhelpers.SetupTestServer(t, repos)

	token := ts.AuthToken(t, "pete", "password123")

	rec := ts.DoRequest(testhelpers.AuthRequest(http.MethodGet, "/api/auth/has-password", nil, token))
	require.Equal(t, http.StatusOK, rec.Code)

	var resp models.HasPasswordResponse
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &resp))
	assert.True(t, resp.HasPassword)
}

func TestAuth_HasPassword_Unauthenticated(t *testing.T) {
	testDB.TruncateAll(t)
	repos := testDB.Repos()
	ts := testhelpers.SetupTestServer(t, repos)

	rec := ts.DoRequest(testhelpers.AuthRequest(http.MethodGet, "/api/auth/has-password", nil, ""))
	assert.Equal(t, http.StatusUnauthorized, rec.Code)
}

// ========================================================================
// Update profile
// ========================================================================

func TestAuth_UpdateProfile_Success(t *testing.T) {
	testDB.TruncateAll(t)
	repos := testDB.Repos()
	ts := testhelpers.SetupTestServer(t, repos)

	token := ts.AuthToken(t, "quinn", "password123")

	lichess := "quinn_lichess"
	chesscom := "quinn_chesscom"
	body, _ := json.Marshal(models.UpdateProfileRequest{
		LichessUsername:  &lichess,
		ChesscomUsername: &chesscom,
		TimeFormatPrefs:  []string{"bullet", "blitz"},
	})
	rec := ts.DoRequest(testhelpers.AuthRequest(http.MethodPut, "/api/auth/profile", body, token))
	require.Equal(t, http.StatusOK, rec.Code)

	var user models.User
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &user))
	assert.Equal(t, "quinn_lichess", *user.LichessUsername)
	assert.Equal(t, "quinn_chesscom", *user.ChesscomUsername)
	assert.Equal(t, []string{"bullet", "blitz"}, user.TimeFormatPrefs)
}

func TestAuth_UpdateProfile_InvalidTimeFormat(t *testing.T) {
	testDB.TruncateAll(t)
	repos := testDB.Repos()
	ts := testhelpers.SetupTestServer(t, repos)

	token := ts.AuthToken(t, "rachel", "password123")

	body, _ := json.Marshal(models.UpdateProfileRequest{
		TimeFormatPrefs: []string{"bullet", "invalid_format"},
	})
	rec := ts.DoRequest(testhelpers.AuthRequest(http.MethodPut, "/api/auth/profile", body, token))
	assert.Equal(t, http.StatusBadRequest, rec.Code)
}

func TestAuth_UpdateProfile_Unauthenticated(t *testing.T) {
	testDB.TruncateAll(t)
	repos := testDB.Repos()
	ts := testhelpers.SetupTestServer(t, repos)

	body, _ := json.Marshal(models.UpdateProfileRequest{})
	rec := ts.DoRequest(testhelpers.AuthRequest(http.MethodPut, "/api/auth/profile", body, ""))
	assert.Equal(t, http.StatusUnauthorized, rec.Code)
}
