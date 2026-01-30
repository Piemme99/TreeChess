package repository

import "github.com/treechess/backend/internal/models"

// UserRepository defines the interface for user data operations
type UserRepository interface {
	Create(username, passwordHash string) (*models.User, error)
	GetByUsername(username string) (*models.User, error)
	GetByID(id string) (*models.User, error)
	Exists(username string) (bool, error)
	FindByOAuth(provider, oauthID string) (*models.User, error)
	CreateOAuth(provider, oauthID, username string) (*models.User, error)
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

// AnalysisRepository defines the interface for analysis data operations
type AnalysisRepository interface {
	Save(userID string, username, filename string, gameCount int, results []models.GameAnalysis) (*models.AnalysisSummary, error)
	GetAll(userID string) ([]models.AnalysisSummary, error)
	GetByID(id string) (*models.AnalysisDetail, error)
	Delete(id string) error
	GetAllGames(userID string, limit, offset int) (*models.GamesResponse, error)
	DeleteGame(analysisID string, gameIndex int) error
	UpdateResults(analysisID string, results []models.GameAnalysis) error
	BelongsToUser(id string, userID string) (bool, error)
}

// VideoRepository defines the interface for video import data operations
type VideoRepository interface {
	CreateImport(userID string, youtubeURL, youtubeID, title string) (*models.VideoImport, error)
	GetImportByID(id string) (*models.VideoImport, error)
	GetAllImports(userID string) ([]models.VideoImport, error)
	UpdateImportStatus(id string, status models.VideoImportStatus, progress int, errorMsg *string) error
	UpdateImportFrames(id string, totalFrames, processedFrames int) error
	CompleteImport(id string) error
	DeleteImport(id string) error
	SavePositions(positions []models.VideoPosition) error
	GetPositionsByImportID(importID string) ([]models.VideoPosition, error)
	SearchPositionsByFEN(userID string, fen string) ([]models.VideoSearchResult, error)
	BelongsToUser(id string, userID string) (bool, error)
}
