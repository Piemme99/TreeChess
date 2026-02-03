package models

import "time"

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
	CreatedAt          time.Time  `json:"createdAt"`
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
	Token string `json:"token"`
	User  User   `json:"user"`
}
