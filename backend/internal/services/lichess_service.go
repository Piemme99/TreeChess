package services

import (
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"time"

	"github.com/treechess/backend/internal/models"
)

const (
	lichessAPIBaseURL = "https://lichess.org/api"
	defaultMaxGames   = 20
	maxAllowedGames   = 100
)

type LichessService struct {
	httpClient *http.Client
}

func NewLichessService() *LichessService {
	return &LichessService{
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// FetchGames fetches games from Lichess for a given username and returns the PGN data
func (s *LichessService) FetchGames(username string, options models.LichessImportOptions) (string, error) {
	if username == "" {
		return "", fmt.Errorf("username is required")
	}

	// Build URL with query parameters
	reqURL, err := url.Parse(fmt.Sprintf("%s/games/user/%s", lichessAPIBaseURL, url.PathEscape(username)))
	if err != nil {
		return "", fmt.Errorf("failed to build URL: %w", err)
	}

	q := reqURL.Query()

	// Set max games (default: 20, max: 100)
	maxGames := defaultMaxGames
	if options.Max > 0 && options.Max <= maxAllowedGames {
		maxGames = options.Max
	} else if options.Max > maxAllowedGames {
		maxGames = maxAllowedGames
	}
	q.Set("max", strconv.Itoa(maxGames))

	// Add optional filters
	if options.Since > 0 {
		q.Set("since", strconv.FormatInt(options.Since, 10))
	}
	if options.Until > 0 {
		q.Set("until", strconv.FormatInt(options.Until, 10))
	}
	if options.Rated != nil {
		q.Set("rated", strconv.FormatBool(*options.Rated))
	}
	if options.PerfType != "" {
		q.Set("perfType", options.PerfType)
	}

	reqURL.RawQuery = q.Encode()

	req, err := http.NewRequest(http.MethodGet, reqURL.String(), nil)
	if err != nil {
		return "", fmt.Errorf("failed to create request: %w", err)
	}

	// Request PGN format
	req.Header.Set("Accept", "application/x-chess-pgn")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("failed to fetch games from Lichess: %w", err)
	}
	defer resp.Body.Close()

	// Handle response codes
	switch resp.StatusCode {
	case http.StatusOK:
		// Success - continue reading body
	case http.StatusNotFound:
		return "", fmt.Errorf("Lichess user '%s' not found", username)
	case http.StatusTooManyRequests:
		return "", fmt.Errorf("Lichess API rate limited, try again later")
	default:
		return "", fmt.Errorf("Lichess API error: %s", resp.Status)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("failed to read response: %w", err)
	}

	pgnData := string(body)
	if pgnData == "" {
		return "", fmt.Errorf("no games found for user '%s' with given filters", username)
	}

	return pgnData, nil
}
