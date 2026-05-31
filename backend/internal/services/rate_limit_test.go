package services

import (
	"errors"
	"fmt"
	"net/http"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestParseRetryAfter(t *testing.T) {
	t.Run("empty returns zero", func(t *testing.T) {
		assert.Equal(t, 0, parseRetryAfter(""))
	})

	t.Run("delta seconds", func(t *testing.T) {
		assert.Equal(t, 120, parseRetryAfter("120"))
	})

	t.Run("negative seconds clamps to zero", func(t *testing.T) {
		assert.Equal(t, 0, parseRetryAfter("-5"))
	})

	t.Run("garbage returns zero", func(t *testing.T) {
		assert.Equal(t, 0, parseRetryAfter("soon"))
	})

	t.Run("http-date in the future", func(t *testing.T) {
		future := time.Now().Add(2 * time.Minute).UTC().Format(http.TimeFormat)
		got := parseRetryAfter(future)
		// Allow a little slack for clock/rounding.
		assert.Greater(t, got, 100)
		assert.LessOrEqual(t, got, 120)
	})

	t.Run("http-date in the past returns zero", func(t *testing.T) {
		past := time.Now().Add(-2 * time.Minute).UTC().Format(http.TimeFormat)
		assert.Equal(t, 0, parseRetryAfter(past))
	})
}

func TestNewRateLimitedError_WrapsSentinel(t *testing.T) {
	resp := &http.Response{Header: http.Header{}}
	resp.Header.Set("Retry-After", "42")

	err := newRateLimitedError(resp, ErrLichessRateLimited)

	// errors.Is keeps working for platform-specific handling.
	assert.True(t, errors.Is(err, ErrLichessRateLimited))
	// errors.As extracts the retry delay.
	var rl *RateLimitedError
	require.True(t, errors.As(err, &rl))
	assert.Equal(t, 42, rl.RetryAfterSeconds)
}

func TestRetryWithBackoff_RetriesOn429ThenSucceeds(t *testing.T) {
	var slept []time.Duration
	sleep := func(d time.Duration) { slept = append(slept, d) }

	calls := 0
	got, err := retryWithBackoff(retryConfig{maxAttempts: 3, baseDelay: time.Second, maxDelay: 30 * time.Second}, sleep,
		func() (string, error) {
			calls++
			if calls < 2 {
				return "", &RateLimitedError{RetryAfterSeconds: 5}
			}
			return "ok", nil
		},
		isRetryableSyncError,
	)

	require.NoError(t, err)
	assert.Equal(t, "ok", got)
	assert.Equal(t, 2, calls)
	// Honored Retry-After of 5s (capped at maxDelay).
	require.Len(t, slept, 1)
	assert.Equal(t, 5*time.Second, slept[0])
}

func TestRetryWithBackoff_RetryAfterCappedAtMaxDelay(t *testing.T) {
	var slept []time.Duration
	sleep := func(d time.Duration) { slept = append(slept, d) }

	calls := 0
	_, _ = retryWithBackoff(retryConfig{maxAttempts: 2, baseDelay: time.Second, maxDelay: 10 * time.Second}, sleep,
		func() (string, error) {
			calls++
			return "", &RateLimitedError{RetryAfterSeconds: 600}
		},
		isRetryableSyncError,
	)

	require.Len(t, slept, 1)
	assert.Equal(t, 10*time.Second, slept[0], "Retry-After should be capped at maxDelay")
}

func TestRetryWithBackoff_RetriesOn5xx(t *testing.T) {
	sleep := func(time.Duration) {}

	calls := 0
	got, err := retryWithBackoff(retryConfig{maxAttempts: 3, baseDelay: time.Millisecond, maxDelay: time.Second}, sleep,
		func() (string, error) {
			calls++
			if calls < 3 {
				return "", fmt.Errorf("%w: status 503", ErrUpstreamUnavailable)
			}
			return "recovered", nil
		},
		isRetryableSyncError,
	)

	require.NoError(t, err)
	assert.Equal(t, "recovered", got)
	assert.Equal(t, 3, calls)
}

func TestRetryWithBackoff_GivesUpAfterMaxAttempts(t *testing.T) {
	sleeps := 0
	sleep := func(time.Duration) { sleeps++ }

	calls := 0
	_, err := retryWithBackoff(retryConfig{maxAttempts: 3, baseDelay: time.Millisecond, maxDelay: time.Second}, sleep,
		func() (string, error) {
			calls++
			return "", &RateLimitedError{RetryAfterSeconds: 1}
		},
		isRetryableSyncError,
	)

	require.Error(t, err)
	var rl *RateLimitedError
	assert.True(t, errors.As(err, &rl))
	assert.Equal(t, 3, calls, "should attempt exactly maxAttempts times")
	assert.Equal(t, 2, sleeps, "should not sleep after the final attempt")
}

func TestRetryWithBackoff_DoesNotRetryNonRetryable(t *testing.T) {
	sleep := func(time.Duration) { t.Fatal("should not sleep for a non-retryable error") }

	calls := 0
	sentinel := fmt.Errorf("user not found")
	_, err := retryWithBackoff(retryConfig{maxAttempts: 3, baseDelay: time.Second, maxDelay: time.Second}, sleep,
		func() (string, error) {
			calls++
			return "", sentinel
		},
		isRetryableSyncError,
	)

	require.ErrorIs(t, err, sentinel)
	assert.Equal(t, 1, calls, "should not retry a non-retryable error")
}
