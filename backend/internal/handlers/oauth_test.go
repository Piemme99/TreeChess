package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/labstack/echo/v5"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/kumquat/backend/internal/models"
	"github.com/kumquat/backend/internal/repository/mocks"
	"github.com/kumquat/backend/internal/services"
)

func newTestOAuthHandler() *OAuthHandler {
	return newTestOAuthHandlerWith(&mocks.MockUserRepo{})
}

func newTestOAuthHandlerWith(userRepo *mocks.MockUserRepo) *OAuthHandler {
	authSvc := services.NewAuthService(userRepo, testJWTSecret, 24*time.Hour)
	oauthSvc := services.NewOAuthService(userRepo, authSvc, "test-client-id", "http://localhost:8080/callback")
	return NewOAuthHandler(oauthSvc, authSvc, userRepo, "http://localhost:5173", testJWTSecret, false)
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

func TestOAuthHandler_LoginRedirect_KeepsLocalNextInStateCookie(t *testing.T) {
	cases := map[string]string{
		"/v2/tree?side=b":      "/v2/tree?side=b",
		"":                     "",
		"https://evil.example": "",
		"//evil.example/v2":    "",
		"/\\evil.example":      "",
		"v2/tree":              "",
		"/" + strings.Repeat("a", maxOAuthNextLength): "",
	}
	for next, want := range cases {
		t.Run(next, func(t *testing.T) {
			handler := newTestOAuthHandler()
			e := echo.New()
			rec := httptest.NewRecorder()
			c := e.NewContext(httptest.NewRequest(http.MethodGet, "/api/auth/lichess/login?next="+url.QueryEscape(next), nil), rec)

			require.NoError(t, handler.LoginRedirect(c))

			assert.Equal(t, http.StatusTemporaryRedirect, rec.Code)
			cookies := rec.Result().Cookies()
			require.Len(t, cookies, 1)
			data, err := handler.decryptCookie(cookies[0].Value)
			require.NoError(t, err)
			assert.Equal(t, want, data.Next)
		})
	}
}

func TestOAuthHandler_StartAccountDeletion_LichessAccountDeletesOnlyAfterLichess(t *testing.T) {
	provider, lichessID := "lichess", "lichess-abc"
	handler := newTestOAuthHandlerWith(&mocks.MockUserRepo{
		GetByIDFunc: func(_ context.Context, id string) (*models.User, error) {
			return &models.User{ID: id, Username: "mike", OAuthProvider: &provider, OAuthID: &lichessID}, nil
		},
		DeleteFunc: func(_ context.Context, _ string) error {
			t.Fatal("a Lichess account must not be deleted before Lichess confirms")
			return nil
		},
	})
	e := echo.New()
	rec := httptest.NewRecorder()
	c := e.NewContext(httptest.NewRequest(http.MethodPost, "/api/auth/account/deletion", strings.NewReader(`{"username":"mike"}`)), rec)
	c.Request().Header.Set("Content-Type", "application/json")
	c.Set("userID", "user-123")

	require.NoError(t, handler.StartAccountDeletion(c))

	assert.Equal(t, http.StatusOK, rec.Code)
	var body map[string]string
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &body))
	assert.True(t, strings.HasPrefix(body["redirect"], "https://lichess.org/oauth?"))
	cookies := rec.Result().Cookies()
	require.Len(t, cookies, 1)
	data, err := handler.decryptCookie(cookies[0].Value)
	require.NoError(t, err)
	assert.Equal(t, "user-123", data.DeleteUserID)
}

func TestOAuthHandler_FinishAccountDeletion_SignsOutOnlyWhenTheLinkedLichessAccountConfirms(t *testing.T) {
	cases := map[string]struct {
		lichessID string
		location  string
	}{
		"the linked account": {"lichess-abc", "http://localhost:5173/v2/home?deleted=1"},
		"another account":    {"lichess-xyz", "http://localhost:5173/v2/home?deletion=failed"},
	}
	for name, tc := range cases {
		t.Run(name, func(t *testing.T) {
			provider, lichessID := "lichess", "lichess-abc"
			handler := newTestOAuthHandlerWith(&mocks.MockUserRepo{
				GetByIDFunc: func(_ context.Context, id string) (*models.User, error) {
					return &models.User{ID: id, Username: "mike", OAuthProvider: &provider, OAuthID: &lichessID}, nil
				},
				DeleteFunc: func(_ context.Context, _ string) error { return nil },
			})
			e := echo.New()
			rec := httptest.NewRecorder()
			c := e.NewContext(httptest.NewRequest(http.MethodGet, "/api/auth/lichess/callback", nil), rec)

			require.NoError(t, handler.finishAccountDeletion(c, "user-123", tc.lichessID))

			assert.Equal(t, http.StatusTemporaryRedirect, rec.Code)
			assert.Equal(t, tc.location, rec.Header().Get("Location"))
			signedOut := false
			for _, cookie := range rec.Result().Cookies() {
				signedOut = signedOut || (cookie.Name == refreshTokenCookieName && cookie.MaxAge < 0)
			}
			assert.Equal(t, tc.lichessID == "lichess-abc", signedOut)
		})
	}
}

func TestOAuthHandler_Callback_DeletionRefusedOnLichessSaysNothingWasDeleted(t *testing.T) {
	handler := newTestOAuthHandler()
	encrypted, err := handler.encryptCookie(oauthCookieData{State: "s1", CodeVerifier: "v1", DeleteUserID: "user-123"})
	require.NoError(t, err)
	e := echo.New()
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/auth/lichess/callback?error=access_denied&state=s1", nil)
	req.AddCookie(&http.Cookie{Name: oauthCookieName, Value: encrypted})
	c := e.NewContext(req, rec)

	require.NoError(t, handler.Callback(c))

	assert.Equal(t, "http://localhost:5173/v2/home?deletion=failed", rec.Header().Get("Location"))
}
