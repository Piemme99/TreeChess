package services

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"time"

	"github.com/kumquat/backend/internal/models"
	"github.com/kumquat/backend/internal/repository"
)

const (
	maxPlies         = 20 // Evaluate first 10 moves (20 plies)
	pollInterval     = 5 * time.Second
	minExplorerGames = 50 // minimum games for reliable stats
)

// explorerResponse is the shape of an Opening Explorer payload as cached.
// It is structurally compatible with services.OpeningStats (same JSON tags),
// so cached blobs written by the user-facing handler are readable here.
type explorerResponse struct {
	White int            `json:"white"`
	Draws int            `json:"draws"`
	Black int            `json:"black"`
	Moves []explorerMove `json:"moves"`
}

type explorerMove struct {
	UCI           string `json:"uci"`
	SAN           string `json:"san"`
	White         int    `json:"white"`
	Draws         int    `json:"draws"`
	Black         int    `json:"black"`
	AverageRating int    `json:"averageRating"`
}

// EngineService manages async opening analysis. It is cache-only: it never
// hits the Lichess Explorer API directly. Cache fills are produced by the
// user-facing TrainingExplorerHandler when authenticated users request a
// position; the worker piggybacks on those fills so we never burn rate-limit
// budget on background traffic.
type EngineService struct {
	evalRepo     repository.EngineEvalRepository
	analysisRepo repository.AnalysisRepository
	cacheRepo    repository.OpeningExplorerCacheRepository
}

// NewEngineService creates a new engine service. cacheRepo may be nil only in
// tests that do not exercise position lookups; production wiring must always
// pass a non-nil cache.
func NewEngineService(
	evalRepo repository.EngineEvalRepository,
	analysisRepo repository.AnalysisRepository,
	cacheRepo repository.OpeningExplorerCacheRepository,
) *EngineService {
	return &EngineService{
		evalRepo:     evalRepo,
		analysisRepo: analysisRepo,
		cacheRepo:    cacheRepo,
	}
}

// EnqueueAnalysis creates pending eval rows for all games in an analysis
func (s *EngineService) EnqueueAnalysis(userID, analysisID string, gameCount int) {
	if err := s.evalRepo.CreatePendingBatch(userID, analysisID, gameCount); err != nil {
		slog.Error("failed to enqueue analysis", "component", "opening-analysis", "analysis_id", analysisID, "error", err)
	}
}

// RunWorker polls for pending evals and processes them via the cache.
func (s *EngineService) RunWorker(ctx context.Context) {
	defer func() {
		if r := recover(); r != nil {
			slog.Error("opening-analysis worker panicked", "panic", r)
		}
	}()

	slog.Info("opening-analysis worker started")

	if count, err := s.evalRepo.ResetStaleProcessing(); err != nil {
		slog.Error("failed to reset stale processing evals", "component", "opening-analysis", "error", err)
	} else if count > 0 {
		slog.Info("reset stale processing evals back to pending", "component", "opening-analysis", "count", count)
	}

	ticker := time.NewTicker(pollInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			slog.Info("opening-analysis worker stopped")
			return
		case <-ticker.C:
			s.processPending()
		}
	}
}

func (s *EngineService) processPending() {
	pending, err := s.evalRepo.GetPending(5)
	if err != nil {
		slog.Error("failed to get pending evals", "component", "opening-analysis", "error", err)
		return
	}

	for _, eval := range pending {
		if err := s.evalRepo.MarkProcessing(eval.ID); err != nil {
			slog.Error("failed to mark processing", "component", "opening-analysis", "eval_id", eval.ID, "error", err)
			continue
		}

		stats, err := s.analyzeGameOpenings(eval.UserID, eval.AnalysisID, eval.GameIndex)
		if err != nil {
			slog.Error("failed to analyze game", "component", "opening-analysis", "analysis_id", eval.AnalysisID, "game_index", eval.GameIndex, "error", err)
			_ = s.evalRepo.MarkFailed(eval.ID)
			continue
		}

		if err := s.evalRepo.SaveEvals(eval.ID, stats); err != nil {
			slog.Error("failed to save evals", "component", "opening-analysis", "eval_id", eval.ID, "error", err)
			_ = s.evalRepo.MarkFailed(eval.ID)
			continue
		}
	}
}

