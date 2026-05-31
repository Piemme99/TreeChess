package services

import (
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/kumquat/backend/internal/models"
)

// newTestChesscomService wires a ChesscomService to a test server with a
// no-op (recorded) sleep so the throttle is exercised without real waits.
func newTestChesscomService(server *httptest.Server, slept *[]time.Duration) *ChesscomService {
	return &ChesscomService{
		httpClient:   server.Client(),
		baseURL:      server.URL,
		fetchSpacing: 250 * time.Millisecond,
		sleep: func(d time.Duration) {
			if slept != nil {
				*slept = append(*slept, d)
			}
		},
	}
}

func TestChesscomService_FetchGames_SpacesMonthFetches(t *testing.T) {
	const game = "[Event \"Live Chess\"]\n[TimeControl \"600\"]\n\n1. e4 e5 1-0"

	var monthFetches int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case strings.HasSuffix(r.URL.Path, "/games/archives"):
			base := "http://" + r.Host
			_, _ = fmt.Fprintf(w, `{"archives":["%s/player/u/games/2024/01","%s/player/u/games/2024/02","%s/player/u/games/2024/03"]}`, base, base, base)
		case strings.HasSuffix(r.URL.Path, "/pgn"):
			atomic.AddInt32(&monthFetches, 1)
			_, _ = w.Write([]byte(game))
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	defer server.Close()

	var slept []time.Duration
	svc := newTestChesscomService(server, &slept)

	pgn, err := svc.FetchGames("u", models.ChesscomImportOptions{Max: 100})
	require.NoError(t, err)
	assert.NotEmpty(t, pgn)

	got := atomic.LoadInt32(&monthFetches)
	require.Equal(t, int32(3), got, "all three months should be fetched")
	// One spacing sleep between each pair of fetches (none before the first).
	assert.Equal(t, int(got)-1, len(slept), "should sleep between consecutive month fetches")
	for _, d := range slept {
		assert.Equal(t, 250*time.Millisecond, d)
	}
}

func TestChesscomService_FetchGames_StopsOnRepeated429(t *testing.T) {
	var monthFetches int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case strings.HasSuffix(r.URL.Path, "/games/archives"):
			base := "http://" + r.Host
			_, _ = fmt.Fprintf(w, `{"archives":["%s/player/u/games/2024/01","%s/player/u/games/2024/02","%s/player/u/games/2024/03"]}`, base, base, base)
		case strings.HasSuffix(r.URL.Path, "/pgn"):
			atomic.AddInt32(&monthFetches, 1)
			w.Header().Set("Retry-After", "1")
			w.WriteHeader(http.StatusTooManyRequests)
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	defer server.Close()

	svc := newTestChesscomService(server, nil)
	// Single attempt per month so the per-month retry doesn't mask the loop's
	// own repeated-429 accounting.
	svc.sleep = func(time.Duration) {}

	_, err := svc.FetchGames("u", models.ChesscomImportOptions{Max: 100})

	require.Error(t, err)
	// The repeated 429 is surfaced (wrapping the chess.com sentinel), not silently dropped.
	assert.True(t, errors.Is(err, ErrChesscomRateLimited), "repeated 429 should surface as a rate-limit error")
	var rl *RateLimitedError
	assert.True(t, errors.As(err, &rl), "error should carry Retry-After info")
	// Loop should bail after chesscomMaxRateLimitHits months rather than hammering
	// every archive. Each month does up to defaultSyncRetry.maxAttempts tries.
	assert.LessOrEqual(t, int(atomic.LoadInt32(&monthFetches)), chesscomMaxRateLimitHits*defaultSyncRetry.maxAttempts)
}

func TestChesscomService_FetchGames_UserNotFound(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNotFound)
	}))
	defer server.Close()

	svc := newTestChesscomService(server, nil)

	_, err := svc.FetchGames("ghost", models.ChesscomImportOptions{})
	assert.ErrorIs(t, err, ErrChesscomUserNotFound)
}

func TestChesscomService_FetchGames_ArchivesRateLimited(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Retry-After", "30")
		w.WriteHeader(http.StatusTooManyRequests)
	}))
	defer server.Close()

	svc := newTestChesscomService(server, nil)

	_, err := svc.FetchGames("u", models.ChesscomImportOptions{})
	require.Error(t, err)
	assert.True(t, errors.Is(err, ErrChesscomRateLimited))
	var rl *RateLimitedError
	require.True(t, errors.As(err, &rl))
	assert.Equal(t, 30, rl.RetryAfterSeconds)
}
