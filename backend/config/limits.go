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
	// AccountDeletionTimeout bounds the multi-table transaction that erases a
	// user's data. It is longer than DefaultDBTimeout because deletion spans
	// several dependent tables in a single transaction.
	AccountDeletionTimeout = 10 * time.Second

	// Sync cooldown — minimum interval between sync requests per user
	SyncCooldown = 5 * time.Minute

	// Video import limits
	MaxVideoLengthSeconds = 3600 // 1 hour max
	VideoProcessTimeout   = 30 * time.Minute
	MaxVideoImports       = 50

	// Opening-insight tuning. These thresholds control how the dashboard derives
	// "worst mistakes" and "opponent gaps" from analyzed games. They are tuning
	// knobs, not hard correctness limits.

	// InsightOpeningPlyFloor skips the first plies (opening choice, not a
	// mistake) when scoring worst mistakes.
	InsightOpeningPlyFloor = 2
	// InsightMinWinrateDrop is the minimum winrate drop (fraction, 0..1) for a
	// move to be considered a mistake worth surfacing.
	InsightMinWinrateDrop = 0.02
	// InsightMaxSampleGames caps how many example games are attached to a single
	// mistake group.
	InsightMaxSampleGames = 5
	// InsightMinMistakeOccurrences requires a mistake to recur in at least this
	// many games before it is surfaced (filters one-off blunders).
	InsightMinMistakeOccurrences = 2
	// InsightMaxWorstMistakes caps how many worst mistakes are returned.
	InsightMaxWorstMistakes = 2
	// InsightMinGapOccurrences requires an opponent gap to recur in at least this
	// many games before it is surfaced.
	InsightMinGapOccurrences = 2
	// InsightMaxOpponentGaps caps how many opponent gaps are returned.
	InsightMaxOpponentGaps = 10
)
