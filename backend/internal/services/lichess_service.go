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
	lichessBaseURL    = "https://lichess.org"
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

// FetchStudyPGN fetches the full PGN of a Lichess study (all chapters).
func (s *LichessService) FetchStudyPGN(studyID, authToken string) (string, error) {
	if studyID == "" {
		return "", fmt.Errorf("study ID is required")
	}

	reqURL := fmt.Sprintf("%s/api/study/%s.pgn?clocks=false&comments=true&variations=true&orientation=true",
		lichessBaseURL, url.PathEscape(studyID))

	req, err := http.NewRequest(http.MethodGet, reqURL, nil)
	if err != nil {
		return "", fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Accept", "application/x-chess-pgn")
	if authToken != "" {
		req.Header.Set("Authorization", "Bearer "+authToken)
	}

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("failed to fetch study from Lichess: %w", err)
	}
	defer resp.Body.Close()

	switch resp.StatusCode {
	case http.StatusOK:
		// continue
	case http.StatusNotFound:
		return "", ErrLichessStudyNotFound
	case http.StatusForbidden:
		return "", ErrLichessStudyForbidden
	case http.StatusTooManyRequests:
		return "", ErrLichessRateLimited
	default:
		return "", fmt.Errorf("Lichess API error: %s", resp.Status)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("failed to read response: %w", err)
	}

	pgnData := string(body)
	if pgnData == "" {
		return "", fmt.Errorf("empty study PGN returned for study '%s'", studyID)
	}

	return pgnData, nil
}

// FetchStudyChapterPGN fetches the PGN of a single chapter from a Lichess study.
func (s *LichessService) FetchStudyChapterPGN(studyID, chapterID, authToken string) (string, error) {
	if studyID == "" || chapterID == "" {
		return "", fmt.Errorf("study ID and chapter ID are required")
	}

	reqURL := fmt.Sprintf("%s/api/study/%s/%s.pgn?clocks=false&comments=true&variations=true&orientation=true",
		lichessBaseURL, url.PathEscape(studyID), url.PathEscape(chapterID))

	req, err := http.NewRequest(http.MethodGet, reqURL, nil)
	if err != nil {
		return "", fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Accept", "application/x-chess-pgn")
	if authToken != "" {
		req.Header.Set("Authorization", "Bearer "+authToken)
	}

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("failed to fetch study chapter from Lichess: %w", err)
	}
	defer resp.Body.Close()

	switch resp.StatusCode {
	case http.StatusOK:
		// continue
	case http.StatusNotFound:
		return "", ErrLichessStudyNotFound
	case http.StatusForbidden:
		return "", ErrLichessStudyForbidden
	case http.StatusTooManyRequests:
		return "", ErrLichessRateLimited
	default:
		return "", fmt.Errorf("Lichess API error: %s", resp.Status)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("failed to read response: %w", err)
	}

	return string(body), nil
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
		return "", ErrLichessUserNotFound
	case http.StatusTooManyRequests:
		return "", ErrLichessRateLimited
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
