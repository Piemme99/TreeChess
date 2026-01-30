package services

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/treechess/backend/internal/models"
)

const (
	chesscomAPIBaseURL = "https://api.chess.com/pub"
	chesscomUserAgent  = "TreeChess/1.0"
)

type ChesscomService struct {
	httpClient *http.Client
}

func NewChesscomService() *ChesscomService {
	return &ChesscomService{
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

type chesscomArchivesResponse struct {
	Archives []string `json:"archives"`
}

// FetchGames fetches games from Chess.com for a given username and returns the PGN data
func (s *ChesscomService) FetchGames(username string, options models.ChesscomImportOptions) (string, error) {
	if username == "" {
		return "", fmt.Errorf("username is required")
	}

	// Determine max games
	maxGames := defaultMaxGames
	if options.Max > 0 && options.Max <= maxAllowedGames {
		maxGames = options.Max
	} else if options.Max > maxAllowedGames {
		maxGames = maxAllowedGames
	}

	// Step 1: Fetch list of monthly archives
	archivesURL := fmt.Sprintf("%s/player/%s/games/archives", chesscomAPIBaseURL, strings.ToLower(username))
	archivesResp, err := s.doRequest(archivesURL)
	if err != nil {
		return "", err
	}
	defer archivesResp.Body.Close()

	switch archivesResp.StatusCode {
	case http.StatusOK:
		// continue
	case http.StatusNotFound:
		return "", ErrChesscomUserNotFound
	case http.StatusTooManyRequests:
		return "", ErrChesscomRateLimited
	default:
		return "", fmt.Errorf("Chess.com API error: %s", archivesResp.Status)
	}

	var archives chesscomArchivesResponse
	if err := json.NewDecoder(archivesResp.Body).Decode(&archives); err != nil {
		return "", fmt.Errorf("failed to parse archives response: %w", err)
	}

	if len(archives.Archives) == 0 {
		return "", fmt.Errorf("no games found for user '%s'", username)
	}

	// Step 2: Filter archives by date range
	filteredArchives := s.filterArchivesByDate(archives.Archives, options.Since, options.Until)
	if len(filteredArchives) == 0 {
		return "", fmt.Errorf("no games found for user '%s' with given filters", username)
	}

	// Step 3: Fetch PGN for each relevant month (most recent first, serially)
	var allPGN strings.Builder
	totalGames := 0

	for i := len(filteredArchives) - 1; i >= 0 && totalGames < maxGames; i-- {
		pgnURL := filteredArchives[i] + "/pgn"
		monthPGN, err := s.fetchMonthPGN(pgnURL, options.TimeClass)
		if err != nil {
			// Skip months that fail (could be rate limited on individual month)
			continue
		}

		if monthPGN == "" {
			continue
		}

		// Count and trim games from this month
		games := splitPGNGames(monthPGN)
		for _, game := range games {
			if totalGames >= maxGames {
				break
			}
			if allPGN.Len() > 0 {
				allPGN.WriteString("\n\n")
			}
			allPGN.WriteString(game)
			totalGames++
		}
	}

	pgnData := allPGN.String()
	if pgnData == "" {
		return "", fmt.Errorf("no games found for user '%s' with given filters", username)
	}

	return pgnData, nil
}

func (s *ChesscomService) doRequest(url string) (*http.Response, error) {
	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("User-Agent", chesscomUserAgent)
	req.Header.Set("Accept", "application/json")

	return s.httpClient.Do(req)
}

func (s *ChesscomService) fetchMonthPGN(pgnURL string, timeClass string) (string, error) {
	req, err := http.NewRequest(http.MethodGet, pgnURL, nil)
	if err != nil {
		return "", fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("User-Agent", chesscomUserAgent)

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("failed to fetch PGN: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusTooManyRequests {
		return "", ErrChesscomRateLimited
	}
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("Chess.com API error: %s", resp.Status)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("failed to read response: %w", err)
	}

	pgnData := string(body)

	// Filter by time class if specified
	if timeClass != "" {
		pgnData = filterByTimeClass(pgnData, timeClass)
	}

	return pgnData, nil
}

// filterArchivesByDate filters archive URLs by date range.
// Archive URLs look like: https://api.chess.com/pub/player/username/games/2024/01
func (s *ChesscomService) filterArchivesByDate(archives []string, sinceMs, untilMs int64) []string {
	if sinceMs == 0 && untilMs == 0 {
		return archives
	}

	var filtered []string
	for _, url := range archives {
		// Extract year/month from URL (last two path segments)
		parts := strings.Split(url, "/")
		if len(parts) < 2 {
			continue
		}
		yearStr := parts[len(parts)-2]
		monthStr := parts[len(parts)-1]

		var year, month int
		if _, err := fmt.Sscanf(yearStr, "%d", &year); err != nil {
			continue
		}
		if _, err := fmt.Sscanf(monthStr, "%d", &month); err != nil {
			continue
		}

		// Archive represents the entire month
		archiveStart := time.Date(year, time.Month(month), 1, 0, 0, 0, 0, time.UTC)
		archiveEnd := archiveStart.AddDate(0, 1, 0).Add(-time.Millisecond)

		if sinceMs > 0 {
			since := time.UnixMilli(sinceMs)
			if archiveEnd.Before(since) {
				continue
			}
		}
		if untilMs > 0 {
			until := time.UnixMilli(untilMs)
			if archiveStart.After(until) {
				continue
			}
		}

		filtered = append(filtered, url)
	}

	return filtered
}

// splitPGNGames splits a PGN string containing multiple games into individual games.
// Games are separated by double newlines after the result.
func splitPGNGames(pgn string) []string {
	var games []string
	var current strings.Builder

	lines := strings.Split(pgn, "\n")
	inGame := false

	for _, line := range lines {
		trimmed := strings.TrimSpace(line)

		if trimmed == "" {
			if inGame {
				// End of a game section (moves ended)
				game := strings.TrimSpace(current.String())
				if game != "" {
					games = append(games, game)
				}
				current.Reset()
				inGame = false
			}
			continue
		}

		if strings.HasPrefix(trimmed, "[") {
			// Header line - start of new game or continuation of headers
			if current.Len() > 0 {
				current.WriteString("\n")
			}
			current.WriteString(line)
		} else {
			// Move text
			inGame = true
			if current.Len() > 0 {
				current.WriteString("\n")
			}
			current.WriteString(line)
		}
	}

	// Don't forget the last game
	game := strings.TrimSpace(current.String())
	if game != "" {
		games = append(games, game)
	}

	return games
}

// filterByTimeClass filters PGN games by their TimeControl header.
// Chess.com uses TimeControl header; we map timeClass to expected ranges.
func filterByTimeClass(pgn string, timeClass string) string {
	games := splitPGNGames(pgn)
	var filtered []string

	for _, game := range games {
		if matchesTimeClass(game, timeClass) {
			filtered = append(filtered, game)
		}
	}

	return strings.Join(filtered, "\n\n")
}

// matchesTimeClass checks if a PGN game matches the desired time class.
// Chess.com PGN includes [TimeControl "X"] header where X is base time in seconds
// or base+increment format like "600+5".
func matchesTimeClass(game string, timeClass string) bool {
	// Look for TimeControl header
	for _, line := range strings.Split(game, "\n") {
		trimmed := strings.TrimSpace(line)
		if strings.HasPrefix(trimmed, "[TimeControl ") {
			tc := strings.TrimPrefix(trimmed, "[TimeControl \"")
			tc = strings.TrimSuffix(tc, "\"]")
			return models.ClassifyTimeControl(tc) == timeClass
		}
	}
	// If no TimeControl header, include the game (don't filter out)
	return true
}

