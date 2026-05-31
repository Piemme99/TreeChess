package services

import (
	"fmt"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/kumquat/backend/internal/models"
	"github.com/kumquat/backend/internal/repository/mocks"
	smocks "github.com/kumquat/backend/internal/services/mocks"
)

func TestSyncService_Sync_BothPlatforms(t *testing.T) {
	lichessUser := "lichessplayer"
	chesscomUser := "chesscomuser"
	user := &models.User{
		ID:               "user-1",
		LichessUsername:  &lichessUser,
		ChesscomUsername: &chesscomUser,
	}

	mockUserRepo := &mocks.MockUserRepo{
		GetByIDFunc:              func(id string) (*models.User, error) { return user, nil },
		UpdateSyncTimestampsFunc: func(userID string, l, c *time.Time) error { return nil },
	}
	mockLichess := &smocks.MockLichessService{
		FetchGamesFunc: func(username string, opts models.LichessImportOptions) (string, error) {
			return "[Event \"Test\"]\n\n1. e4 e5 1-0\n", nil
		},
	}
	mockChesscom := &smocks.MockChesscomService{
		FetchGamesFunc: func(username string, opts models.ChesscomImportOptions) (string, error) {
			return "[Event \"Test\"]\n\n1. d4 d5 0-1\n", nil
		},
	}
	mockImport := &smocks.MockImportService{
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
		ID:               "user-1",
		LichessUsername:  &lichessUser,
		ChesscomUsername: nil,
	}

	mockUserRepo := &mocks.MockUserRepo{
		GetByIDFunc:              func(id string) (*models.User, error) { return user, nil },
		UpdateSyncTimestampsFunc: func(userID string, l, c *time.Time) error { return nil },
	}
	mockImport := &smocks.MockImportService{
		ParseAndAnalyzeFunc: func(filename, username, userID, pgnData string) (*models.AnalysisSummary, []models.GameAnalysis, error) {
			return &models.AnalysisSummary{GameCount: 3}, nil, nil
		},
	}
	mockLichess := &smocks.MockLichessService{
		FetchGamesFunc: func(username string, opts models.LichessImportOptions) (string, error) {
			return "pgn data", nil
		},
	}

	svc := NewSyncService(mockUserRepo, mockImport, mockLichess, &smocks.MockChesscomService{})
	result, err := svc.Sync("user-1")

	require.NoError(t, err)
	assert.Equal(t, 3, result.LichessGamesImported)
	assert.Equal(t, 0, result.ChesscomGamesImported)
}

// TestSyncService_Sync_ConcurrentRequests_OnlyOneHitsUpstream covers the
// acceptance criterion: concurrent sync requests for one user must not both
// reach the upstream API. One request wins the per-user lock; the other fails
// fast with ErrSyncInProgress.
func TestSyncService_Sync_ConcurrentRequests_OnlyOneHitsUpstream(t *testing.T) {
	lichessUser := "lichessplayer"
	user := &models.User{
		ID:              "user-1",
		LichessUsername: &lichessUser,
	}

	mockUserRepo := &mocks.MockUserRepo{
		GetByIDFunc:              func(id string) (*models.User, error) { return user, nil },
		UpdateSyncTimestampsFunc: func(userID string, l, c *time.Time) error { return nil },
	}

	var upstreamCalls int32
	release := make(chan struct{})
	entered := make(chan struct{}, 1)
	mockLichess := &smocks.MockLichessService{
		FetchGamesFunc: func(username string, opts models.LichessImportOptions) (string, error) {
			atomic.AddInt32(&upstreamCalls, 1)
			// Signal that we're inside the critical section, then block so the
			// second request races the lock while this one is still in flight.
			select {
			case entered <- struct{}{}:
			default:
			}
			<-release
			return "[Event \"Test\"]\n\n1. e4 e5 1-0\n", nil
		},
	}
	mockImport := &smocks.MockImportService{
		ParseAndAnalyzeFunc: func(filename, username, userID, pgnData string) (*models.AnalysisSummary, []models.GameAnalysis, error) {
			return &models.AnalysisSummary{GameCount: 1}, nil, nil
		},
	}

	svc := NewSyncService(mockUserRepo, mockImport, mockLichess, &smocks.MockChesscomService{})

	firstErr := make(chan error, 1)
	secondErr := make(chan error, 1)

	go func() {
		_, err := svc.Sync("user-1")
		firstErr <- err
	}()

	// Wait until the first sync is inside the upstream call, then launch the
	// second so it contends for the lock.
	<-entered

	go func() {
		_, err := svc.Sync("user-1")
		secondErr <- err
	}()

	// The second request must fail fast (no upstream call) while the first is
	// still blocked inside FetchGames.
	err2 := <-secondErr
	require.ErrorIs(t, err2, ErrSyncInProgress, "second concurrent sync should be rejected as in-progress")

	// Now release the first sync and confirm it succeeded.
	close(release)
	err1 := <-firstErr
	require.NoError(t, err1, "first sync should succeed")

	// Exactly one request should have reached the upstream.
	assert.Equal(t, int32(1), atomic.LoadInt32(&upstreamCalls), "only one request may hit the upstream")
}

