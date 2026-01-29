package config

import "time"

// Application limits and constants
const (
	// Repertoire limits
	MaxRepertoires       = 50
	MaxRepertoireNameLen = 100

	// File upload limits
	MaxPGNFileSize = 10 * 1024 * 1024 // 10MB

	// Pagination defaults
	DefaultGamesLimit = 20
	MaxGamesLimit     = 100

	// Lichess API limits
	DefaultLichessGames = 20
	MaxLichessGames     = 100

	// Database timeouts
	DefaultDBTimeout   = 5 * time.Second
	MigrationDBTimeout = 30 * time.Second

	// Video import limits
	MaxVideoLengthSeconds = 3600      // 1 hour max
	VideoProcessTimeout   = 30 * time.Minute
	MaxVideoImports       = 50
)
