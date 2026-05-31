package repository

import (
	"context"
	"time"

	"github.com/kumquat/backend/internal/models"
)

// FingerprintEntry represents a single fingerprint to save
type FingerprintEntry struct {
	Fingerprint string
	GameIndex   int
}

// UserRepository defines the interface for user data operations
type UserRepository interface {
	Create(ctx context.Context, email, username, passwordHash string) (*models.User, error)
	GetByUsername(ctx context.Context, username string) (*models.User, error)
	GetByEmail(ctx context.Context, email string) (*models.User, error)
	GetByID(ctx context.Context, id string) (*models.User, error)
	Exists(ctx context.Context, username string) (bool, error)
	EmailExists(ctx context.Context, email string) (bool, error)
	FindByOAuth(ctx context.Context, provider, oauthID string) (*models.User, error)
	CreateOAuth(ctx context.Context, provider, oauthID, username string) (*models.User, error)
	UpdateProfile(ctx context.Context, userID string, lichess, chesscom *string, timeFormatPrefs []string) (*models.User, error)
	UpdateSyncTimestamps(ctx context.Context, userID string, lichessSyncAt, chesscomSyncAt *time.Time) error
	ResetSyncTimestamps(ctx context.Context, userID string) error
	UpdateLichessToken(ctx context.Context, userID, token string) error
	UpdatePassword(ctx context.Context, userID, passwordHash string) error
	Delete(ctx context.Context, id string) error
}

// RepertoireRepository defines the interface for repertoire data operations
type RepertoireRepository interface {
	GetByID(ctx context.Context, id string, userID string) (*models.Repertoire, error)
	GetByColor(ctx context.Context, userID string, color models.Color) ([]models.Repertoire, error)
	GetAll(ctx context.Context, userID string) ([]models.Repertoire, error)
	Create(ctx context.Context, userID string, name string, color models.Color) (*models.Repertoire, error)
	Save(ctx context.Context, id string, userID string, treeData models.RepertoireNode, metadata models.Metadata, expectedVersion int) (*models.Repertoire, error)
	UpdateName(ctx context.Context, id string, userID string, name string) (*models.Repertoire, error)
	UpdateDescription(ctx context.Context, id string, userID string, description string) (*models.Repertoire, error)
	Delete(ctx context.Context, id string, userID string) error
	Count(ctx context.Context, userID string) (int, error)
	Exists(ctx context.Context, id string) (bool, error)
	BelongsToUser(ctx context.Context, id string, userID string) (bool, error)
}

// GameFingerprintRepository defines the interface for game fingerprint operations
type GameFingerprintRepository interface {
	CheckExisting(ctx context.Context, userID string, fingerprints []string) (map[string]bool, error)
	SaveBatch(ctx context.Context, userID, analysisID string, entries []FingerprintEntry) error
}

// OpeningExplorerCacheRepository persists Lichess Opening Explorer responses
// across users so a popular FEN is fetched from upstream at most once per
// TTL window.
type OpeningExplorerCacheRepository interface {
	Get(ctx context.Context, cacheKey string) (payload []byte, found bool, err error)
	Put(ctx context.Context, cacheKey string, payload []byte, expiresAt time.Time) error
	DeleteExpired(ctx context.Context) error
}

// EngineEvalRepository defines the interface for engine evaluation operations
type EngineEvalRepository interface {
	CreatePendingBatch(ctx context.Context, userID, analysisID string, gameCount int) error
	// ClaimPending atomically marks up to limit pending evals as processing and
	// returns them (FOR UPDATE SKIP LOCKED), so concurrent workers never claim
	// the same row.
	ClaimPending(ctx context.Context, limit int) ([]models.EngineEval, error)
	// GetPending and MarkProcessing remain for non-worker callers; the worker
	// uses the atomic ClaimPending instead.
	GetPending(ctx context.Context, limit int) ([]models.EngineEval, error)
	MarkProcessing(ctx context.Context, id string) error
	SaveEvals(ctx context.Context, id string, evals []models.ExplorerMoveStats) error
	MarkFailed(ctx context.Context, id string) error
	GetByUser(ctx context.Context, userID string) ([]models.EngineEval, error)
	ResetStaleProcessing(ctx context.Context) (int, error)
}

