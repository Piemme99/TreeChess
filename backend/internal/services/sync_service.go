package services

import (
	"fmt"
	"log/slog"
	"strings"
	"time"

	"github.com/treechess/backend/internal/models"
	"github.com/treechess/backend/internal/repository"
)

const (
	syncLookbackDays           = 10
	syncFirstSyncLookbackDays  = 90
	syncMaxGames               = 10
	syncFirstSyncMaxGames      = 50
)

type SyncService struct {
	userRepo        repository.UserRepository
	importService   GameImporter
	lichessService  LichessGameFetcher
	chesscomService ChesscomGameFetcher
}

func NewSyncService(userRepo repository.UserRepository, importSvc GameImporter, lichessSvc LichessGameFetcher, chesscomSvc ChesscomGameFetcher) *SyncService {
	return &SyncService{
		userRepo:        userRepo,
		importService:   importSvc,
		lichessService:  lichessSvc,
		chesscomService: chesscomSvc,
	}
}

func (s *SyncService) Sync(userID string) (*models.SyncResult, error) {
	user, err := s.userRepo.GetByID(userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get user: %w", err)
	}

	result := &models.SyncResult{}
	now := time.Now()

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

	pgnData, err := s.lichessService.FetchGames(*user.LichessUsername, options)
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

func (s *SyncService) computeSince(lastSync *time.Time, now time.Time) int64 {
	if lastSync != nil {
		return lastSync.UnixMilli()
	}
	return now.AddDate(0, 0, -syncFirstSyncLookbackDays).UnixMilli()
}
