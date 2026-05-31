package models

import "time"

// RefreshToken represents a refresh token stored in the database.
// The raw token is never stored — only its SHA-256 hash.
type RefreshToken struct {
	ID        string    `json:"id"`
	UserID    string    `json:"userId"`
	TokenHash string    `json:"-"`
	ExpiresAt time.Time `json:"expiresAt"`
	CreatedAt time.Time `json:"createdAt"`
	// Consumed marks a token that was rotated out. A consumed token presented again
	// indicates reuse/theft and triggers family-wide revocation.
	Consumed bool `json:"-"`
}

// TokenPair holds an access token (JWT) and a raw refresh token
// returned to the client after login/register/refresh.
type TokenPair struct {
	AccessToken  string `json:"accessToken"`
	RefreshToken string `json:"refreshToken,omitempty"`
}
