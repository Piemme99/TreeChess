package services

import (
	"context"

	"github.com/kumquat/backend/internal/models"
)

// LichessGameFetcher abstracts the Lichess API for fetching games and studies.
type LichessGameFetcher interface {
	FetchGames(username string, options models.LichessImportOptions) (string, error)
	FetchStudyPGN(studyID, authToken string) (string, error)
	FetchStudyMetadata(studyID, authToken string) (*models.LichessStudyResult, error)
	SearchStudies(query, order string, page int, authToken string) (*models.LichessStudySearchResponse, error)
	BrowseStudiesByTopic(topic, sort string, page int, authToken string) (*models.LichessStudySearchResponse, error)
	BrowseAllStudies(sort string, page int, authToken string) (*models.LichessStudySearchResponse, error)
	GetPopularTopics() (*models.LichessTopicsResponse, error)
}

// ChesscomGameFetcher abstracts the Chess.com API for fetching games.
type ChesscomGameFetcher interface {
	FetchGames(username string, options models.ChesscomImportOptions) (string, error)
}

// GameImporter abstracts game parsing and analysis.
type GameImporter interface {
	ParseAndAnalyze(ctx context.Context, filename, username, userID, pgnData string) (*models.AnalysisSummary, []models.GameAnalysis, error)
}

// RepertoireManager abstracts repertoire creation and tree operations.
type RepertoireManager interface {
	CreateRepertoire(ctx context.Context, userID, name string, color models.Color) (*models.Repertoire, error)
	CreateRepertoireWithCategory(ctx context.Context, userID, name string, color models.Color, categoryID *string) (*models.Repertoire, error)
	SaveTree(ctx context.Context, userID, repertoireID string, treeData models.RepertoireNode) (*models.Repertoire, error)
	SetOrigin(ctx context.Context, repertoireID, userID string, origin *models.RepertoireOrigin) error
	ListRepertoires(ctx context.Context, userID string, color *models.Color) ([]models.Repertoire, error)
	// PersistStudyImport atomically creates the optional category and all
	// repertoires in a study import, rolling back on any failure.
	PersistStudyImport(ctx context.Context, userID string, plan models.StudyImportPlan) (*models.StudyImportPersistResult, error)
}
