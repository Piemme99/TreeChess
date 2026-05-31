package services

import (
	"context"
	"fmt"
	"sort"

	"github.com/kumquat/backend/internal/models"
	"github.com/kumquat/backend/internal/repertoiretree"
	"github.com/kumquat/backend/internal/repository"
)

// InsightsService computes the user's worst recurring opening mistakes from
// engine (Lichess Explorer) evaluations. It was carved out of ImportService so
// the Games-tab insights feature depends only on the engine evals, dismissed
// mistakes and saved analyses it actually needs.
type InsightsService struct {
	repertoireService    *RepertoireService
	analysisRepo         repository.AnalysisRepository
	engineService        *EngineService
	dismissedMistakeRepo repository.DismissedMistakeRepository
}

// NewInsightsService creates a new insights service.
func NewInsightsService(repertoireSvc *RepertoireService, analysisRepo repository.AnalysisRepository, opts ...InsightsServiceOption) *InsightsService {
	svc := &InsightsService{
		repertoireService: repertoireSvc,
		analysisRepo:      analysisRepo,
	}
	for _, opt := range opts {
		opt(svc)
	}
	return svc
}

// InsightsServiceOption is a functional option for InsightsService.
type InsightsServiceOption func(*InsightsService)

// WithInsightsEngineService sets the engine service on the InsightsService.
func WithInsightsEngineService(svc *EngineService) InsightsServiceOption {
	return func(s *InsightsService) {
		s.engineService = svc
	}
}

// WithInsightsDismissedMistakeRepo sets the dismissed mistake repository.
func WithInsightsDismissedMistakeRepo(repo repository.DismissedMistakeRepository) InsightsServiceOption {
	return func(s *InsightsService) {
		s.dismissedMistakeRepo = repo
	}
}

// DismissMistake marks a mistake as dismissed for a user.
func (s *InsightsService) DismissMistake(ctx context.Context, userID, fen, playedMove string) error {
	if s.dismissedMistakeRepo == nil {
		return fmt.Errorf("dismissed mistake repository not configured")
	}
	return s.dismissedMistakeRepo.Dismiss(ctx, userID, fen, playedMove)
}

// GetInsights computes worst opening mistakes using engine evaluations
func (s *InsightsService) GetInsights(ctx context.Context, userID string) (*models.InsightsResponse, error) {
	response := &models.InsightsResponse{
		WorstMistakes:      []models.OpeningMistake{},
		EngineAnalysisDone: true,
	}

	// If no engine service, return empty (graceful degradation)
	if s.engineService == nil {
		return response, nil
	}

	// Get dismissed mistakes to filter them out
	var dismissedMistakes map[string]bool
	if s.dismissedMistakeRepo != nil {
		var err error
		dismissedMistakes, err = s.dismissedMistakeRepo.GetDismissed(ctx, userID)
		if err != nil {
			return nil, fmt.Errorf("failed to get dismissed mistakes: %w", err)
		}
	}

	// Get repertoire moves to filter them out (moves in repertoire are intentional, not mistakes)
	repertoireMoves := make(map[string]bool)
	if s.repertoireService != nil {
		repertoires, err := s.repertoireService.ListRepertoires(ctx, userID, nil)
		if err != nil {
			return nil, fmt.Errorf("failed to get repertoires: %w", err)
		}
		for i := range repertoires {
			repertoiretree.CollectMoves(&repertoires[i].TreeData, repertoireMoves)
		}
	}

	// Get engine evals and raw game data
	insightsData, err := s.engineService.GetInsightsData(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get engine evals: %w", err)
	}
	response.EngineAnalysisDone = insightsData.AllDone
	response.EngineAnalysisTotal = insightsData.Total
	response.EngineAnalysisCompleted = insightsData.Completed
	engineEvals := insightsData.Evals

	analyses, err := s.analysisRepo.GetAllGamesRaw(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get analyses: %w", err)
	}

	// Build lookup: analysisID+gameIndex -> explorer stats
	type evalKey struct {
		AnalysisID string
		GameIndex  int
	}
	evalMap := make(map[evalKey][]models.ExplorerMoveStats)
	for _, ee := range engineEvals {
		if ee.Status == "done" && len(ee.Evals) > 0 {
			evalMap[evalKey{ee.AnalysisID, ee.GameIndex}] = ee.Evals
		}
	}

	// Group mistakes by FEN + played move
	type mistakeKey struct {
		FEN        string
		PlayedMove string
	}
	type mistakeData struct {
		bestMove    string
		winrateDrop float64
		earliestPly int
		games       []models.GameRef
		seen        map[string]bool
	}
	mistakeGroups := make(map[mistakeKey]*mistakeData)

	for _, a := range analyses {
		for _, game := range a.Results {
			stats := evalMap[evalKey{a.ID, game.GameIndex}]
			if len(stats) == 0 {
				continue
			}

			for _, stat := range stats {
				// Skip the very first move (ply 1-2) - opening choice, not a mistake
				if stat.PlyNumber <= 2 {
					continue
				}
				// Only count as mistake if winrate drop >= 2%
				if stat.WinrateDrop < 0.02 {
					continue
				}

				key := mistakeKey{FEN: stat.FEN, PlayedMove: stat.PlayedMove}
				dedup := fmt.Sprintf("%s-%d", a.ID, game.GameIndex)

				data, exists := mistakeGroups[key]
				if !exists {
					data = &mistakeData{
						bestMove:    stat.BestMove,
						winrateDrop: stat.WinrateDrop,
						earliestPly: stat.PlyNumber,
						seen:        make(map[string]bool),
					}
					mistakeGroups[key] = data
				}

				if !data.seen[dedup] {
					data.seen[dedup] = true
					if stat.WinrateDrop > data.winrateDrop {
						data.winrateDrop = stat.WinrateDrop
						data.bestMove = stat.BestMove
					}
					if len(data.games) < 5 {
						data.games = append(data.games, models.GameRef{
							AnalysisID: a.ID,
							GameIndex:  game.GameIndex,
							PlyNumber:  stat.PlyNumber,
							White:      game.Headers["White"],
							Black:      game.Headers["Black"],
							Result:     game.Headers["Result"],
							Date:       game.Headers["Date"],
						})
					}
				}
			}
		}
	}

	// Convert to slice, filter, and score: winrateDrop * frequency²
	// Only keep mistakes that appeared in at least 2 games (recurring patterns)
	for key, data := range mistakeGroups {
		// Skip dismissed mistakes and moves that exist in repertoires
		moveKey := key.FEN + "|" + key.PlayedMove
		if dismissedMistakes[moveKey] || repertoireMoves[moveKey] {
			continue
		}

		freq := len(data.seen)
		if freq < 2 {
			continue
		}
		score := data.winrateDrop * float64(freq) * float64(freq)
		response.WorstMistakes = append(response.WorstMistakes, models.OpeningMistake{
			FEN:         key.FEN,
			PlayedMove:  key.PlayedMove,
			BestMove:    data.bestMove,
			WinrateDrop: data.winrateDrop,
			Frequency:   freq,
			Score:       score,
			Games:       data.games,
		})
	}

	// Sort by score desc, take top 2
	sort.SliceStable(response.WorstMistakes, func(i, j int) bool {
		return response.WorstMistakes[i].Score > response.WorstMistakes[j].Score
	})
	if len(response.WorstMistakes) > 2 {
		response.WorstMistakes = response.WorstMistakes[:2]
	}

	return response, nil
}
