package services

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/kumquat/backend/internal/repository/mocks"
)

func TestCleanup_PurgesAllThreeTables(t *testing.T) {
	var refreshCalled, resetCalled, cacheCalled int

	refreshRepo := &mocks.MockRefreshTokenRepo{
		DeleteExpiredFunc: func(_ context.Context) error { refreshCalled++; return nil },
	}
	resetRepo := &mocks.MockPasswordResetRepo{
		DeleteExpiredFunc: func(_ context.Context) error { resetCalled++; return nil },
	}
	cacheRepo := &mocks.MockOpeningExplorerCacheRepo{
		DeleteExpiredFunc: func(_ context.Context) error { cacheCalled++; return nil },
	}

	svc := NewCleanupService(refreshRepo, resetRepo, cacheRepo, time.Hour)
	svc.cleanup(context.Background())

	assert.Equal(t, 1, refreshCalled, "refresh tokens should be purged once")
	assert.Equal(t, 1, resetCalled, "password reset tokens should be purged once")
	assert.Equal(t, 1, cacheCalled, "explorer cache should be purged once")
}

func TestCleanup_FailureOnOneTableDoesNotBlockOthers(t *testing.T) {
	var resetCalled, cacheCalled int

	refreshRepo := &mocks.MockRefreshTokenRepo{
		DeleteExpiredFunc: func(_ context.Context) error { return errors.New("refresh boom") },
	}
	resetRepo := &mocks.MockPasswordResetRepo{
		DeleteExpiredFunc: func(_ context.Context) error { resetCalled++; return nil },
	}
	cacheRepo := &mocks.MockOpeningExplorerCacheRepo{
		DeleteExpiredFunc: func(_ context.Context) error { cacheCalled++; return nil },
	}

	svc := NewCleanupService(refreshRepo, resetRepo, cacheRepo, time.Hour)
	// Must not panic and must still reach the other cleaners.
	require.NotPanics(t, func() { svc.cleanup(context.Background()) })

	assert.Equal(t, 1, resetCalled, "reset cleanup runs even though refresh failed")
	assert.Equal(t, 1, cacheCalled, "cache cleanup runs even though refresh failed")
}

func TestCleanup_NilDependenciesAreSkipped(t *testing.T) {
	svc := NewCleanupService(nil, nil, nil, time.Hour)
	require.NotPanics(t, func() { svc.cleanup(context.Background()) })
}

func TestRunWorker_RunsImmediatePassThenStopsOnCancel(t *testing.T) {
	var mu sync.Mutex
	calls := 0

	refreshRepo := &mocks.MockRefreshTokenRepo{
		DeleteExpiredFunc: func(_ context.Context) error {
			mu.Lock()
			calls++
			mu.Unlock()
			return nil
		},
	}

	// Long interval ensures the only pass within the test window is the
	// immediate startup pass.
	svc := NewCleanupService(refreshRepo, nil, nil, time.Hour)

	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})
	go func() {
		svc.RunWorker(ctx)
		close(done)
	}()

	require.Eventually(t, func() bool {
		mu.Lock()
		defer mu.Unlock()
		return calls >= 1
	}, time.Second, 5*time.Millisecond, "expected an immediate cleanup pass on startup")

	cancel()

	select {
	case <-done:
	case <-time.After(time.Second):
		t.Fatal("RunWorker did not return after context cancellation")
	}
}

func TestRunWorker_TicksRepeatedly(t *testing.T) {
	var mu sync.Mutex
	calls := 0

	refreshRepo := &mocks.MockRefreshTokenRepo{
		DeleteExpiredFunc: func(_ context.Context) error {
			mu.Lock()
			calls++
			mu.Unlock()
			return nil
		},
	}

	// Short interval so we observe at least one tick beyond the startup pass.
	svc := NewCleanupService(refreshRepo, nil, nil, 10*time.Millisecond)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go svc.RunWorker(ctx)

	require.Eventually(t, func() bool {
		mu.Lock()
		defer mu.Unlock()
		return calls >= 2
	}, time.Second, 5*time.Millisecond, "expected the ticker to trigger repeated cleanup passes")
}
