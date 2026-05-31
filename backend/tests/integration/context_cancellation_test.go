//go:build integration

package integration

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/kumquat/backend/internal/repository"
	"github.com/kumquat/backend/internal/testhelpers"
)

// TestContextCancellation_AbortsQuery verifies the issue's core acceptance
// criterion: cancelling the context a repository call is given aborts the
// underlying DB work instead of letting it run to completion. We cancel the
// context before issuing the query so pgx observes the cancellation and the
// repo call returns a context.Canceled-wrapped error rather than data.
func TestContextCancellation_AbortsQuery(t *testing.T) {
	testDB.TruncateAll(t)

	repos := testDB.Repos()
	user := testhelpers.SeedUser(t, repos, "ctxcancel", "password123")

	repo := repository.NewPostgresRepertoireRepo(testDB.Pool)

	// A live context returns data normally.
	if _, err := repo.GetByColor(context.Background(), user.ID, "white"); err != nil {
		t.Fatalf("baseline query failed: %v", err)
	}

	// A cancelled context must abort the query: pgx checks the context before
	// and during execution, so the call returns a context.Canceled error.
	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	_, err := repo.GetByColor(ctx, user.ID, "white")
	require.Error(t, err, "query with a cancelled context must fail")
	assert.ErrorIs(t, err, context.Canceled, "cancellation must propagate to the DB layer")
}

// TestContextCancellation_CountAborts exercises a second repo method through the
// same shared dbContext helper to confirm the propagation is not specific to a
// single query path.
func TestContextCancellation_CountAborts(t *testing.T) {
	testDB.TruncateAll(t)

	repos := testDB.Repos()
	user := testhelpers.SeedUser(t, repos, "ctxcancelcount", "password123")

	repo := repository.NewPostgresRepertoireRepo(testDB.Pool)

	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	_, err := repo.Count(ctx, user.ID)
	require.Error(t, err)
	assert.ErrorIs(t, err, context.Canceled)
}
