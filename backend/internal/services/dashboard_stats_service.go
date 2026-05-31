package services

import (
	"context"
	"fmt"
	"sort"

	"github.com/kumquat/backend/internal/models"
	"github.com/kumquat/backend/internal/repertoiretree"
	"github.com/kumquat/backend/internal/repository"
)

// DashboardStatsService computes aggregate and per-repertoire statistics for the
// dashboard (win rates, coverage, opponent gaps and branch performance). It was
// carved out of ImportService so the dashboard feature depends only on the saved
// analyses, repertoire trees and dismissed gaps it actually reads.
type DashboardStatsService struct {
	repertoireService *RepertoireService
	analysisRepo      repository.AnalysisRepository
	dismissedGapRepo  repository.DismissedGapRepository
}

// NewDashboardStatsService creates a new dashboard stats service.
func NewDashboardStatsService(repertoireSvc *RepertoireService, analysisRepo repository.AnalysisRepository, opts ...DashboardStatsServiceOption) *DashboardStatsService {
	svc := &DashboardStatsService{
		repertoireService: repertoireSvc,
		analysisRepo:      analysisRepo,
	}
	for _, opt := range opts {
		opt(svc)
	}
	return svc
}

// DashboardStatsServiceOption is a functional option for DashboardStatsService.
type DashboardStatsServiceOption func(*DashboardStatsService)

// WithDashboardDismissedGapRepo sets the dismissed gap repository.
func WithDashboardDismissedGapRepo(repo repository.DismissedGapRepository) DashboardStatsServiceOption {
	return func(s *DashboardStatsService) {
		s.dismissedGapRepo = repo
	}
}

// DismissGap marks an opponent gap as dismissed for a user.
func (s *DashboardStatsService) DismissGap(ctx context.Context, userID, fen, opponentMove, repertoireID string) error {
	if s.dismissedGapRepo == nil {
		return fmt.Errorf("dismissed gap repository not configured")
	}
	return s.dismissedGapRepo.Dismiss(ctx, userID, fen, opponentMove, repertoireID)
}

