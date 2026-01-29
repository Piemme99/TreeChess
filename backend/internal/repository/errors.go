package repository

import "fmt"

// Sentinel errors for repository operations
var (
	// Repertoire errors
	ErrRepertoireNotFound = fmt.Errorf("repertoire not found")

	// Analysis errors
	ErrAnalysisNotFound = fmt.Errorf("analysis not found")
	ErrGameNotFound     = fmt.Errorf("game not found")

	// Video import errors
	ErrVideoImportNotFound = fmt.Errorf("video import not found")
)
