package repository

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/kumquat/backend/internal/crypto"
)

// newTokenTestRepo builds a repo with only the encryption key populated. The
// pool is nil, which is fine for token encrypt/decrypt boundary logic that does
// not touch the database.
func newTokenTestRepo(t *testing.T) *PostgresUserRepo {
	t.Helper()
	key, err := crypto.DeriveKey("test-jwt-secret", lichessTokenKeyInfo)
	require.NoError(t, err)
	return &PostgresUserRepo{encryptKey: key}
}

func encryptUnderOtherKey(t *testing.T, token string) string {
	t.Helper()
	otherKey, err := crypto.DeriveKey("a-completely-different-secret", lichessTokenKeyInfo)
	require.NoError(t, err)
	stored, err := crypto.Encrypt(otherKey, []byte(token))
	require.NoError(t, err)
	return stored
}

func TestLichessToken_DecryptToken_RoundTrip(t *testing.T) {
	r := newTokenTestRepo(t)

	const token = "lio_fakeLichessAccessToken"
	stored, err := crypto.Encrypt(r.encryptKey, []byte(token))
	require.NoError(t, err)
	assert.NotEqual(t, token, stored, "stored value must be ciphertext, not plaintext")

	got, err := r.decryptToken(stored)
	require.NoError(t, err)
	assert.Equal(t, token, got)
}

func TestLichessToken_DecryptToken_PlaintextIsNeverReturned(t *testing.T) {
	r := newTokenTestRepo(t)

	got, err := r.decryptToken("lio_fakeLegacyPlaintextToken")

	assert.Error(t, err)
	assert.Empty(t, got)
}

func TestLichessToken_DecryptToken_OtherKeyIsNeverReturned(t *testing.T) {
	r := newTokenTestRepo(t)

	got, err := r.decryptToken(encryptUnderOtherKey(t, "lio_fakeToken"))

	assert.Error(t, err)
	assert.Empty(t, got)
}

func TestLichessToken_MigrateStoredToken_EncryptedTokenIsKept(t *testing.T) {
	r := newTokenTestRepo(t)
	stored, err := crypto.Encrypt(r.encryptKey, []byte("lio_fakeToken"))
	require.NoError(t, err)

	_, changed, err := r.migrateStoredToken(stored)

	require.NoError(t, err)
	assert.False(t, changed)
}

func TestLichessToken_MigrateStoredToken_PlaintextLichessTokenIsEncrypted(t *testing.T) {
	r := newTokenTestRepo(t)
	const legacy = "lio_fakeLegacyPlaintextToken"

	replacement, changed, err := r.migrateStoredToken(legacy)

	require.NoError(t, err)
	require.True(t, changed)
	require.NotNil(t, replacement)
	got, err := r.decryptToken(*replacement)
	require.NoError(t, err)
	assert.Equal(t, legacy, got)

	_, changedAgain, err := r.migrateStoredToken(*replacement)
	require.NoError(t, err)
	assert.False(t, changedAgain, "a second run leaves the encrypted token alone")
}

func TestLichessToken_MigrateStoredToken_CiphertextUnderOtherKeyIsCleared(t *testing.T) {
	r := newTokenTestRepo(t)

	replacement, changed, err := r.migrateStoredToken(encryptUnderOtherKey(t, "lio_fakeToken"))

	require.NoError(t, err)
	assert.True(t, changed)
	assert.Nil(t, replacement)
}
