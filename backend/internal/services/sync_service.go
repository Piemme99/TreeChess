package services

import (
	"fmt"
	"log/slog"
	"strings"
	"sync"
	"time"

	"github.com/kumquat/backend/config"
	"github.com/kumquat/backend/internal/models"
	"github.com/kumquat/backend/internal/repository"
)

var (
	ErrSyncCooldown = fmt.Errorf("sync requested too soon, please wait %v between syncs", config.SyncCooldown)
	// ErrSyncInProgress is returned when a sync is already running for the user.
	// It closes the cooldown TOCTOU window: the cooldown is only read-then-written
	// around fetch+analyze, so concurrent requests (double-click, two tabs) could
	// otherwise both pass the gate and both hit the upstream API.
	ErrSyncInProgress = fmt.Errorf("a sync is already in progress for this user")
)

const (
	syncLookbackDays          = 10
	syncFirstSyncLookbackDays = 90
	syncMaxGames              = 10
	syncFirstSyncMaxGames     = 100
)

type SyncService struct {
	userRepo        repository.UserRepository
	importService   GameImporter
	lichessService  LichessGameFetcher
	chesscomService ChesscomGameFetcher

	// locks holds a per-user mutex (keyed by userID) guarding the whole sync.
	// We TryLock so a concurrent request fails fast with ErrSyncInProgress
	// rather than queuing behind a long-running upstream fetch. In-process is
	// sufficient because the backend runs as a single replica.
	locks sync.Map // map[string]*sync.Mutex

	// sleep is the wait primitive used by the Lichess retry loop (injectable
	// for tests).
	sleep func(time.Duration)
}

func NewSyncService(userRepo repository.UserRepository, importSvc GameImporter, lichessSvc LichessGameFetcher, chesscomSvc ChesscomGameFetcher) *SyncService {
	return &SyncService{
		userRepo:        userRepo,
		importService:   importSvc,
		lichessService:  lichessSvc,
		chesscomService: chesscomSvc,
		sleep:           time.Sleep,
	}
}

// userLock returns the per-user mutex, creating it on first use.
func (s *SyncService) userLock(userID string) *sync.Mutex {
	mu, _ := s.locks.LoadOrStore(userID, &sync.Mutex{})
	return mu.(*sync.Mutex)
}

func (s *SyncService) Sync(userID string) (*models.SyncResult, error) {
	// Acquire the per-user lock up front so the cooldown read-then-write window
	// is serialized. TryLock makes a concurrent request fail fast rather than
	// queuing behind an in-flight upstream fetch.
	mu := s.userLock(userID)
	if !mu.TryLock() {
		return nil, ErrSyncInProgress
	}
	defer mu.Unlock()

	user, err := s.userRepo.GetByID(userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get user: %w", err)
	}

	// Enforce sync cooldown — reject if last sync was too recent
	now := time.Now()
	if mostRecent := mostRecentSync(user); mostRecent != nil {
		if now.Sub(*mostRecent) < config.SyncCooldown {
			return nil, ErrSyncCooldown
		}
	}

	result := &models.SyncResult{}

	if user.LichessUsername != nil && *user.LichessUsername != "" {
		imported, err := s.syncLichess(user, now)
		if err != nil {
			slog.Error("lichess sync failed", "user_id", userID, "error", err)
			result.LichessError = err.Error()
		} else {
			result.LichessGamesImported = imported
			if err := s.userRepo.UpdateSyncTimestamps(userID, &now, nil); err != nil {
				slog.Error("failed to update lichess sync timestamp", "user_id", userID, "error", err)
			}
		}
	}

	if user.ChesscomUsername != nil && *user.ChesscomUsername != "" {
		imported, err := s.syncChesscom(user, now)
		if err != nil {
			slog.Error("chess.com sync failed", "user_id", userID, "error", err)
			result.ChesscomError = err.Error()
		} else {
			result.ChesscomGamesImported = imported
			if err := s.userRepo.UpdateSyncTimestamps(userID, nil, &now); err != nil {
				slog.Error("failed to update chess.com sync timestamp", "user_id", userID, "error", err)
			}
		}
	}

	return result, nil
}

func (s *SyncService) syncLichess(user *models.User, now time.Time) (int, error) {
	since := s.computeSince(user.LastLichessSyncAt, now)

	max := syncMaxGames
	if user.LastLichessSyncAt == nil {
		max = syncFirstSyncMaxGames
	}

	perfType := strings.Join(user.TimeFormatPrefs, ",")
	if perfType == "" {
		perfType = "bullet,blitz,rapid"
	}

	options := models.LichessImportOptions{
		Max:      max,
		Since:    since,
		PerfType: perfType,
	}

	sleep := s.sleep
	if sleep == nil {
		sleep = time.Sleep
	}
	// A transient 429/5xx should not abort the whole sync; retry with bounded
	// jittered backoff, honoring Retry-After on 429.
	pgnData, err := retryWithBackoff(defaultSyncRetry, sleep,
		func() (string, error) { return s.lichessService.FetchGames(*user.LichessUsername, options) },
		isRetryableSyncError,
	)
	if err != nil {
		return 0, fmt.Errorf("failed to fetch Lichess games: %w", err)
	}

	filename := fmt.Sprintf("sync_lichess_%s.pgn", *user.LichessUsername)
	summary, _, err := s.importService.ParseAndAnalyze(filename, *user.LichessUsername, user.ID, pgnData)
	if err != nil {
		return 0, fmt.Errorf("failed to analyze Lichess games: %w", err)
	}

	return summary.GameCount, nil
}

func (s *SyncService) syncChesscom(user *models.User, now time.Time) (int, error) {
	since := s.computeSince(user.LastChesscomSyncAt, now)

	max := syncMaxGames
	if user.LastChesscomSyncAt == nil {
		max = syncFirstSyncMaxGames
	}

	timeClasses := user.TimeFormatPrefs
	if len(timeClasses) == 0 {
		timeClasses = []string{"bullet", "blitz", "rapid"}
	}

	var allPgnData strings.Builder
	for _, tc := range timeClasses {
		options := models.ChesscomImportOptions{
			Max:       max,
			Since:     since,
			TimeClass: tc,
		}

		pgnData, err := s.chesscomService.FetchGames(*user.ChesscomUsername, options)
		if err != nil {
			slog.Warn("chess.com sync error for time class", "time_class", tc, "error", err)
			continue
		}
		allPgnData.WriteString(pgnData)
	}

	if allPgnData.Len() == 0 {
		return 0, nil
	}

	filename := fmt.Sprintf("sync_chesscom_%s.pgn", *user.ChesscomUsername)
	summary, _, err := s.importService.ParseAndAnalyze(filename, *user.ChesscomUsername, user.ID, allPgnData.String())
	if err != nil {
		return 0, fmt.Errorf("failed to analyze Chess.com games: %w", err)
	}

	return summary.GameCount, nil
}

// mostRecentSync returns the most recent sync timestamp across all platforms, or nil if never synced.
func mostRecentSync(user *models.User) *time.Time {
	var latest *time.Time
	if user.LastLichessSyncAt != nil {
		latest = user.LastLichessSyncAt
	}
	if user.LastChesscomSyncAt != nil && (latest == nil || user.LastChesscomSyncAt.After(*latest)) {
		latest = user.LastChesscomSyncAt
	}
	return latest
}

func (s *SyncService) computeSince(lastSync *time.Time, now time.Time) int64 {
	if lastSync != nil {
		return lastSync.UnixMilli()
	}
	return now.AddDate(0, 0, -syncFirstSyncLookbackDays).UnixMilli()
}
