package services

import (
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/treechess/backend/internal/models"
	"github.com/treechess/backend/internal/repository/mocks"
)

func TestSyncService_Sync_BothPlatforms(t *testing.T) {
	lichessUser := "lichessplayer"
	chesscomUser := "chesscomuser"
	user := &models.User{
		ID:              "user-1",
		LichessUsername:  &lichessUser,
		ChesscomUsername: &chesscomUser,
	}

	mockUserRepo := &mocks.MockUserRepo{
		GetByIDFunc: func(id string) (*models.User, error) { return user, nil },
		UpdateSyncTimestampsFunc: func(userID string, l, c *time.Time) error { return nil },
	}
	mockLichess := &mocks.MockLichessService{
		FetchGamesFunc: func(username string, opts models.LichessImportOptions) (string, error) {
			return "[Event \"Test\"]\n\n1. e4 e5 1-0\n", nil
		},
	}
	mockChesscom := &mocks.MockChesscomService{
		FetchGamesFunc: func(username string, opts models.ChesscomImportOptions) (string, error) {
			return "[Event \"Test\"]\n\n1. d4 d5 0-1\n", nil
		},
	}
	mockImport := &mocks.MockImportService{
		ParseAndAnalyzeFunc: func(filename, username, userID, pgnData string) (*models.AnalysisSummary, []models.GameAnalysis, error) {
			return &models.AnalysisSummary{GameCount: 1}, nil, nil
		},
	}

	svc := NewSyncService(mockUserRepo, mockImport, mockLichess, mockChesscom)
	result, err := svc.Sync("user-1")

	require.NoError(t, err)
	assert.Equal(t, 1, result.LichessGamesImported)
	assert.Equal(t, 1, result.ChesscomGamesImported)
	assert.Empty(t, result.LichessError)
	assert.Empty(t, result.ChesscomError)
}

func TestSyncService_Sync_LichessOnly(t *testing.T) {
	lichessUser := "lichessplayer"
	user := &models.User{
		ID:              "user-1",
		LichessUsername:  &lichessUser,
		ChesscomUsername: nil,
	}

	mockUserRepo := &mocks.MockUserRepo{
		GetByIDFunc: func(id string) (*models.User, error) { return user, nil },
		UpdateSyncTimestampsFunc: func(userID string, l, c *time.Time) error { return nil },
	}
	mockImport := &mocks.MockImportService{
		ParseAndAnalyzeFunc: func(filename, username, userID, pgnData string) (*models.AnalysisSummary, []models.GameAnalysis, error) {
			return &models.AnalysisSummary{GameCount: 3}, nil, nil
		},
	}
	mockLichess := &mocks.MockLichessService{
		FetchGamesFunc: func(username string, opts models.LichessImportOptions) (string, error) {
			return "pgn data", nil
		},
	}

	svc := NewSyncService(mockUserRepo, mockImport, mockLichess, &mocks.MockChesscomService{})
	result, err := svc.Sync("user-1")

	require.NoError(t, err)
	assert.Equal(t, 3, result.LichessGamesImported)
	assert.Equal(t, 0, result.ChesscomGamesImported)
}

func TestSyncService_Sync_ChesscomOnly(t *testing.T) {
	chesscomUser := "chesscomuser"
	user := &models.User{
		ID:              "user-1",
		LichessUsername:  nil,
		ChesscomUsername: &chesscomUser,
	}

	mockUserRepo := &mocks.MockUserRepo{
		GetByIDFunc: func(id string) (*models.User, error) { return user, nil },
		UpdateSyncTimestampsFunc: func(userID string, l, c *time.Time) error { return nil },
	}
	mockImport := &mocks.MockImportService{
		ParseAndAnalyzeFunc: func(filename, username, userID, pgnData string) (*models.AnalysisSummary, []models.GameAnalysis, error) {
			return &models.AnalysisSummary{GameCount: 2}, nil, nil
		},
	}
	mockChesscom := &mocks.MockChesscomService{
		FetchGamesFunc: func(username string, opts models.ChesscomImportOptions) (string, error) {
			return "pgn data", nil
		},
	}

	svc := NewSyncService(mockUserRepo, mockImport, &mocks.MockLichessService{}, mockChesscom)
	result, err := svc.Sync("user-1")

	require.NoError(t, err)
	assert.Equal(t, 0, result.LichessGamesImported)
	assert.Equal(t, 2, result.ChesscomGamesImported)
}

