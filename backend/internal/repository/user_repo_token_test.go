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

// TestLichessToken_EncryptDecryptRoundTrip mirrors the store→scan path: a token
// encrypted with the repo key decrypts back to the original plaintext.
func TestLichessToken_EncryptDecryptRoundTrip(t *testing.T) {
	r := newTokenTestRepo(t)

	const token = "fake-lichess-access-token"
	stored, err := crypto.Encrypt(r.encryptKey, []byte(token))
	require.NoError(t, err)
	assert.NotEqual(t, token, stored, "stored value must be ciphertext, not plaintext")

	assert.Equal(t, token, r.decryptToken(stored))
}

// TestLichessToken_PlaintextFallback ensures pre-existing plaintext tokens (from
// before encryption was introduced) are returned as-is rather than erroring.
func TestLichessToken_PlaintextFallback(t *testing.T) {
	r := newTokenTestRepo(t)

	const legacy = "fake-legacy-plaintext-token"
	assert.Equal(t, legacy, r.decryptToken(legacy))
}

// TestLichessToken_EmptyStays empty values round-trip to empty.
func TestLichessToken_EmptyStays(t *testing.T) {
	r := newTokenTestRepo(t)
	assert.Equal(t, "", r.decryptToken(""))
}

// TestLichessToken_WrongKeyFallsBack a token encrypted under a different key
// cannot be decrypted; the stored value is returned verbatim (treated as legacy
// plaintext) rather than producing an error.
func TestLichessToken_WrongKeyFallsBack(t *testing.T) {
	r := newTokenTestRepo(t)

	otherKey, err := crypto.DeriveKey("a-completely-different-secret", lichessTokenKeyInfo)
	require.NoError(t, err)
	stored, err := crypto.Encrypt(otherKey, []byte("fake-token"))
	require.NoError(t, err)

	assert.Equal(t, stored, r.decryptToken(stored))
}
