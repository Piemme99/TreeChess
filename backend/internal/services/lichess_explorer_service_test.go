package services

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestLichessExplorerService_FetchRaw_RateLimited(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Retry-After", "12")
		w.WriteHeader(http.StatusTooManyRequests)
	}))
	defer server.Close()

	svc := NewLichessExplorerService(server.URL, server.Client())

	_, err := svc.FetchRaw(context.Background(), "lichess", url.Values{"fen": {"x"}}, "tok")

	require.Error(t, err)
	var rl *RateLimitedError
	require.True(t, errors.As(err, &rl), "expected RateLimitedError, got %v", err)
	assert.Equal(t, 12, rl.RetryAfterSeconds)
}

func TestLichessExplorerService_FetchRaw_RateLimited_NoHeader(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusTooManyRequests)
	}))
	defer server.Close()

	svc := NewLichessExplorerService(server.URL, server.Client())

	_, err := svc.FetchRaw(context.Background(), "lichess", url.Values{"fen": {"x"}}, "tok")

	require.Error(t, err)
	var rl *RateLimitedError
	require.True(t, errors.As(err, &rl))
	assert.Equal(t, 0, rl.RetryAfterSeconds, "missing Retry-After should default to 0")
}

func TestLichessExplorerService_FetchRaw_UpstreamUnavailable_5xx(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusBadGateway)
	}))
	defer server.Close()

	svc := NewLichessExplorerService(server.URL, server.Client())

	_, err := svc.FetchRaw(context.Background(), "lichess", url.Values{"fen": {"x"}}, "tok")

	require.Error(t, err)
	assert.True(t, errors.Is(err, ErrExplorerUnavailable), "expected ErrExplorerUnavailable, got %v", err)
}

func TestLichessExplorerService_FetchRaw_UpstreamUnavailable_NetworkError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {}))
	server.Close() // immediately close → next request fails at the transport level

	svc := NewLichessExplorerService(server.URL, &http.Client{})

	_, err := svc.FetchRaw(context.Background(), "lichess", url.Values{"fen": {"x"}}, "tok")

	require.Error(t, err)
	assert.True(t, errors.Is(err, ErrExplorerUnavailable), "transport error must surface as ErrExplorerUnavailable, got %v", err)
}

func TestLichessExplorerService_FetchRaw_Unauthorized(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
	}))
	defer server.Close()

	svc := NewLichessExplorerService(server.URL, server.Client())

	body, err := svc.FetchRaw(context.Background(), "lichess", url.Values{"fen": {"x"}}, "stale-token")

	assert.Nil(t, body)
	require.Error(t, err)
	assert.True(t, errors.Is(err, ErrExplorerUnauthorized), "expected ErrExplorerUnauthorized, got %v", err)
}

func TestLichessExplorerService_FetchRaw_ReturnsBodyFromRequestedDatabase(t *testing.T) {
	const body = `{"white":1,"draws":0,"black":0,"moves":[],"topGames":[{"id":"abc"}]}`
	var captured *http.Request
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		captured = r
		_, _ = w.Write([]byte(body))
	}))
	defer server.Close()

	svc := NewLichessExplorerService(server.URL, server.Client())
	got, err := svc.FetchRaw(context.Background(), "masters", url.Values{"fen": {"8/8/8/8/8/8/8/K6k w - - 0 1"}, "topGames": {"4"}}, "server-token")

	require.NoError(t, err)
	assert.JSONEq(t, body, string(got))
	assert.Equal(t, "/masters", captured.URL.Path)
	assert.Equal(t, "4", captured.URL.Query().Get("topGames"))
	assert.Equal(t, "Bearer server-token", captured.Header.Get("Authorization"))
}
