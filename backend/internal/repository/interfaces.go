package repository

import "github.com/treechess/backend/internal/models"

// RepertoireRepository defines the interface for repertoire data operations
type RepertoireRepository interface {
	GetByID(id string) (*models.Repertoire, error)
	GetByColor(color models.Color) ([]models.Repertoire, error)
	GetAll() ([]models.Repertoire, error)
	Create(name string, color models.Color) (*models.Repertoire, error)
	Save(id string, treeData models.RepertoireNode, metadata models.Metadata) (*models.Repertoire, error)
	UpdateName(id string, name string) (*models.Repertoire, error)
	Delete(id string) error
	Count() (int, error)
	Exists(id string) (bool, error)
}

// AnalysisRepository defines the interface for analysis data operations
type AnalysisRepository interface {
	Save(username, filename string, gameCount int, results []models.GameAnalysis) (*models.AnalysisSummary, error)
	GetAll() ([]models.AnalysisSummary, error)
	GetByID(id string) (*models.AnalysisDetail, error)
	Delete(id string) error
	GetAllGames(limit, offset int) (*models.GamesResponse, error)
	DeleteGame(analysisID string, gameIndex int) error
	UpdateResults(analysisID string, results []models.GameAnalysis) error
}

// VideoRepository defines the interface for video import data operations
type VideoRepository interface {
	CreateImport(youtubeURL, youtubeID, title string) (*models.VideoImport, error)
	GetImportByID(id string) (*models.VideoImport, error)
	GetAllImports() ([]models.VideoImport, error)
	UpdateImportStatus(id string, status models.VideoImportStatus, progress int, errorMsg *string) error
	UpdateImportFrames(id string, totalFrames, processedFrames int) error
	CompleteImport(id string) error
	DeleteImport(id string) error
	SavePositions(positions []models.VideoPosition) error
	GetPositionsByImportID(importID string) ([]models.VideoPosition, error)
	SearchPositionsByFEN(fen string) ([]models.VideoSearchResult, error)
}