func (s *EngineService) analyzeGameOpenings(userID, analysisID string, gameIndex int) ([]models.ExplorerMoveStats, error) {
	detail, err := s.analysisRepo.GetByID(analysisID, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get analysis: %w", err)
	}

	var game *models.GameAnalysis
	for i := range detail.Results {
		if detail.Results[i].GameIndex == gameIndex {
			game = &detail.Results[i]
			break
		}
	}
	if game == nil {
		return nil, fmt.Errorf("game %d not found in analysis %s", gameIndex, analysisID)
	}

	plyLimit := maxPlies
	if len(game.Moves) < plyLimit {
		plyLimit = len(game.Moves)
	}

	var stats []models.ExplorerMoveStats
	for i := 0; i < plyLimit; i++ {
		move := game.Moves[i]
		if !move.IsUserMove {
			continue
		}

		fen := ensureFullFEN(move.FEN)
		resp, err := s.fetchExplorer(fen)
		if err != nil {
			slog.Warn("explorer cache lookup error", "component", "opening-analysis", "ply", i, "error", err)
			continue
		}
		if resp == nil {
			// Cache miss: a user request will fill this position later, and the
			// next worker pass over the same eval row will pick it up.
			continue
		}

		totalGames := resp.White + resp.Draws + resp.Black
		if totalGames < minExplorerGames {
			continue
		}

		var playedMoveData *explorerMove
		var bestMove explorerMove
		bestWinrate := -1.0

		for j := range resp.Moves {
			m := &resp.Moves[j]
			total := m.White + m.Draws + m.Black
			if total == 0 {
				continue
			}

			wr := calcWinrate(m.White, m.Draws, m.Black, game.UserColor)
			if wr > bestWinrate {
				bestWinrate = wr
				bestMove = *m
			}
			if m.SAN == move.SAN {
				playedMoveData = m
			}
		}

		if playedMoveData == nil {
			if bestWinrate < 0 {
				continue
			}
			stats = append(stats, models.ExplorerMoveStats{
				PlyNumber:     move.PlyNumber,
				FEN:           move.FEN,
				PlayedMove:    move.SAN,
				PlayedWinrate: 0,
				BestMove:      bestMove.SAN,
				BestWinrate:   bestWinrate,
				WinrateDrop:   bestWinrate,
				TotalGames:    totalGames,
			})
			continue
		}

		playedWinrate := calcWinrate(playedMoveData.White, playedMoveData.Draws, playedMoveData.Black, game.UserColor)
		drop := bestWinrate - playedWinrate

		stats = append(stats, models.ExplorerMoveStats{
			PlyNumber:     move.PlyNumber,
			FEN:           move.FEN,
			PlayedMove:    move.SAN,
			PlayedWinrate: playedWinrate,
			BestMove:      bestMove.SAN,
			BestWinrate:   bestWinrate,
			WinrateDrop:   drop,
			TotalGames:    totalGames,
		})
	}

	return stats, nil
}

// calcWinrate computes expected score from the given color's perspective
func calcWinrate(white, draws, black int, userColor models.Color) float64 {
	total := white + draws + black
	if total == 0 {
		return 0
	}
	if userColor == models.ColorWhite {
		return (float64(white) + float64(draws)*0.5) / float64(total)
	}
	return (float64(black) + float64(draws)*0.5) / float64(total)
}

// fetchExplorer consults the shared opening-explorer cache. A cache miss
// returns (nil, nil): callers must skip the position rather than treat the
// miss as an error. The worker is intentionally cache-only — it never makes
// upstream HTTP requests, so it never burns the user's rate-limit budget.
func (s *EngineService) fetchExplorer(fen string) (*explorerResponse, error) {
	if s.cacheRepo == nil {
		return nil, nil
	}
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	key := CanonicalKey(DefaultOpeningQuery(fen))
	payload, found, err := s.cacheRepo.Get(ctx, key)
	if err != nil {
		return nil, err
	}
	if !found {
		return nil, nil
	}

	var resp explorerResponse
	if err := json.Unmarshal(payload, &resp); err != nil {
		return nil, fmt.Errorf("decode cached explorer payload: %w", err)
	}
	return &resp, nil
}

// EngineInsightsData holds opening analysis results with progress counters
type EngineInsightsData struct {
	Evals     []models.EngineEval
	AllDone   bool
	Total     int
	Completed int
}

// GetInsightsData returns opening evals and completion status for a user
func (s *EngineService) GetInsightsData(userID string) (*EngineInsightsData, error) {
	evals, err := s.evalRepo.GetByUser(userID)
	if err != nil {
		return nil, err
	}

	data := &EngineInsightsData{
		Evals: evals,
		Total: len(evals),
	}

	data.AllDone = true
	for _, e := range evals {
		if e.Status == "done" || e.Status == "failed" {
			data.Completed++
		} else {
			data.AllDone = false
		}
	}

	return data, nil
}
