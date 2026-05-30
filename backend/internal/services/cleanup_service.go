package services

import (
	"context"
	"log/slog"
	"time"
)

// refreshTokenCleaner purges expired refresh tokens.
type refreshTokenCleaner interface {
	DeleteExpired() error
}

// passwordResetCleaner purges expired password reset tokens.
type passwordResetCleaner interface {
	DeleteExpired() error
}

// explorerCacheCleaner purges stale opening-explorer cache rows.
type explorerCacheCleaner interface {
	DeleteExpired(ctx context.Context) error
}

// CleanupService periodically purges expired rows from the refresh-token,
// password-reset and opening-explorer-cache tables. None of these tables are
// otherwise garbage-collected, so without this worker they grow without bound.
type CleanupService struct {
	refreshTokens  refreshTokenCleaner
	passwordResets passwordResetCleaner
	explorerCache  explorerCacheCleaner
	interval       time.Duration
}

// NewCleanupService builds a CleanupService. Any of the cleaner dependencies may
// be nil; the corresponding table is simply skipped during a cleanup pass.
func NewCleanupService(
	refreshTokens refreshTokenCleaner,
	passwordResets passwordResetCleaner,
	explorerCache explorerCacheCleaner,
	interval time.Duration,
) *CleanupService {
	return &CleanupService{
		refreshTokens:  refreshTokens,
		passwordResets: passwordResets,
		explorerCache:  explorerCache,
		interval:       interval,
	}
}

// RunWorker runs an initial cleanup pass, then repeats on s.interval until the
// context is cancelled. It mirrors EngineService.RunWorker: it recovers from
// panics and stops cleanly on ctx.Done().
func (s *CleanupService) RunWorker(ctx context.Context) {
	defer func() {
		if r := recover(); r != nil {
			slog.Error("cleanup worker panicked", "panic", r)
		}
	}()

	slog.Info("cleanup worker started", "component", "cleanup", "interval", s.interval.String())

	// Run once immediately so a long interval does not leave a freshly-started
	// instance with stale rows until the first tick.
	s.cleanup(ctx)

	ticker := time.NewTicker(s.interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			slog.Info("cleanup worker stopped", "component", "cleanup")
			return
		case <-ticker.C:
			s.cleanup(ctx)
		}
	}
}

// cleanup runs one purge pass across all configured tables. A failure on one
// table is logged and does not prevent the others from being cleaned.
func (s *CleanupService) cleanup(ctx context.Context) {
	if s.refreshTokens != nil {
		if err := s.refreshTokens.DeleteExpired(); err != nil {
			slog.Error("failed to purge expired refresh tokens", "component", "cleanup", "error", err)
		}
	}

	if s.passwordResets != nil {
		if err := s.passwordResets.DeleteExpired(); err != nil {
			slog.Error("failed to purge expired password reset tokens", "component", "cleanup", "error", err)
		}
	}

	if s.explorerCache != nil {
		if err := s.explorerCache.DeleteExpired(ctx); err != nil {
			slog.Error("failed to purge stale opening-explorer cache", "component", "cleanup", "error", err)
		}
	}
}