func TestSyncService_Sync_Lichess429_RetriedWithBackoff(t *testing.T) {
	lichessUser := "lichessplayer"
	user := &models.User{
		ID:              "user-1",
		LichessUsername: &lichessUser,
	}

	mockUserRepo := &mocks.MockUserRepo{
		GetByIDFunc:              func(id string) (*models.User, error) { return user, nil },
		UpdateSyncTimestampsFunc: func(userID string, l, c *time.Time) error { return nil },
	}

	var attempts int
	mockLichess := &smocks.MockLichessService{
		FetchGamesFunc: func(username string, opts models.LichessImportOptions) (string, error) {
			attempts++
			if attempts == 1 {
				return "", &RateLimitedError{RetryAfterSeconds: 1, wrapped: ErrLichessRateLimited}
			}
			return "[Event \"Test\"]\n\n1. e4 e5 1-0\n", nil
		},
	}
	mockImport := &smocks.MockImportService{
		ParseAndAnalyzeFunc: func(filename, username, userID, pgnData string) (*models.AnalysisSummary, []models.GameAnalysis, error) {
			return &models.AnalysisSummary{GameCount: 1}, nil, nil
		},
	}

	svc := NewSyncService(mockUserRepo, mockImport, mockLichess, &smocks.MockChesscomService{})
	var slept time.Duration
	svc.sleep = func(d time.Duration) { slept += d }

	result, err := svc.Sync("user-1")

	require.NoError(t, err)
	assert.Equal(t, 1, result.LichessGamesImported)
	assert.Equal(t, 2, attempts, "the transient 429 should be retried")
	assert.Greater(t, slept, time.Duration(0), "retry should honor a backoff/Retry-After delay")
}

func TestSyncService_Sync_CooldownEnforced(t *testing.T) {
	lichessUser := "lichessplayer"
	recentSync := time.Now().Add(-1 * time.Minute) // synced 1 minute ago
	user := &models.User{
		ID:                "user-1",
		LichessUsername:   &lichessUser,
		LastLichessSyncAt: &recentSync,
	}

	mockUserRepo := &mocks.MockUserRepo{
		GetByIDFunc: func(id string) (*models.User, error) { return user, nil },
	}

	svc := NewSyncService(mockUserRepo, &smocks.MockImportService{}, &smocks.MockLichessService{}, &smocks.MockChesscomService{})
	_, err := svc.Sync("user-1")

	assert.Error(t, err)
	assert.ErrorIs(t, err, ErrSyncCooldown)
}