// DismissedMistakeRepository defines the interface for dismissed mistake operations
type DismissedMistakeRepository interface {
	Dismiss(ctx context.Context, userID, fen, playedMove string) error
	GetDismissed(ctx context.Context, userID string) (map[string]bool, error)
}

// DismissedGapRepository defines the interface for dismissed gap operations
type DismissedGapRepository interface {
	Dismiss(ctx context.Context, userID, fen, opponentMove, repertoireID string) error
	GetDismissed(ctx context.Context, userID string) (map[string]bool, error)
}

// ResultsMutator transforms an analysis's current results into the results to
// persist. It is invoked with the freshly-locked results inside MutateResults'
// transaction. It returns the new results and a changed flag; when changed is
// false the row is left untouched. Returning an error aborts the transaction.
type ResultsMutator func(current []models.GameAnalysis) (updated []models.GameAnalysis, changed bool, err error)

// AnalysisRepository defines the interface for analysis data operations
type AnalysisRepository interface {
	Save(ctx context.Context, userID string, username, filename string, gameCount int, results []models.GameAnalysis) (*models.AnalysisSummary, error)
	GetAll(ctx context.Context, userID string) ([]models.AnalysisSummary, error)
	GetByID(ctx context.Context, id string, userID string) (*models.AnalysisDetail, error)
	Delete(ctx context.Context, id string, userID string) error
	GetAllGames(ctx context.Context, userID string, limit, offset int, timeClass, repertoire, source string, onlyNew bool) (*models.GamesResponse, error)
	UpdateResults(ctx context.Context, analysisID string, userID string, results []models.GameAnalysis) error
	// MutateResults applies a mutation to an analysis's results within a single
	// row-locked transaction, preventing lost-update races between concurrent
	// re-analysis paths. See PostgresAnalysisRepo.MutateResults.
	MutateResults(ctx context.Context, analysisID string, userID string, mutate ResultsMutator) error
	BelongsToUser(ctx context.Context, id string, userID string) (bool, error)
	GetDistinctRepertoires(ctx context.Context, userID string) ([]models.RepertoireFilterOption, error)
	MarkGameViewed(ctx context.Context, userID, analysisID string, gameIndex int) error
	GetViewedGames(ctx context.Context, userID string) (map[string]bool, error)
	GetAllGamesRaw(ctx context.Context, userID string) ([]models.RawAnalysis, error)
}

// RefreshTokenRepository defines the interface for refresh token operations
type RefreshTokenRepository interface {
	Create(ctx context.Context, userID, tokenHash string, expiresAt time.Time) (*models.RefreshToken, error)
	GetByTokenHash(ctx context.Context, tokenHash string) (*models.RefreshToken, error)
	MarkConsumed(ctx context.Context, id string) error
	Delete(ctx context.Context, id string) error
	DeleteByUserID(ctx context.Context, userID string) error
	DeleteExpired(ctx context.Context) error
	CountByUserID(ctx context.Context, userID string) (int, error)
}

// PasswordResetRepository defines the interface for password reset token operations
type PasswordResetRepository interface {
	Create(ctx context.Context, userID, tokenHash string, expiresAt time.Time) (*models.PasswordResetToken, error)
	GetByTokenHash(ctx context.Context, tokenHash string) (*models.PasswordResetToken, error)
	MarkUsed(ctx context.Context, id string) error
	DeleteByUserID(ctx context.Context, userID string) error
	DeleteExpired(ctx context.Context) error
	CountRecentByUserID(ctx context.Context, userID string, since time.Time) (int, error)
}