func TestSyncService_Sync_NeitherPlatform(t *testing.T) {
	user := &models.User{
		ID:              "user-1",
		LichessUsername:  nil,
		ChesscomUsername: nil,
	}

	mockUserRepo := &mocks.MockUserRepo{
		GetByIDFunc: func(id string) (*models.User, error) { return user, nil },
	}

	svc := NewSyncService(mockUserRepo, &mocks.MockImportService{}, &mocks.MockLichessService{}, &mocks.MockChesscomService{})
	result, err := svc.Sync("user-1")

	require.NoError(t, err)
	assert.Equal(t, 0, result.LichessGamesImported)
	assert.Equal(t, 0, result.ChesscomGamesImported)
}

func TestSyncService_Sync_LichessError_ChesscomStillRuns(t *testing.T) {
	lichessUser := "lichessplayer"
	chesscomUser := "chesscomuser"
	user := &models.User{
		ID:              "user-1",
		LichessUsername:  &lichessUser,
		ChesscomUsername: &chesscomUser,
	}

	mockUserRepo := &mocks.MockUserRepo{
		GetByIDFunc: func(id string) (*models.User, error) { return user, nil },
		UpdateSyncTimestampsFunc: func(userID string, l, c *time.Time) error { return nil },
	}
	mockLichess := &mocks.MockLichessService{
		FetchGamesFunc: func(username string, opts models.LichessImportOptions) (string, error) {
			return "", fmt.Errorf("lichess API error")
		},
	}
	mockChesscom := &mocks.MockChesscomService{
		FetchGamesFunc: func(username string, opts models.ChesscomImportOptions) (string, error) {
			return "pgn data", nil
		},
	}
	mockImport := &mocks.MockImportService{
		ParseAndAnalyzeFunc: func(filename, username, userID, pgnData string) (*models.AnalysisSummary, []models.GameAnalysis, error) {
			return &models.AnalysisSummary{GameCount: 1}, nil, nil
		},
	}

	svc := NewSyncService(mockUserRepo, mockImport, mockLichess, mockChesscom)
	result, err := svc.Sync("user-1")

	require.NoError(t, err)
	assert.NotEmpty(t, result.LichessError)
	assert.Equal(t, 1, result.ChesscomGamesImported)
}

func TestSyncService_Sync_UserNotFound(t *testing.T) {
	mockUserRepo := &mocks.MockUserRepo{
		GetByIDFunc: func(id string) (*models.User, error) {
			return nil, fmt.Errorf("user not found")
		},
	}

	svc := NewSyncService(mockUserRepo, &mocks.MockImportService{}, &mocks.MockLichessService{}, &mocks.MockChesscomService{})
	_, err := svc.Sync("nonexistent")

	assert.Error(t, err)
	assert.Contains(t, err.Error(), "failed to get user")
}

func TestSyncService_ComputeSince_WithLastSync(t *testing.T) {
	svc := &SyncService{}
	lastSync := time.Date(2024, 6, 15, 10, 0, 0, 0, time.UTC)
	now := time.Now()

	since := svc.computeSince(&lastSync, now)

	assert.Equal(t, lastSync.UnixMilli(), since)
}

func TestSyncService_ComputeSince_WithoutLastSync(t *testing.T) {
	svc := &SyncService{}
	now := time.Date(2024, 6, 15, 10, 0, 0, 0, time.UTC)

	since := svc.computeSince(nil, now)

	expected := now.AddDate(0, 0, -syncFirstSyncLookbackDays).UnixMilli()
	assert.Equal(t, expected, since)
}

