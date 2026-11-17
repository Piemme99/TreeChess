package services

import (
	"context"
	"errors"
	"fmt"
	"io"
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
// parsed Retry-After header (0 when absent).
type RateLimitedError struct {
	RetryAfterSeconds int
}

func (e *RateLimitedError) Error() string {
	return fmt.Sprintf("lichess explorer rate-limited (retry after %ds)", e.RetryAfterSeconds)
}

// Une réponse de l'explorateur pèse quelques Ko ; la borne protège le cache d'un amont qui déraille.
const maxExplorerBody = 1 << 20

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

type ExplorerRawFetcher interface {
	FetchRaw(ctx context.Context, database string, values url.Values, token string) ([]byte, error)
}

func (s *LichessExplorerService) FetchRaw(ctx context.Context, database string, values url.Values, token string) ([]byte, error) {
	endpoint := s.baseURL + "/" + database + "?" + values.Encode()
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

	body, err := io.ReadAll(io.LimitReader(resp.Body, maxExplorerBody))
	if err != nil {
		return nil, fmt.Errorf("%w: %s", ErrExplorerUnavailable, err.Error())
	}
	return body, nil
}