func TestSyncService_Sync_CooldownExpired_Allowed(t *testing.T) {
	lichessUser := "lichessplayer"
	oldSync := time.Now().Add(-10 * time.Minute) // synced 10 minutes ago
	user := &models.User{
		ID:                "user-1",
		LichessUsername:   &lichessUser,
		LastLichessSyncAt: &oldSync,
	}

	mockUserRepo := &mocks.MockUserRepo{
		GetByIDFunc:              func(id string) (*models.User, error) { return user, nil },
		UpdateSyncTimestampsFunc: func(userID string, l, c *time.Time) error { return nil },
	}
	mockLichess := &smocks.MockLichessService{
		FetchGamesFunc: func(username string, opts models.LichessImportOptions) (string, error) {
			return "[Event \"Test\"]\n\n1. e4 e5 1-0\n", nil
		},
	}
	mockImport := &smocks.MockImportService{
		ParseAndAnalyzeFunc: func(filename, username, userID, pgnData string) (*models.AnalysisSummary, []models.GameAnalysis, error) {
			return &models.AnalysisSummary{GameCount: 1}, nil, nil
		},
	}

	svc := NewSyncService(mockUserRepo, mockImport, mockLichess, &smocks.MockChesscomService{})
	result, err := svc.Sync("user-1")

	require.NoError(t, err)
	assert.Equal(t, 1, result.LichessGamesImported)
}

func TestMostRecentSync(t *testing.T) {
	t.Run("nil when never synced", func(t *testing.T) {
		user := &models.User{}
		assert.Nil(t, mostRecentSync(user))
	})

	t.Run("returns lichess when only lichess synced", func(t *testing.T) {
		ts := time.Date(2024, 6, 15, 10, 0, 0, 0, time.UTC)
		user := &models.User{LastLichessSyncAt: &ts}
		result := mostRecentSync(user)
		require.NotNil(t, result)
		assert.Equal(t, ts, *result)
	})

	t.Run("returns most recent of both", func(t *testing.T) {
		older := time.Date(2024, 6, 15, 10, 0, 0, 0, time.UTC)
		newer := time.Date(2024, 6, 16, 10, 0, 0, 0, time.UTC)
		user := &models.User{LastLichessSyncAt: &older, LastChesscomSyncAt: &newer}
		result := mostRecentSync(user)
		require.NotNil(t, result)
		assert.Equal(t, newer, *result)
	})
}

func TestSyncService_Sync_ChesscomOnly(t *testing.T) {
	chesscomUser := "chesscomuser"
	user := &models.User{
		ID:               "user-1",
		LichessUsername:  nil,
		ChesscomUsername: &chesscomUser,
	}

	mockUserRepo := &mocks.MockUserRepo{
		GetByIDFunc:              func(id string) (*models.User, error) { return user, nil },
		UpdateSyncTimestampsFunc: func(userID string, l, c *time.Time) error { return nil },
	}
	mockImport := &smocks.MockImportService{
		ParseAndAnalyzeFunc: func(filename, username, userID, pgnData string) (*models.AnalysisSummary, []models.GameAnalysis, error) {
			return &models.AnalysisSummary{GameCount: 2}, nil, nil
		},
	}
	mockChesscom := &smocks.MockChesscomService{
		FetchGamesFunc: func(username string, opts models.ChesscomImportOptions) (string, error) {
			return "pgn data", nil
		},
	}

	svc := NewSyncService(mockUserRepo, mockImport, &smocks.MockLichessService{}, mockChesscom)
	result, err := svc.Sync("user-1")

	require.NoError(t, err)
	assert.Equal(t, 0, result.LichessGamesImported)
	assert.Equal(t, 2, result.ChesscomGamesImported)
}

func TestSyncService_Sync_NeitherPlatform(t *testing.T) {
	user := &models.User{
		ID:               "user-1",
		LichessUsername:  nil,
		ChesscomUsername: nil,
	}

	mockUserRepo := &mocks.MockUserRepo{
		GetByIDFunc: func(id string) (*models.User, error) { return user, nil },
	}

	svc := NewSyncService(mockUserRepo, &smocks.MockImportService{}, &smocks.MockLichessService{}, &smocks.MockChesscomService{})
	result, err := svc.Sync("user-1")

	require.NoError(t, err)
	assert.Equal(t, 0, result.LichessGamesImported)
	assert.Equal(t, 0, result.ChesscomGamesImported)
}

