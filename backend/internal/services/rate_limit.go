package services

import (
	"errors"
	"math/rand"
	"net/http"
	"strconv"
	"time"
)

// newRateLimitedError builds a *RateLimitedError from an HTTP 429 response,
// parsing the Retry-After header and wrapping the given platform sentinel so
// callers can match it with errors.Is while still reading RetryAfterSeconds.
func newRateLimitedError(resp *http.Response, sentinel error) *RateLimitedError {
	return &RateLimitedError{
		RetryAfterSeconds: parseRetryAfter(resp.Header.Get("Retry-After")),
		wrapped:           sentinel,
	}
}

// parseRetryAfter parses a Retry-After header value, supporting both the
// delta-seconds form ("120") and the HTTP-date form. Returns 0 when the header
// is absent or unparseable.
func parseRetryAfter(value string) int {
	if value == "" {
		return 0
	}
	if secs, err := strconv.Atoi(value); err == nil {
		if secs < 0 {
			return 0
		}
		return secs
	}
	if t, err := http.ParseTime(value); err == nil {
		if d := time.Until(t); d > 0 {
			return int(d.Seconds())
		}
	}
	return 0
}

// retryConfig bounds a jittered retry loop for transient upstream failures
// (HTTP 429 and 5xx).
type retryConfig struct {
	maxAttempts int           // total attempts including the first
	baseDelay   time.Duration // base backoff, doubled each attempt
	maxDelay    time.Duration // cap for a single backoff wait
}

// defaultSyncRetry is the retry policy used for background sync fetches. Kept
// small so a manual sync still returns promptly when the upstream is degraded.
var defaultSyncRetry = retryConfig{
	maxAttempts: 3,
	baseDelay:   1 * time.Second,
	maxDelay:    30 * time.Second,
}

// retryWithBackoff invokes fn up to cfg.maxAttempts times, retrying only on
// retryable errors (429 via *RateLimitedError, or errors flagged retryable by
// retryable). On a 429 it honors the Retry-After delay; otherwise it uses
// exponential backoff with full jitter. sleep is injectable for tests. It stops
// early and returns the last error once attempts are exhausted.
func retryWithBackoff[T any](cfg retryConfig, sleep func(time.Duration), fn func() (T, error), retryable func(error) bool) (T, error) {
	var zero T
	var lastErr error

	for attempt := 0; attempt < cfg.maxAttempts; attempt++ {
		result, err := fn()
		if err == nil {
			return result, nil
		}
		lastErr = err

		var rl *RateLimitedError
		is429 := errors.As(err, &rl)
		if !is429 && !retryable(err) {
			return zero, err
		}

		// No point sleeping after the final attempt.
		if attempt == cfg.maxAttempts-1 {
			break
		}

		wait := backoffDelay(cfg, attempt)
		if is429 && rl.RetryAfterSeconds > 0 {
			retryAfter := time.Duration(rl.RetryAfterSeconds) * time.Second
			if retryAfter > cfg.maxDelay {
				retryAfter = cfg.maxDelay
			}
			wait = retryAfter
		}
		sleep(wait)
	}

	return zero, lastErr
}

// backoffDelay returns the exponential backoff for the given zero-based attempt,
// capped at cfg.maxDelay and randomized with full jitter.
func backoffDelay(cfg retryConfig, attempt int) time.Duration {
	delay := cfg.baseDelay << attempt
	if delay <= 0 || delay > cfg.maxDelay {
		delay = cfg.maxDelay
	}
	// Full jitter: random in [0, delay].
	return time.Duration(rand.Int63n(int64(delay) + 1))
}

// isRetryableSyncError reports whether err is a transient upstream failure worth
// retrying for a sync fetch: HTTP 5xx (surfaced as ErrUpstreamUnavailable) or a
// rate limit. The 429 case is handled separately by retryWithBackoff, so this
// only needs to flag 5xx.
func isRetryableSyncError(err error) bool {
	return errors.Is(err, ErrUpstreamUnavailable)
}
