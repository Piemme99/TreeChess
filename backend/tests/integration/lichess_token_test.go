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

func storeRawLichessToken(t *testing.T, userID string, raw any) {
	t.Helper()
	_, err := testDB.Pool.Exec(context.Background(),
		"UPDATE users SET lichess_access_token = $2 WHERE id = $1", userID, raw)
	require.NoError(t, err)
}

func rawLichessToken(t *testing.T, userID string) *string {
	t.Helper()
	var stored *string
	require.NoError(t, testDB.Pool.QueryRow(context.Background(),
		"SELECT lichess_access_token FROM users WHERE id = $1", userID).Scan(&stored))
	return stored
}

func TestLichessToken_UndecryptableTokenReadsAsNotLinkedAndIsCleared(t *testing.T) {
	testDB.TruncateAll(t)
	repos := testDB.Repos()
	ctx := context.Background()

	user, err := repos.User.CreateOAuth(ctx, "lichess", "lichess-id-2", "legacyuser")
	require.NoError(t, err)
	storeRawLichessToken(t, user.ID, "lio_fakeLegacyPlaintextToken")

	fetched, err := repos.User.GetByID(ctx, user.ID)
	require.NoError(t, err)
	assert.Nil(t, fetched.LichessAccessToken, "a plaintext token must never be returned")
	assert.Nil(t, rawLichessToken(t, user.ID), "the undecryptable value must be cleared")
}

func TestLichessToken_StartupMigrationLeavesNoPlaintext(t *testing.T) {
	testDB.TruncateAll(t)
	repos := testDB.Repos()
	ctx := context.Background()

	encrypted, err := repos.User.CreateOAuth(ctx, "lichess", "lichess-id-3", "encrypted")
	require.NoError(t, err)
	require.NoError(t, repos.User.UpdateLichessToken(ctx, encrypted.ID, "lio_alreadyEncrypted"))
	encryptedBefore := rawLichessToken(t, encrypted.ID)

	legacy, err := repos.User.CreateOAuth(ctx, "lichess", "lichess-id-4", "legacy")
	require.NoError(t, err)
	storeRawLichessToken(t, legacy.ID, "lio_legacyPlaintext")

	otherKey, err := repos.User.CreateOAuth(ctx, "lichess", "lichess-id-5", "otherkey")
	require.NoError(t, err)
	storeRawLichessToken(t, otherKey.ID, "bm90LWEtY2lwaGVydGV4dC11bmRlci10aGlzLWtleQ==")

	unlinked, err := repos.User.CreateOAuth(ctx, "lichess", "lichess-id-6", "unlinked")
	require.NoError(t, err)
	storeRawLichessToken(t, unlinked.ID, "")

	// Deux passages : la migration doit être idempotente.
	require.NoError(t, repos.User.EncryptLegacyLichessTokens(ctx))
	require.NoError(t, repos.User.EncryptLegacyLichessTokens(ctx))

	assert.Equal(t, encryptedBefore, rawLichessToken(t, encrypted.ID))

	legacyStored := rawLichessToken(t, legacy.ID)
	require.NotNil(t, legacyStored)
	assert.NotEqual(t, "lio_legacyPlaintext", *legacyStored)
	got, err := repos.User.GetByID(ctx, legacy.ID)
	require.NoError(t, err)
	require.NotNil(t, got.LichessAccessToken)
	assert.Equal(t, "lio_legacyPlaintext", *got.LichessAccessToken)

	assert.Nil(t, rawLichessToken(t, otherKey.ID))

	unlinkedStored := rawLichessToken(t, unlinked.ID)
	require.NotNil(t, unlinkedStored)
	assert.Empty(t, *unlinkedStored)
}
