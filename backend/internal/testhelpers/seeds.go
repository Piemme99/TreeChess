//go:build integration

package testhelpers

import (
	"context"
	"testing"

	"github.com/kumquat/backend/internal/models"
)

// SeedUser creates a user straight in the repository, as the Lichess OAuth
// callback does on a first sign-in.
func SeedUser(t *testing.T, repos *Repos, username string) *models.User {
	t.Helper()
	user, err := repos.User.CreateOAuth(context.Background(), "lichess", "lichess-"+username, username)
	if err != nil {
		t.Fatalf("SeedUser: %v", err)
	}
	return user
}
