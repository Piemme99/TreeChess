package services

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"strings"
)

var (
	ErrExplorerUnauthorized = errors.New("lichess explorer rejected the access token")
	ErrExplorerUnavailable  = errors.New("lichess explorer is unavailable")
)

// RateLimitedError reports an upstream HTTP 429. RetryAfterSeconds carries the
// parsed Retry-After header (0 when absent). An optional wrapped sentinel (e.g.
// ErrLichessRateLimited) lets callers keep using errors.Is for platform-specific
// handling while still extracting the retry delay via errors.As.
type RateLimitedError struct {
	RetryAfterSeconds int
	wrapped           error
}

func (e *RateLimitedError) Error() string {
	if e.wrapped != nil {
		return fmt.Sprintf("%s (retry after %ds)", e.wrapped.Error(), e.RetryAfterSeconds)
	}
	return fmt.Sprintf("lichess explorer rate-limited (retry after %ds)", e.RetryAfterSeconds)
}

// Unwrap exposes the wrapped sentinel so errors.Is(err, ErrLichessRateLimited)
// (and the chess.com equivalent) still matches.
func (e *RateLimitedError) Unwrap() error {
	return e.wrapped
}

type OpeningQuery struct {
	FEN     string
	Variant string
	Speeds  []string
	Ratings []int
}

type OpeningStats struct {
	White int           `json:"white"`
	Draws int           `json:"draws"`
	Black int           `json:"black"`
	Moves []OpeningMove `json:"moves"`
}

type OpeningMove struct {
	UCI           string `json:"uci"`
	SAN           string `json:"san"`
	White         int    `json:"white"`
	Draws         int    `json:"draws"`
	Black         int    `json:"black"`
	AverageRating int    `json:"averageRating"`
}

// OpeningExplorerFetcher is the seam used by the HTTP handler and the engine
// worker. LichessExplorerService is its production implementation; tests can
// substitute a stub.
type OpeningExplorerFetcher interface {
	FetchOpening(ctx context.Context, q OpeningQuery, token string) (*OpeningStats, error)
}

type LichessExplorerService struct {
	baseURL    string
	httpClient *http.Client
}

func NewLichessExplorerService(baseURL string, httpClient *http.Client) *LichessExplorerService {
	if httpClient == nil {
		httpClient = http.DefaultClient
	}
	return &LichessExplorerService{
		baseURL:    strings.TrimRight(baseURL, "/"),
		httpClient: httpClient,
	}
}

func (s *LichessExplorerService) FetchOpening(ctx context.Context, q OpeningQuery, token string) (*OpeningStats, error) {
	values := url.Values{}
	if q.Variant != "" {
		values.Set("variant", q.Variant)
	}
	if len(q.Speeds) > 0 {
		values.Set("speeds", strings.Join(q.Speeds, ","))
	}
	if len(q.Ratings) > 0 {
		ratings := make([]string, len(q.Ratings))
		for i, r := range q.Ratings {
			ratings[i] = strconv.Itoa(r)
		}
		values.Set("ratings", strings.Join(ratings, ","))
	}
	values.Set("fen", q.FEN)

	endpoint := s.baseURL + "/lichess?" + values.Encode()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, fmt.Errorf("build explorer request: %w", err)
	}
	req.Header.Set("Accept", "application/json")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("%w: %s", ErrExplorerUnavailable, err.Error())
	}
	defer func() { _ = resp.Body.Close() }()

	switch {
	case resp.StatusCode == http.StatusOK:
	case resp.StatusCode == http.StatusUnauthorized:
		return nil, ErrExplorerUnauthorized
	case resp.StatusCode == http.StatusTooManyRequests:
		retry, _ := strconv.Atoi(resp.Header.Get("Retry-After"))
		return nil, &RateLimitedError{RetryAfterSeconds: retry}
	case resp.StatusCode >= 500:
		return nil, fmt.Errorf("%w: status %d", ErrExplorerUnavailable, resp.StatusCode)
	default:
		return nil, fmt.Errorf("explorer returned status %d", resp.StatusCode)
	}

	var stats OpeningStats
	if err := json.NewDecoder(resp.Body).Decode(&stats); err != nil {
		return nil, fmt.Errorf("decode explorer response: %w", err)
	}
	return &stats, nil
}
