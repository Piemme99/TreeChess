//go:build integration

package testhelpers

import (
	"context"
	"testing"

	"golang.org/x/crypto/bcrypt"

	"github.com/kumquat/backend/internal/models"
)

// SeedUser creates a user with the given credentials using bcrypt.MinCost for speed.
func SeedUser(t *testing.T, repos *Repos, username, password string) *models.User {
	t.Helper()
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.MinCost)
	if err != nil {
		t.Fatalf("SeedUser: bcrypt: %v", err)
	}
	email := username + "@test.com"
	user, err := repos.User.Create(context.Background(), email, username, string(hash))
	if err != nil {
		t.Fatalf("SeedUser: %v", err)
	}
	return user
}
