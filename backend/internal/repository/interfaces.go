package repository

import "github.com/treechess/backend/internal/models"

// RepertoireRepository defines the interface for repertoire data operations
type RepertoireRepository interface {
	GetRepertoireByColor(color models.Color) (*models.Repertoire, error)
	CreateRepertoire(color models.Color) (*models.Repertoire, error)
	SaveRepertoire(color models.Color, treeData models.RepertoireNode, metadata models.Metadata) (*models.Repertoire, error)
	RepertoireExists(color models.Color) (bool, error)
}

// AnalysisRepository defines the interface for analysis data operations
type AnalysisRepository interface {
	SaveAnalysis(username string, filename string, gameCount int, results []models.GameAnalysis) (*models.AnalysisSummary, error)
	GetAnalyses() ([]models.AnalysisSummary, error)
	GetAnalysisByID(id string) (*models.AnalysisDetail, error)
	DeleteAnalysis(id string) error
	GetAllGames(limit, offset int) (*models.GamesResponse, error)
	DeleteGame(analysisID string, gameIndex int) error
}
