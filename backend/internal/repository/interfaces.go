package repository

import (
	"time"

	"github.com/treechess/backend/internal/models"
)

// FingerprintEntry represents a single fingerprint to save
type FingerprintEntry struct {
	Fingerprint string
	GameIndex   int
}

// UserRepository defines the interface for user data operations
type UserRepository interface {
	Create(username, passwordHash string) (*models.User, error)
	GetByUsername(username string) (*models.User, error)
	GetByID(id string) (*models.User, error)
	Exists(username string) (bool, error)
	FindByOAuth(provider, oauthID string) (*models.User, error)
	CreateOAuth(provider, oauthID, username string) (*models.User, error)
	UpdateProfile(userID string, lichess, chesscom *string) (*models.User, error)
	UpdateSyncTimestamps(userID string, lichessSyncAt, chesscomSyncAt *time.Time) error
	UpdateLichessToken(userID, token string) error
}

// RepertoireRepository defines the interface for repertoire data operations
type RepertoireRepository interface {
	GetByID(id string) (*models.Repertoire, error)
	GetByColor(userID string, color models.Color) ([]models.Repertoire, error)
	GetAll(userID string) ([]models.Repertoire, error)
	Create(userID string, name string, color models.Color) (*models.Repertoire, error)
	Save(id string, treeData models.RepertoireNode, metadata models.Metadata) (*models.Repertoire, error)
	UpdateName(id string, name string) (*models.Repertoire, error)
	Delete(id string) error
	Count(userID string) (int, error)
	Exists(id string) (bool, error)
	BelongsToUser(id string, userID string) (bool, error)
}

// GameFingerprintRepository defines the interface for game fingerprint operations
type GameFingerprintRepository interface {
	CheckExisting(userID string, fingerprints []string) (map[string]bool, error)
	SaveBatch(userID, analysisID string, entries []FingerprintEntry) error
	DeleteByAnalysisAndIndex(analysisID string, gameIndex int) error
}

// EngineEvalRepository defines the interface for engine evaluation operations
type EngineEvalRepository interface {
	CreatePendingBatch(userID, analysisID string, gameCount int) error
	GetPending(limit int) ([]models.EngineEval, error)
	MarkProcessing(id string) error
	SaveEvals(id string, evals []models.ExplorerMoveStats) error
	MarkFailed(id string) error
	GetByUser(userID string) ([]models.EngineEval, error)
}

// AnalysisRepository defines the interface for analysis data operations
type AnalysisRepository interface {
	Save(userID string, username, filename string, gameCount int, results []models.GameAnalysis) (*models.AnalysisSummary, error)
	GetAll(userID string) ([]models.AnalysisSummary, error)
	GetByID(id string) (*models.AnalysisDetail, error)
	Delete(id string) error
	GetAllGames(userID string, limit, offset int, timeClass, repertoire, source string) (*models.GamesResponse, error)
	DeleteGame(analysisID string, gameIndex int) error
	UpdateResults(analysisID string, results []models.GameAnalysis) error
	BelongsToUser(id string, userID string) (bool, error)
	GetDistinctRepertoires(userID string) ([]string, error)
	MarkGameViewed(userID, analysisID string, gameIndex int) error
	GetViewedGames(userID string) (map[string]bool, error)
	GetAllGamesRaw(userID string) ([]models.RawAnalysis, error)
}
