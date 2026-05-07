package services

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestLichessExplorerService_FetchOpening_Success(t *testing.T) {
	const fakeBody = `{
		"white": 100,
		"draws": 50,
		"black": 30,
		"moves": [
			{"uci":"e2e4","san":"e4","white":60,"draws":20,"black":15,"averageRating":1900},
			{"uci":"d2d4","san":"d4","white":40,"draws":30,"black":15,"averageRating":1850}
		]
	}`

	var captured *http.Request
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		captured = r
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(fakeBody))
	}))
	defer server.Close()

	svc := NewLichessExplorerService(server.URL, server.Client())

	stats, err := svc.FetchOpening(context.Background(), OpeningQuery{
		FEN:     "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
		Variant: "standard",
		Speeds:  []string{"blitz", "rapid", "classical"},
		Ratings: []int{1600, 1800, 2000, 2200, 2500},
	}, "user-token-xyz")

	require.NoError(t, err)
	require.NotNil(t, stats)
	assert.Equal(t, 100, stats.White)
	assert.Equal(t, 50, stats.Draws)
	assert.Equal(t, 30, stats.Black)
	require.Len(t, stats.Moves, 2)
	assert.Equal(t, "e4", stats.Moves[0].SAN)
	assert.Equal(t, 1900, stats.Moves[0].AverageRating)

	require.NotNil(t, captured, "upstream handler was not called")
	assert.Equal(t, "/lichess", captured.URL.Path, "service must hit /lichess on the configured base URL")
	assert.Equal(t, "Bearer user-token-xyz", captured.Header.Get("Authorization"), "must forward Lichess OAuth token")

	q := captured.URL.Query()
	assert.Equal(t, "standard", q.Get("variant"))
	assert.Equal(t, "blitz,rapid,classical", q.Get("speeds"))
	assert.Equal(t, "1600,1800,2000,2200,2500", q.Get("ratings"))
	assert.Equal(t, "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", q.Get("fen"))
}

func TestLichessExplorerService_FetchOpening_RateLimited(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Retry-After", "12")
		w.WriteHeader(http.StatusTooManyRequests)
	}))
	defer server.Close()

	svc := NewLichessExplorerService(server.URL, server.Client())

	_, err := svc.FetchOpening(context.Background(), OpeningQuery{FEN: "x"}, "tok")

	require.Error(t, err)
	var rl *RateLimitedError
	require.True(t, errors.As(err, &rl), "expected RateLimitedError, got %v", err)
	assert.Equal(t, 12, rl.RetryAfterSeconds)
}

func TestLichessExplorerService_FetchOpening_RateLimited_NoHeader(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusTooManyRequests)
	}))
	defer server.Close()

	svc := NewLichessExplorerService(server.URL, server.Client())

	_, err := svc.FetchOpening(context.Background(), OpeningQuery{FEN: "x"}, "tok")

	require.Error(t, err)
	var rl *RateLimitedError
	require.True(t, errors.As(err, &rl))
	assert.Equal(t, 0, rl.RetryAfterSeconds, "missing Retry-After should default to 0")
}

func TestLichessExplorerService_FetchOpening_UpstreamUnavailable_5xx(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusBadGateway)
	}))
	defer server.Close()

	svc := NewLichessExplorerService(server.URL, server.Client())

	_, err := svc.FetchOpening(context.Background(), OpeningQuery{FEN: "x"}, "tok")

	require.Error(t, err)
	assert.True(t, errors.Is(err, ErrExplorerUnavailable), "expected ErrExplorerUnavailable, got %v", err)
}

func TestLichessExplorerService_FetchOpening_UpstreamUnavailable_NetworkError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {}))
	server.Close() // immediately close → next request fails at the transport level

	svc := NewLichessExplorerService(server.URL, &http.Client{})

	_, err := svc.FetchOpening(context.Background(), OpeningQuery{FEN: "x"}, "tok")

	require.Error(t, err)
	assert.True(t, errors.Is(err, ErrExplorerUnavailable), "transport error must surface as ErrExplorerUnavailable, got %v", err)
}

func TestLichessExplorerService_FetchOpening_Unauthorized(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
	}))
	defer server.Close()

	svc := NewLichessExplorerService(server.URL, server.Client())

	stats, err := svc.FetchOpening(context.Background(), OpeningQuery{FEN: "x"}, "stale-token")

	assert.Nil(t, stats)
	require.Error(t, err)
	assert.True(t, errors.Is(err, ErrExplorerUnauthorized), "expected ErrExplorerUnauthorized, got %v", err)
}
