package crypto

import (
	"encoding/base64"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestDeriveKey_Deterministic(t *testing.T) {
	k1, err := DeriveKey("secret", "info-a")
	require.NoError(t, err)
	k2, err := DeriveKey("secret", "info-a")
	require.NoError(t, err)

	assert.Len(t, k1, KeySize)
	assert.Equal(t, k1, k2, "same secret+info must derive the same key")
}

func TestDeriveKey_SeparationByInfo(t *testing.T) {
	k1, err := DeriveKey("secret", "info-a")
	require.NoError(t, err)
	k2, err := DeriveKey("secret", "info-b")
	require.NoError(t, err)

	assert.NotEqual(t, k1, k2, "distinct info labels must derive independent keys")
}

func TestEncryptDecrypt_RoundTrip(t *testing.T) {
	key, err := DeriveKey("secret", "info")
	require.NoError(t, err)

	plaintext := []byte("fake-lichess-access-token")
	encoded, err := Encrypt(key, plaintext)
	require.NoError(t, err)

	// Ciphertext must not leak the plaintext and must be valid base64-URL.
	assert.NotContains(t, encoded, "fake-lichess-access-token")
	_, decodeErr := base64.URLEncoding.DecodeString(encoded)
	assert.NoError(t, decodeErr)

	decrypted, err := Decrypt(key, encoded)
	require.NoError(t, err)
	assert.Equal(t, plaintext, decrypted)
}

func TestEncrypt_NonceRandomized(t *testing.T) {
	key, err := DeriveKey("secret", "info")
	require.NoError(t, err)

	a, err := Encrypt(key, []byte("same"))
	require.NoError(t, err)
	b, err := Encrypt(key, []byte("same"))
	require.NoError(t, err)

	assert.NotEqual(t, a, b, "fresh nonce must make repeated ciphertexts differ")
}

func TestDecrypt_WrongKeyFails(t *testing.T) {
	key, err := DeriveKey("secret", "info")
	require.NoError(t, err)
	other, err := DeriveKey("different-secret", "info")
	require.NoError(t, err)

	encoded, err := Encrypt(key, []byte("payload"))
	require.NoError(t, err)

	_, err = Decrypt(other, encoded)
	assert.Error(t, err)
}

func TestDecrypt_InvalidInput(t *testing.T) {
	key, err := DeriveKey("secret", "info")
	require.NoError(t, err)

	_, err = Decrypt(key, "not-base64-!!!")
	assert.Error(t, err)

	_, err = Decrypt(key, base64.URLEncoding.EncodeToString([]byte("short")))
	assert.Error(t, err)
}
