package services

import (
	"github.com/treechess/backend/internal/models"
)

// LichessGameFetcher abstracts the Lichess API for fetching games and studies.
type LichessGameFetcher interface {
	FetchGames(username string, options models.LichessImportOptions) (string, error)
	FetchStudyPGN(studyID, authToken string) (string, error)
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
	SaveTree(repertoireID string, treeData models.RepertoireNode) (*models.Repertoire, error)
}
