package repository

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/kumquat/backend/config"
)

func TestNewDB_InvalidURL(t *testing.T) {
	cfg := config.Config{
		DatabaseURL: "invalid-url",
		Port:        8080,
	}

	db, err := NewDB(cfg)

	assert.Error(t, err)
	assert.Nil(t, db)
	assert.Contains(t, err.Error(), "failed to parse database URL")
}

func TestDB_Close_NilPool(t *testing.T) {
	// Test that Close doesn't panic when pool is nil
	db := &DB{Pool: nil}
	db.Close() // Should not panic
}

// TestDBContext_PropagatesCancellation verifies that the per-query context
// derived by dbContext is cancelled as soon as the caller's parent context is
// cancelled. This is the mechanism that lets an aborted/abandoned request
// (whose request context is cancelled) abort the in-flight DB work it spawned,
// rather than letting it churn the connection pool to completion.
func TestDBContext_PropagatesCancellation(t *testing.T) {
	parent, cancelParent := context.WithCancel(context.Background())

	ctx, cancel := dbContext(parent)
	defer cancel()

	// Not yet cancelled.
	require.NoError(t, ctx.Err())

	// Cancelling the parent must immediately cancel the derived query context.
	cancelParent()

	select {
	case <-ctx.Done():
		assert.ErrorIs(t, ctx.Err(), context.Canceled)
	case <-time.After(time.Second):
		t.Fatal("derived context was not cancelled when parent was cancelled")
	}
}

// TestDBContext_AppliesDefaultTimeout verifies that dbContext still bounds the
// query by the default DB timeout (so a slow query cannot run unbounded) while
// deriving from the caller's context.
func TestDBContext_AppliesDefaultTimeout(t *testing.T) {
	ctx, cancel := dbContext(context.Background())
	defer cancel()

	deadline, ok := ctx.Deadline()
	require.True(t, ok, "derived context must carry a deadline")
	assert.WithinDuration(t, time.Now().Add(config.DefaultDBTimeout), deadline, time.Second)
}

// TestDBContext_AlreadyCancelledParent verifies that deriving from an
// already-cancelled parent yields an already-cancelled query context, so a repo
// call made after the caller gave up returns context.Canceled without touching
// the database.
func TestDBContext_AlreadyCancelledParent(t *testing.T) {
	parent, cancelParent := context.WithCancel(context.Background())
	cancelParent()

	ctx, cancel := dbContext(parent)
	defer cancel()

	assert.True(t, errors.Is(ctx.Err(), context.Canceled))
}
