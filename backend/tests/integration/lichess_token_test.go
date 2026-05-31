//go:build integration

package integration

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestLichessToken_EncryptedAtRest verifies the store→scan round-trip: the token
// returned by GetByID is the original plaintext, but the value persisted in the
// users table is ciphertext (not the raw token).
func TestLichessToken_EncryptedAtRest(t *testing.T) {
	testDB.TruncateAll(t)
	repos := testDB.Repos()

	user, err := repos.User.CreateOAuth(context.Background(), "lichess", "lichess-id-1", "tokenuser")
	require.NoError(t, err)

	const token = "fake-lichess-access-token"
	require.NoError(t, repos.User.UpdateLichessToken(context.Background(), user.ID, token))

	// Reading back through the repository decrypts transparently.
	fetched, err := repos.User.GetByID(context.Background(), user.ID)
	require.NoError(t, err)
	require.NotNil(t, fetched.LichessAccessToken)
	assert.Equal(t, token, *fetched.LichessAccessToken)

	// The raw column must not contain the plaintext token.
	var stored string
	require.NoError(t, testDB.Pool.QueryRow(context.Background(),
		"SELECT lichess_access_token FROM users WHERE id = $1", user.ID).Scan(&stored))
	assert.NotEmpty(t, stored)
	assert.NotEqual(t, token, stored, "token must be encrypted at rest")
}

// TestLichessToken_PlaintextFallback simulates a pre-existing row written before
// encryption was introduced: a plaintext token in the column must still be
// returned as-is on read.
func TestLichessToken_PlaintextFallback(t *testing.T) {
	testDB.TruncateAll(t)
	repos := testDB.Repos()

	user, err := repos.User.CreateOAuth(context.Background(), "lichess", "lichess-id-2", "legacyuser")
	require.NoError(t, err)

	const legacy = "fake-legacy-plaintext-token"
	_, err = testDB.Pool.Exec(context.Background(),
		"UPDATE users SET lichess_access_token = $2 WHERE id = $1", user.ID, legacy)
	require.NoError(t, err)

	fetched, err := repos.User.GetByID(context.Background(), user.ID)
	require.NoError(t, err)
	require.NotNil(t, fetched.LichessAccessToken)
	assert.Equal(t, legacy, *fetched.LichessAccessToken,
		"legacy plaintext token must be tolerated on read")
}
