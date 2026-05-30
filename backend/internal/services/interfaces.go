package services

import (
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
	ParseAndAnalyze(filename, username, userID, pgnData string) (*models.AnalysisSummary, []models.GameAnalysis, error)
}

// RepertoireManager abstracts repertoire creation and tree operations.
type RepertoireManager interface {
	CreateRepertoire(userID, name string, color models.Color) (*models.Repertoire, error)
	CreateRepertoireWithCategory(userID, name string, color models.Color, categoryID *string) (*models.Repertoire, error)
	SaveTree(userID, repertoireID string, treeData models.RepertoireNode) (*models.Repertoire, error)
	SetOrigin(repertoireID, userID string, origin *models.RepertoireOrigin) error
	ListRepertoires(userID string, color *models.Color) ([]models.Repertoire, error)
}
