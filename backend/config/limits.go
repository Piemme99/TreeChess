package config

import "time"

// Application limits and constants
const (
	// Repertoire limits
	MaxRepertoires              = 50
	MaxRepertoireNameLen        = 100
	MaxRepertoireDescriptionLen = 500

	// File upload limits
	MaxPGNFileSize = 10 * 1024 * 1024 // 10MB

	// MaxGamesPerImport bounds the number of games accepted from a single PGN
	// import. A 10MB PGN can hold tens of thousands of games; without this
	// limit a single oversized import can exhaust memory and exceed Postgres's
	// 65535-parameter limit during batch deduplication / persistence.
	MaxGamesPerImport = 5000

	// DBBatchSize is the maximum number of rows (and therefore parameter
	// groups) included in a single batched DB query. Kept well below
	// Postgres's 65535-parameter limit even at 4 parameters per row.
	DBBatchSize = 1000

	// Pagination defaults
	DefaultGamesLimit = 20
	MaxGamesLimit     = 100

	// Lichess API limits
	DefaultLichessGames = 20
	MaxLichessGames     = 100

	// Database timeouts
	DefaultDBTimeout   = 5 * time.Second
	MigrationDBTimeout = 30 * time.Second

	// UserDeleteDBTimeout bounds the multi-statement account-deletion
	// transaction, which touches several tables and so needs more headroom
	// than a single DefaultDBTimeout query.
	UserDeleteDBTimeout = 10 * time.Second

	// Sync cooldown — minimum interval between sync requests per user
	SyncCooldown = 5 * time.Minute

	// Video import limits
	MaxVideoLengthSeconds = 3600 // 1 hour max
	VideoProcessTimeout   = 30 * time.Minute
	MaxVideoImports       = 50
)
