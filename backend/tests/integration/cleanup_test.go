//go:build integration

package integration

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/kumquat/backend/internal/services"
	"github.com/kumquat/backend/internal/testhelpers"
)

func countRows(t *testing.T, table string) int {
	t.Helper()
	var n int
	err := testDB.Pool.QueryRow(context.Background(), "SELECT COUNT(*) FROM "+table).Scan(&n)
	require.NoError(t, err)
	return n
}

// TestCleanupService_PurgesExpiredRowsAcrossAllThreeTables exercises the real
// DeleteExpired SQL on refresh_tokens, password_reset_tokens and
// opening_explorer_cache: only expired rows must be removed, valid rows kept.
func TestCleanupService_PurgesExpiredRowsAcrossAllThreeTables(t *testing.T) {
	testDB.TruncateAll(t)
	repos := testDB.Repos()

	user := testhelpers.SeedUser(t, repos, "cleanup-user", "password1")

	past := time.Now().Add(-1 * time.Hour)
	future := time.Now().Add(1 * time.Hour)

	// Refresh tokens: one expired, one valid.
	_, err := repos.RefreshToken.Create(user.ID, "refresh-expired", past)
	require.NoError(t, err)
	_, err = repos.RefreshToken.Create(user.ID, "refresh-valid", future)
	require.NoError(t, err)

	// Password reset tokens: one expired, one valid.
	_, err = repos.PasswordReset.Create(user.ID, "reset-expired", past)
	require.NoError(t, err)
	_, err = repos.PasswordReset.Create(user.ID, "reset-valid", future)
	require.NoError(t, err)

	// Explorer cache: one expired, one valid.
	ctx := context.Background()
	payload := []byte(`{"white":0,"draws":0,"black":0,"moves":[]}`)
	require.NoError(t, repos.OpeningExplorerCache.Put(ctx, "cache-expired", payload, past))
	require.NoError(t, repos.OpeningExplorerCache.Put(ctx, "cache-valid", payload, future))

	require.Equal(t, 2, countRows(t, "refresh_tokens"))
	require.Equal(t, 2, countRows(t, "password_reset_tokens"))
	require.Equal(t, 2, countRows(t, "opening_explorer_cache"))

	svc := services.NewCleanupService(
		repos.RefreshToken,
		repos.PasswordReset,
		repos.OpeningExplorerCache,
		time.Hour,
	)

	// RunWorker runs an immediate pass; cancel right after so we exercise exactly
	// one cleanup cycle without depending on the ticker.
	runCtx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})
	go func() {
		svc.RunWorker(runCtx)
		close(done)
	}()

	require.Eventually(t, func() bool {
		return countRows(t, "refresh_tokens") == 1 &&
			countRows(t, "password_reset_tokens") == 1 &&
			countRows(t, "opening_explorer_cache") == 1
	}, 5*time.Second, 20*time.Millisecond, "expired rows should be purged by the cleanup pass")

	cancel()
	select {
	case <-done:
	case <-time.After(2 * time.Second):
		t.Fatal("cleanup worker did not stop after context cancellation")
	}

	// The surviving rows must be the non-expired ones.
	_, found, err := repos.OpeningExplorerCache.Get(ctx, "cache-valid")
	require.NoError(t, err)
	assert.True(t, found, "valid cache row must survive cleanup")

	_, err = repos.RefreshToken.GetByTokenHash("refresh-valid")
	assert.NoError(t, err, "valid refresh token must survive cleanup")
}
