//go:build integration

package integration

import (
	"encoding/json"
	"net/http"
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
