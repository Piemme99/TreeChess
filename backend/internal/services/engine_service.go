package services

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"sync"
	"time"

	"github.com/treechess/backend/internal/models"
	"github.com/treechess/backend/internal/repository"
)

const (
	maxPlies         = 20 // Evaluate first 10 moves (20 plies)
	pollInterval     = 5 * time.Second
	explorerBaseURL  = "https://explorer.lichess.ovh/lichess"
	explorerSpeeds   = "blitz,rapid,classical"
	explorerRatings  = "1600,1800,2000,2200,2500"
	minExplorerGames = 50  // minimum games for reliable stats
	apiDelay         = 200 * time.Millisecond
)

// explorerResponse represents the Lichess Explorer API response
type explorerResponse struct {
	White int             `json:"white"`
	Draws int             `json:"draws"`
	Black int             `json:"black"`
	Moves []explorerMove  `json:"moves"`
}

type explorerMove struct {
	UCI           string `json:"uci"`
	SAN           string `json:"san"`
	White         int    `json:"white"`
	Draws         int    `json:"draws"`
	Black         int    `json:"black"`
	AverageRating int    `json:"averageRating"`
}

// EngineService manages async opening analysis using the Lichess Explorer API
type EngineService struct {
	evalRepo     repository.EngineEvalRepository
	analysisRepo repository.AnalysisRepository
	httpClient   *http.Client
	cache        map[string]*explorerResponse
	cacheMu      sync.Mutex
}

// NewEngineService creates a new engine service
func NewEngineService(evalRepo repository.EngineEvalRepository, analysisRepo repository.AnalysisRepository) *EngineService {
	return &EngineService{
		evalRepo:     evalRepo,
		analysisRepo: analysisRepo,
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
		cache: make(map[string]*explorerResponse),
	}
}

// EnqueueAnalysis creates pending eval rows for all games in an analysis
func (s *EngineService) EnqueueAnalysis(userID, analysisID string, gameCount int) {
	if err := s.evalRepo.CreatePendingBatch(userID, analysisID, gameCount); err != nil {
		log.Printf("opening-analysis: failed to enqueue analysis %s: %v", analysisID, err)
	}
}

// RunWorker polls for pending evals and processes them via the Lichess Explorer API
func (s *EngineService) RunWorker(ctx context.Context) {
	log.Println("opening-analysis: worker started")
	ticker := time.NewTicker(pollInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			log.Println("opening-analysis: worker stopped")
			return
		case <-ticker.C:
			s.processPending()
		}
	}
}

func (s *EngineService) processPending() {
	pending, err := s.evalRepo.GetPending(5)
	if err != nil {
		log.Printf("opening-analysis: failed to get pending evals: %v", err)
		return
	}

	for _, eval := range pending {
		if err := s.evalRepo.MarkProcessing(eval.ID); err != nil {
			log.Printf("opening-analysis: failed to mark processing %s: %v", eval.ID, err)
			continue
		}

		stats, err := s.analyzeGameOpenings(eval.AnalysisID, eval.GameIndex)
		if err != nil {
			log.Printf("opening-analysis: failed to analyze game %s/%d: %v", eval.AnalysisID, eval.GameIndex, err)
			_ = s.evalRepo.MarkFailed(eval.ID)
			continue
		}

		if err := s.evalRepo.SaveEvals(eval.ID, stats); err != nil {
			log.Printf("opening-analysis: failed to save evals %s: %v", eval.ID, err)
			_ = s.evalRepo.MarkFailed(eval.ID)
			continue
		}
	}
}

func (s *EngineService) analyzeGameOpenings(analysisID string, gameIndex int) ([]models.ExplorerMoveStats, error) {
	detail, err := s.analysisRepo.GetByID(analysisID)
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
			log.Printf("opening-analysis: explorer error at ply %d: %v", i, err)
			continue
		}

		totalGames := resp.White + resp.Draws + resp.Black
		if totalGames < minExplorerGames {
			continue
		}

		// Find the played move and the best move
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
			// Move not in explorer — likely a rare/bad move, use 0 winrate
			// but only if we have a best move to compare against
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

func (s *EngineService) fetchExplorer(fen string) (*explorerResponse, error) {
	// Check cache first
	s.cacheMu.Lock()
	if cached, ok := s.cache[fen]; ok {
		s.cacheMu.Unlock()
		return cached, nil
	}
	s.cacheMu.Unlock()

	// Rate limit
	time.Sleep(apiDelay)

	u := fmt.Sprintf("%s?variant=standard&speeds=%s&ratings=%s&fen=%s",
		explorerBaseURL, explorerSpeeds, explorerRatings, url.QueryEscape(fen))

	resp, err := s.httpClient.Get(u)
	if err != nil {
		return nil, fmt.Errorf("explorer request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusTooManyRequests {
		// Back off and retry once
		time.Sleep(2 * time.Second)
		resp, err = s.httpClient.Get(u)
		if err != nil {
			return nil, fmt.Errorf("explorer retry failed: %w", err)
		}
		defer resp.Body.Close()
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("explorer returned status %d", resp.StatusCode)
	}

	var result explorerResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode explorer response: %w", err)
	}

	// Cache the result
	s.cacheMu.Lock()
	s.cache[fen] = &result
	s.cacheMu.Unlock()

	return &result, nil
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
