//go:build integration

package integration

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/kumquat/backend/internal/repository"
)

func TestOpeningExplorerCache_PutGet_Roundtrip(t *testing.T) {
	testDB.TruncateAll(t)
	repo := repository.NewPostgresOpeningExplorerCacheRepo(testDB.Pool)

	ctx := context.Background()
	key := "fen=startpos&v=standard"
	payload := []byte(`{"white":1,"draws":2,"black":3,"moves":[]}`)
	expires := time.Now().Add(1 * time.Hour)

	require.NoError(t, repo.Put(ctx, key, payload, expires))

	got, found, err := repo.Get(ctx, key)
	require.NoError(t, err)
	require.True(t, found, "cache miss after Put")
	assert.JSONEq(t, string(payload), string(got))
}

func TestOpeningExplorerCache_Get_MissReturnsFalse(t *testing.T) {
	testDB.TruncateAll(t)
	repo := repository.NewPostgresOpeningExplorerCacheRepo(testDB.Pool)

	got, found, err := repo.Get(context.Background(), "missing-key")
	require.NoError(t, err)
	assert.False(t, found)
	assert.Nil(t, got)
}

func TestOpeningExplorerCache_Get_ExpiredEntryIsMiss(t *testing.T) {
	testDB.TruncateAll(t)
	repo := repository.NewPostgresOpeningExplorerCacheRepo(testDB.Pool)

	ctx := context.Background()
	key := "stale-key"
	require.NoError(t, repo.Put(ctx, key, []byte(`{"white":0,"draws":0,"black":0,"moves":[]}`), time.Now().Add(-1*time.Minute)))

	_, found, err := repo.Get(ctx, key)
	require.NoError(t, err)
	assert.False(t, found, "expired entries must be treated as cache misses")
}

func TestOpeningExplorerCache_Put_OverwritesExistingKey(t *testing.T) {
	testDB.TruncateAll(t)
	repo := repository.NewPostgresOpeningExplorerCacheRepo(testDB.Pool)

	ctx := context.Background()
	key := "dup-key"
	require.NoError(t, repo.Put(ctx, key, []byte(`{"white":1,"draws":0,"black":0,"moves":[]}`), time.Now().Add(time.Hour)))
	require.NoError(t, repo.Put(ctx, key, []byte(`{"white":99,"draws":0,"black":0,"moves":[]}`), time.Now().Add(time.Hour)))

	got, found, err := repo.Get(ctx, key)
	require.NoError(t, err)
	require.True(t, found)
	assert.JSONEq(t, `{"white":99,"draws":0,"black":0,"moves":[]}`, string(got))
}