// GetDashboardStats computes aggregate and per-repertoire stats for the dashboard.
func (s *DashboardStatsService) GetDashboardStats(ctx context.Context, userID string) (*models.DashboardStatsResponse, error) {
	analyses, err := s.analysisRepo.GetAllGamesRaw(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get analyses: %w", err)
	}

	resp := &models.DashboardStatsResponse{
		Repertoires:  []models.RepertoireStats{},
		OpponentGaps: []models.OpponentGap{},
		BranchStats:  []models.BranchStats{},
	}

	// Per-repertoire accumulators
	type repAccum struct {
		name        string
		color       models.Color
		gameCount   int
		wins        int
		inRepCount  int
		inRepWins   int
		outRepCount int
		outRepWins  int
	}
	repMap := make(map[string]*repAccum)

	// Opponent gap accumulator: keyed by "FEN|SAN|repertoireID"
	type gapAccum struct {
		fen            string
		opponentMove   string
		repertoireID   string
		repertoireName string
		color          models.Color
		moveNumber     int
		contextMove    string // last in-rep move before the gap
		wins           int
		losses         int
		draws          int
	}
	gapMap := make(map[string]*gapAccum)

	// Branch stats accumulator: keyed by "branchName|repertoireID"
	type branchAccum struct {
		branchName     string
		repertoireID   string
		repertoireName string
		color          models.Color
		gameCount      int
		wins           int
		losses         int
		draws          int
		errorCount     int
	}
	branchMap := make(map[string]*branchAccum)

	// Cache loaded repertoire trees for branch lookups
	repTreeCache := make(map[string]*models.RepertoireNode)

	// Global win counts split by in/out of repertoire, accumulated during the single
	// pass below and reused for the overall win-rate computation. This avoids the two
	// extra full re-scans of every game that the rates previously required.
	inRepWins := 0
	outRepWins := 0

	for _, a := range analyses {
		for _, game := range a.Results {
			resp.TotalGames++
			outcome := classifyOutcome(game.Headers["Result"], game.UserColor)

			switch outcome {
			case "win":
				resp.Wins++
			case "loss":
				resp.Losses++
			case "draw":
				resp.Draws++
			}

			status := gameStatusFromGame(game)
			inRep := status == "in-repertoire"

			if inRep {
				resp.InRepCount++
				if outcome == "win" {
					inRepWins++
				}
			} else {
				resp.OutRepCount++
				if outcome == "win" {
					outRepWins++
				}
			}

			// Track matched games for opening error rate
			hasMatchedRep := game.MatchedRepertoire != nil
			if hasMatchedRep {
				resp.MatchedGamesCount++
				if status == "error" {
					resp.OpeningErrorCount++
				}
			}

			// Per-repertoire tracking
			if hasMatchedRep {
				repID := game.MatchedRepertoire.ID
				acc, ok := repMap[repID]
				if !ok {
					acc = &repAccum{
						name:  game.MatchedRepertoire.Name,
						color: game.UserColor,
					}
					repMap[repID] = acc
				}
				acc.gameCount++
				if outcome == "win" {
					acc.wins++
				}
				if inRep {
					acc.inRepCount++
					if outcome == "win" {
						acc.inRepWins++
					}
				} else {
					acc.outRepCount++
					if outcome == "win" {
						acc.outRepWins++
					}
				}
			}

			// --- Opponent Gaps: find the first opponent-new move in each game ---
			if hasMatchedRep {
				lastInRepMove := ""
				for _, move := range game.Moves {
					if move.Status == "in-repertoire" {
						lastInRepMove = move.SAN
					}
					if move.Status == "opponent-new" {
						gapKey := move.FEN + "|" + move.SAN + "|" + game.MatchedRepertoire.ID
						acc, ok := gapMap[gapKey]
						if !ok {
							moveNum := (move.PlyNumber / 2) + 1
							acc = &gapAccum{
								fen:            move.FEN,
								opponentMove:   move.SAN,
								repertoireID:   game.MatchedRepertoire.ID,
								repertoireName: game.MatchedRepertoire.Name,
								color:          game.UserColor,
								moveNumber:     moveNum,
								contextMove:    lastInRepMove,
							}
							gapMap[gapKey] = acc
						}
						switch outcome {
						case "win":
							acc.wins++
						case "loss":
							acc.losses++
						case "draw":
							acc.draws++
						}
						break // Only count the first opponent-new per game
					}
					if move.Status == "out-of-repertoire" {
						break // User deviated first, no opponent gap for this game
					}
				}
			}

			// --- Branch Stats: determine which named branch this game fell into ---
			if hasMatchedRep {
				repID := game.MatchedRepertoire.ID

				// Lazy-load repertoire tree
				if _, cached := repTreeCache[repID]; !cached {
					rep, err := s.repertoireService.GetRepertoire(ctx, repID, userID)
					if err != nil {
						// Repertoire may have been deleted; skip branch stats
						repTreeCache[repID] = nil
					} else {
						repTreeCache[repID] = &rep.TreeData
					}
				}

				repTree := repTreeCache[repID]
				if repTree != nil {
					branchName := repertoiretree.FindBranch(repTree, game.Moves)
					if branchName != "" {
						branchKey := branchName + "|" + repID
						bacc, ok := branchMap[branchKey]
						if !ok {
							bacc = &branchAccum{
								branchName:     branchName,
								repertoireID:   repID,
								repertoireName: game.MatchedRepertoire.Name,
								color:          game.UserColor,
							}
							branchMap[branchKey] = bacc
						}
						bacc.gameCount++
						switch outcome {
						case "win":
							bacc.wins++
						case "loss":
							bacc.losses++
						case "draw":
							bacc.draws++
						}
						if status == "error" {
							bacc.errorCount++
						}
					}
				}
			}
		}
	}

	// --- Compute aggregate rates ---
	if resp.TotalGames > 0 {
		resp.OverallWinRate = float64(resp.Wins) / float64(resp.TotalGames)
	}
	if resp.InRepCount+resp.OutRepCount > 0 {
		resp.OverallCoverage = float64(resp.InRepCount) / float64(resp.InRepCount+resp.OutRepCount)
	}
	if resp.InRepCount > 0 {
		resp.WinRateInRep = float64(inRepWins) / float64(resp.InRepCount)
	}
	if resp.OutRepCount > 0 {
		resp.WinRateOutRep = float64(outRepWins) / float64(resp.OutRepCount)
	}

	// Opening error rate
	if resp.MatchedGamesCount > 0 {
		resp.OpeningErrorRate = float64(resp.OpeningErrorCount) / float64(resp.MatchedGamesCount)
	}

	// --- Build per-repertoire stats sorted by gameCount desc ---
	for repID, acc := range repMap {
		rs := models.RepertoireStats{
			RepertoireID:   repID,
			RepertoireName: acc.name,
			Color:          acc.color,
			GameCount:      acc.gameCount,
			InRepCount:     acc.inRepCount,
			OutRepCount:    acc.outRepCount,
		}
		if acc.gameCount > 0 {
			rs.WinRate = float64(acc.wins) / float64(acc.gameCount)
			rs.CoveragePercent = float64(acc.inRepCount) / float64(acc.gameCount) * 100
		}
		if acc.inRepCount > 0 {
			rs.WinRateInRep = float64(acc.inRepWins) / float64(acc.inRepCount)
		}
		if acc.outRepCount > 0 {
			rs.WinRateOutRep = float64(acc.outRepWins) / float64(acc.outRepCount)
		}
		resp.Repertoires = append(resp.Repertoires, rs)
	}
	sort.SliceStable(resp.Repertoires, func(i, j int) bool {
		return resp.Repertoires[i].GameCount > resp.Repertoires[j].GameCount
	})

	// --- Build opponent gaps sorted by frequency desc, top 10 ---
	// Fetch dismissed gaps to filter them out
	var dismissedGaps map[string]bool
	if s.dismissedGapRepo != nil {
		var err error
		dismissedGaps, err = s.dismissedGapRepo.GetDismissed(ctx, userID)
		if err != nil {
			return nil, fmt.Errorf("failed to get dismissed gaps: %w", err)
		}
	}

	// Only include gaps that appeared in at least 2 games
	for _, acc := range gapMap {
		total := acc.wins + acc.losses + acc.draws
		if total < 2 {
			continue
		}
		// Skip dismissed gaps
		gapDismissKey := acc.fen + "|" + acc.opponentMove + "|" + acc.repertoireID
		if dismissedGaps[gapDismissKey] {
			continue
		}
		gap := models.OpponentGap{
			FEN:            acc.fen,
			OpponentMove:   acc.opponentMove,
			Frequency:      total,
			Wins:           acc.wins,
			Losses:         acc.losses,
			Draws:          acc.draws,
			RepertoireID:   acc.repertoireID,
			RepertoireName: acc.repertoireName,
			Color:          acc.color,
			MoveNumber:     acc.moveNumber,
			ContextMove:    acc.contextMove,
		}
		if total > 0 {
			gap.WinRate = float64(acc.wins) / float64(total)
		}
		resp.OpponentGaps = append(resp.OpponentGaps, gap)
	}
	// Sort by frequency desc
	sort.SliceStable(resp.OpponentGaps, func(i, j int) bool {
		return resp.OpponentGaps[i].Frequency > resp.OpponentGaps[j].Frequency
	})
	// Keep top 10
	if len(resp.OpponentGaps) > 10 {
		resp.OpponentGaps = resp.OpponentGaps[:10]
	}

	// --- Build branch stats sorted by gameCount desc ---
	for _, acc := range branchMap {
		bs := models.BranchStats{
			BranchName:     acc.branchName,
			RepertoireID:   acc.repertoireID,
			RepertoireName: acc.repertoireName,
			Color:          acc.color,
			GameCount:      acc.gameCount,
			Wins:           acc.wins,
			Losses:         acc.losses,
			Draws:          acc.draws,
			ErrorCount:     acc.errorCount,
		}
		if acc.gameCount > 0 {
			bs.WinRate = float64(acc.wins) / float64(acc.gameCount)
			bs.ErrorRate = float64(acc.errorCount) / float64(acc.gameCount)
		}
		resp.BranchStats = append(resp.BranchStats, bs)
	}
	sort.SliceStable(resp.BranchStats, func(i, j int) bool {
		return resp.BranchStats[i].GameCount > resp.BranchStats[j].GameCount
	})

	return resp, nil
}
