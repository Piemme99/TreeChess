package handlers

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/treechess/backend/internal/repository/mocks"
	"github.com/treechess/backend/internal/services"
)

func newTestOAuthHandler() *OAuthHandler {
	userRepo := &mocks.MockUserRepo{}
	authSvc := services.NewAuthService(userRepo, testJWTSecret, 24*time.Hour)
	oauthSvc := services.NewOAuthService(userRepo, authSvc, "test-client-id", "http://localhost:8080/callback")
	return NewOAuthHandler(oauthSvc, userRepo, "http://localhost:5173", testJWTSecret, false)
}

func TestOAuthHandler_EncryptDecryptCookie(t *testing.T) {
	handler := newTestOAuthHandler()

	data := oauthCookieData{
		State:        "test-state-123",
		CodeVerifier: "test-verifier-456",
	}

	encrypted, err := handler.encryptCookie(data)
	require.NoError(t, err)
	assert.NotEmpty(t, encrypted)

	decrypted, err := handler.decryptCookie(encrypted)
	require.NoError(t, err)
	assert.Equal(t, data.State, decrypted.State)
	assert.Equal(t, data.CodeVerifier, decrypted.CodeVerifier)
}

func TestOAuthHandler_DecryptCookie_Invalid(t *testing.T) {
	handler := newTestOAuthHandler()

	_, err := handler.decryptCookie("not-valid-base64-encrypted-data==")
	assert.Error(t, err)
}

func TestOAuthHandler_DecryptCookie_WrongKey(t *testing.T) {
	handler1 := newTestOAuthHandler()

	data := oauthCookieData{State: "state", CodeVerifier: "verifier"}
	encrypted, err := handler1.encryptCookie(data)
	require.NoError(t, err)

	// Create a handler with a different key
	handler2 := newTestOAuthHandler()
	handler2.encryptKey = []byte("different-key-32-chars-long!!!!!")

	_, err = handler2.decryptCookie(encrypted)
	assert.Error(t, err)
}

func TestOAuthHandler_DecryptCookie_TooShort(t *testing.T) {
	handler := newTestOAuthHandler()

	// Base64 encode a very short ciphertext
	_, err := handler.decryptCookie("AAAA")
	assert.Error(t, err)
}

func TestOAuthHandler_EncryptCookie_DifferentResults(t *testing.T) {
	handler := newTestOAuthHandler()

	data := oauthCookieData{State: "state", CodeVerifier: "verifier"}

	enc1, err := handler.encryptCookie(data)
	require.NoError(t, err)

	enc2, err := handler.encryptCookie(data)
	require.NoError(t, err)

	// Due to random nonce, encrypted values should be different
	assert.NotEqual(t, enc1, enc2)
}
