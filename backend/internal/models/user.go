package models

import (
	"encoding/json"
	"time"
)

type User struct {
	ID                 string     `json:"id"`
	Username           string     `json:"username"`
	Email              *string    `json:"email,omitempty"`
	PasswordHash       string     `json:"-"`
	OAuthProvider      *string    `json:"oauthProvider,omitempty"`
	OAuthID            *string    `json:"-"`
	LichessUsername    *string    `json:"lichessUsername,omitempty"`
	ChesscomUsername   *string    `json:"chesscomUsername,omitempty"`
	LichessAccessToken *string    `json:"-"`
	LastLichessSyncAt  *time.Time `json:"lastLichessSyncAt,omitempty"`
	LastChesscomSyncAt *time.Time `json:"lastChesscomSyncAt,omitempty"`
	TimeFormatPrefs    []string   `json:"timeFormatPrefs,omitempty"`
	PasswordChangedAt  *time.Time `json:"-"`
	CreatedAt          time.Time  `json:"createdAt"`
}

// MarshalJSON exposes a derived `lichessLinked` boolean so the frontend can
// gate Lichess-dependent features (Training tab) without ever seeing the
// raw access token. The field is true only when a non-empty token is stored.
func (u User) MarshalJSON() ([]byte, error) {
	type alias User
	return json.Marshal(struct {
		alias
		LichessLinked bool `json:"lichessLinked"`
	}{
		alias:         alias(u),
		LichessLinked: u.LichessAccessToken != nil && *u.LichessAccessToken != "",
	})
}

type SyncResult struct {
	LichessGamesImported  int    `json:"lichessGamesImported"`
	ChesscomGamesImported int    `json:"chesscomGamesImported"`
	LichessError          string `json:"lichessError,omitempty"`
	ChesscomError         string `json:"chesscomError,omitempty"`
}

type UpdateProfileRequest struct {
	LichessUsername  *string  `json:"lichessUsername"`
	ChesscomUsername *string  `json:"chesscomUsername"`
	TimeFormatPrefs  []string `json:"timeFormatPrefs,omitempty"`
}

type RegisterRequest struct {
	Email    string `json:"email"`
	Username string `json:"username"`
	Password string `json:"password"`
}

type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type AuthResponse struct {
	Token        string `json:"token"`
	RefreshToken string `json:"refreshToken,omitempty"`
	User         User   `json:"user"`
}
