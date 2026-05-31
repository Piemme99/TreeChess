// Package crypto provides small AES-256-GCM helpers used to protect sensitive
// values at rest (e.g. the OAuth state cookie and the stored Lichess access
// token). Keys are derived from the JWT secret via HKDF (RFC 5869) using a
// distinct info label per use-site, ensuring key separation.
package crypto

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"fmt"
	"io"

	"golang.org/x/crypto/hkdf"
)

// KeySize is the AES-256 key length in bytes.
const KeySize = 32

// DeriveKey derives a 32-byte AES-256 key from secret using HKDF-SHA256 with the
// given info label. The info label provides key separation between distinct
// use-sites that share the same secret (e.g. cookie encryption vs token
// encryption), so the same secret yields independent keys.
func DeriveKey(secret, info string) ([]byte, error) {
	reader := hkdf.New(sha256.New, []byte(secret), nil, []byte(info))
	key := make([]byte, KeySize)
	if _, err := io.ReadFull(reader, key); err != nil {
		return nil, fmt.Errorf("failed to derive key: %w", err)
	}
	return key, nil
}

// Encrypt seals plaintext with AES-256-GCM using key and returns the result as a
// base64-URL-encoded string (nonce prepended to the ciphertext).
func Encrypt(key, plaintext []byte) (string, error) {
	gcm, err := newGCM(key)
	if err != nil {
		return "", err
	}

	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", fmt.Errorf("failed to generate nonce: %w", err)
	}

	ciphertext := gcm.Seal(nonce, nonce, plaintext, nil)
	return base64.URLEncoding.EncodeToString(ciphertext), nil
}

// Decrypt reverses Encrypt: it base64-URL-decodes encoded, then opens the
// AES-256-GCM ciphertext with key. It returns an error if the input is not valid
// base64, is too short, or fails authentication.
func Decrypt(key []byte, encoded string) ([]byte, error) {
	ciphertext, err := base64.URLEncoding.DecodeString(encoded)
	if err != nil {
		return nil, fmt.Errorf("failed to decode ciphertext: %w", err)
	}

	gcm, err := newGCM(key)
	if err != nil {
		return nil, err
	}

	nonceSize := gcm.NonceSize()
	if len(ciphertext) < nonceSize {
		return nil, fmt.Errorf("ciphertext too short")
	}

	nonce, ciphertext := ciphertext[:nonceSize], ciphertext[nonceSize:]
	plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to decrypt: %w", err)
	}
	return plaintext, nil
}

func newGCM(key []byte) (cipher.AEAD, error) {
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, fmt.Errorf("failed to create cipher: %w", err)
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("failed to create GCM: %w", err)
	}
	return gcm, nil
}