func TestSyncService_Sync_LichessError_ChesscomStillRuns(t *testing.T) {
	lichessUser := "lichessplayer"
	chesscomUser := "chesscomuser"
	user := &models.User{
		ID:               "user-1",
		LichessUsername:  &lichessUser,
		ChesscomUsername: &chesscomUser,
	}

	mockUserRepo := &mocks.MockUserRepo{
		GetByIDFunc:              func(id string) (*models.User, error) { return user, nil },
		UpdateSyncTimestampsFunc: func(userID string, l, c *time.Time) error { return nil },
	}
	mockLichess := &smocks.MockLichessService{
		FetchGamesFunc: func(username string, opts models.LichessImportOptions) (string, error) {
			return "", fmt.Errorf("lichess API error")
		},
	}
	mockChesscom := &smocks.MockChesscomService{
		FetchGamesFunc: func(username string, opts models.ChesscomImportOptions) (string, error) {
			return "pgn data", nil
		},
	}
	mockImport := &smocks.MockImportService{
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

	svc := NewSyncService(mockUserRepo, &smocks.MockImportService{}, &smocks.MockLichessService{}, &smocks.MockChesscomService{})
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

func TestSyncService_FirstSync_Uses100Games(t *testing.T) {
	lichessUser := "lichessplayer"
	chesscomUser := "chesscomuser"
	user := &models.User{
		ID:                 "user-1",
		LichessUsername:    &lichessUser,
		ChesscomUsername:   &chesscomUser,
		LastLichessSyncAt:  nil,
		LastChesscomSyncAt: nil,
	}

	var capturedLichessMax int
	var capturedChesscomMax int

	mockUserRepo := &mocks.MockUserRepo{
		GetByIDFunc:              func(id string) (*models.User, error) { return user, nil },
		UpdateSyncTimestampsFunc: func(userID string, l, c *time.Time) error { return nil },
	}
	mockLichess := &smocks.MockLichessService{
		FetchGamesFunc: func(username string, opts models.LichessImportOptions) (string, error) {
			capturedLichessMax = opts.Max
			return "[Event \"Test\"]\n\n1. e4 e5 1-0\n", nil
		},
	}
	mockChesscom := &smocks.MockChesscomService{
		FetchGamesFunc: func(username string, opts models.ChesscomImportOptions) (string, error) {
			capturedChesscomMax = opts.Max
			return "[Event \"Test\"]\n\n1. d4 d5 0-1\n", nil
		},
	}
	mockImport := &smocks.MockImportService{
		ParseAndAnalyzeFunc: func(filename, username, userID, pgnData string) (*models.AnalysisSummary, []models.GameAnalysis, error) {
			return &models.AnalysisSummary{GameCount: 1}, nil, nil
		},
	}

	svc := NewSyncService(mockUserRepo, mockImport, mockLichess, mockChesscom)
	_, err := svc.Sync("user-1")

	require.NoError(t, err)
	assert.Equal(t, 100, capturedLichessMax, "first Lichess sync should request 100 games")
	assert.Equal(t, 100, capturedChesscomMax, "first Chess.com sync should request 100 games")
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
		GetByIDFunc:              func(id string) (*models.User, error) { return user, nil },
		UpdateSyncTimestampsFunc: func(userID string, l, c *time.Time) error { return nil },
	}
	mockLichess := &smocks.MockLichessService{
		FetchGamesFunc: func(username string, opts models.LichessImportOptions) (string, error) {
			capturedLichessMax = opts.Max
			return "[Event \"Test\"]\n\n1. e4 e5 1-0\n", nil
		},
	}
	mockChesscom := &smocks.MockChesscomService{
		FetchGamesFunc: func(username string, opts models.ChesscomImportOptions) (string, error) {
			capturedChesscomMax = opts.Max
			return "[Event \"Test\"]\n\n1. d4 d5 0-1\n", nil
		},
	}
	mockImport := &smocks.MockImportService{
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
		ID:               "user-1",
		LichessUsername:  &emptyLichess,
		ChesscomUsername: &emptyChesscom,
	}

	mockUserRepo := &mocks.MockUserRepo{
		GetByIDFunc: func(id string) (*models.User, error) { return user, nil },
	}

	svc := NewSyncService(mockUserRepo, &smocks.MockImportService{}, &smocks.MockLichessService{}, &smocks.MockChesscomService{})
	result, err := svc.Sync("user-1")

	require.NoError(t, err)
	assert.Equal(t, 0, result.LichessGamesImported)
	assert.Equal(t, 0, result.ChesscomGamesImported)
}
