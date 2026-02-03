package repository

import "fmt"

// Sentinel errors for repository operations
var (
	// Category errors
	ErrCategoryNotFound = fmt.Errorf("category not found")

	// Repertoire errors
	ErrRepertoireNotFound = fmt.Errorf("repertoire not found")

	// Analysis errors
	ErrAnalysisNotFound = fmt.Errorf("analysis not found")
	ErrGameNotFound     = fmt.Errorf("game not found")

	// User errors
	ErrUserNotFound   = fmt.Errorf("user not found")
	ErrUsernameExists = fmt.Errorf("username already exists")
	ErrEmailExists    = fmt.Errorf("email already exists")

	// Password reset errors
	ErrResetTokenNotFound = fmt.Errorf("reset token not found")
)