func TestSyncService_FirstSync_Uses50Games(t *testing.T) {
	lichessUser := "lichessplayer"
	chesscomUser := "chesscomuser"
	user := &models.User{
		ID:               "user-1",
		LichessUsername:   &lichessUser,
		ChesscomUsername:  &chesscomUser,
		LastLichessSyncAt: nil,
		LastChesscomSyncAt: nil,
	}

	var capturedLichessMax int
	var capturedChesscomMax int

	mockUserRepo := &mocks.MockUserRepo{
		GetByIDFunc: func(id string) (*models.User, error) { return user, nil },
		UpdateSyncTimestampsFunc: func(userID string, l, c *time.Time) error { return nil },
	}
	mockLichess := &mocks.MockLichessService{
		FetchGamesFunc: func(username string, opts models.LichessImportOptions) (string, error) {
			capturedLichessMax = opts.Max
			return "[Event \"Test\"]\n\n1. e4 e5 1-0\n", nil
		},
	}
	mockChesscom := &mocks.MockChesscomService{
		FetchGamesFunc: func(username string, opts models.ChesscomImportOptions) (string, error) {
			capturedChesscomMax = opts.Max
			return "[Event \"Test\"]\n\n1. d4 d5 0-1\n", nil
		},
	}
	mockImport := &mocks.MockImportService{
		ParseAndAnalyzeFunc: func(filename, username, userID, pgnData string) (*models.AnalysisSummary, []models.GameAnalysis, error) {
			return &models.AnalysisSummary{GameCount: 1}, nil, nil
		},
	}

	svc := NewSyncService(mockUserRepo, mockImport, mockLichess, mockChesscom)
	_, err := svc.Sync("user-1")

	require.NoError(t, err)
	assert.Equal(t, 50, capturedLichessMax, "first Lichess sync should request 50 games")
	assert.Equal(t, 50, capturedChesscomMax, "first Chess.com sync should request 50 games")
}

func TestSyncService_SubsequentSync_Uses10Games(t *testing.T) {
	lichessUser := "lichessplayer"
	chesscomUser := "chesscomuser"
	lastSync := time.Date(2024, 6, 15, 10, 0, 0, 0, time.UTC)
	user := &models.User{
		ID:                 "user-1",
		LichessUsername:    &lichessUser,
		ChesscomUsername:   &chesscomUser,
		LastLichessSyncAt:  &lastSync,
		LastChesscomSyncAt: &lastSync,
	}

	var capturedLichessMax int
	var capturedChesscomMax int

	mockUserRepo := &mocks.MockUserRepo{
		GetByIDFunc: func(id string) (*models.User, error) { return user, nil },
		UpdateSyncTimestampsFunc: func(userID string, l, c *time.Time) error { return nil },
	}
	mockLichess := &mocks.MockLichessService{
		FetchGamesFunc: func(username string, opts models.LichessImportOptions) (string, error) {
			capturedLichessMax = opts.Max
			return "[Event \"Test\"]\n\n1. e4 e5 1-0\n", nil
		},
	}
	mockChesscom := &mocks.MockChesscomService{
		FetchGamesFunc: func(username string, opts models.ChesscomImportOptions) (string, error) {
			capturedChesscomMax = opts.Max
			return "[Event \"Test\"]\n\n1. d4 d5 0-1\n", nil
		},
	}
	mockImport := &mocks.MockImportService{
		ParseAndAnalyzeFunc: func(filename, username, userID, pgnData string) (*models.AnalysisSummary, []models.GameAnalysis, error) {
			return &models.AnalysisSummary{GameCount: 1}, nil, nil
		},
	}

	svc := NewSyncService(mockUserRepo, mockImport, mockLichess, mockChesscom)
	_, err := svc.Sync("user-1")

	require.NoError(t, err)
	assert.Equal(t, 10, capturedLichessMax, "subsequent Lichess sync should request 10 games")
	assert.Equal(t, 10, capturedChesscomMax, "subsequent Chess.com sync should request 10 games")
}

func TestSyncService_Sync_EmptyUsername(t *testing.T) {
	emptyLichess := ""
	emptyChesscom := ""
	user := &models.User{
		ID:              "user-1",
		LichessUsername:  &emptyLichess,
		ChesscomUsername: &emptyChesscom,
	}

	mockUserRepo := &mocks.MockUserRepo{
		GetByIDFunc: func(id string) (*models.User, error) { return user, nil },
	}

	svc := NewSyncService(mockUserRepo, &mocks.MockImportService{}, &mocks.MockLichessService{}, &mocks.MockChesscomService{})
	result, err := svc.Sync("user-1")

	require.NoError(t, err)
	assert.Equal(t, 0, result.LichessGamesImported)
	assert.Equal(t, 0, result.ChesscomGamesImported)
}
