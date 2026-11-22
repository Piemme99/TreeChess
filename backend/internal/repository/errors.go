package repository

import "fmt"

// Sentinel errors for repository operations
var (
	// User errors
	ErrUserNotFound   = fmt.Errorf("user not found")
	ErrUsernameExists = fmt.Errorf("username already exists")

	// Refresh token errors
	ErrRefreshTokenNotFound = fmt.Errorf("refresh token not found")
)
