//go:build integration

package integration

import (
	"context"
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/kumquat/backend/config"
	"github.com/kumquat/backend/internal/repository"
	"github.com/kumquat/backend/internal/testhelpers"
)

var testDB *testhelpers.TestDB

func TestMain(m *testing.M) {
	testDB = testhelpers.MustSetupTestDB()
	code := m.Run()
	testDB.Teardown()
	os.Exit(code)
}

func tableExists(t *testing.T, table string) bool {
	t.Helper()
	var exists bool
	err := testDB.Pool.QueryRow(context.Background(), "SELECT to_regclass($1) IS NOT NULL", "public."+table).Scan(&exists)
	require.NoError(t, err)
	return exists
}

func TestMigrations_DropV1TablesAndKeepV2Data(t *testing.T) {
	testDB.TruncateAll(t)
	repos := testDB.Repos()
	user := testhelpers.SeedUser(t, repos, "survivor")
	ctx := context.Background()

	_, err := testDB.Pool.Exec(ctx, `CREATE TABLE repertoires (id UUID PRIMARY KEY, user_id UUID REFERENCES users(id))`)
	require.NoError(t, err)
	_, err = testDB.Pool.Exec(ctx, `INSERT INTO repertoires VALUES (gen_random_uuid(), $1)`, user.ID)
	require.NoError(t, err)

	db, err := repository.NewDB(config.Config{DatabaseURL: testDB.Pool.Config().ConnString()})
	require.NoError(t, err)
	db.Close()

	assert.False(t, tableExists(t, "repertoires"))
	for _, table := range []string{"users", "refresh_tokens", "password_reset_tokens", "opening_explorer_cache", "played_games", "played_game_imports", "player_state"} {
		assert.True(t, tableExists(t, table), table)
	}
	got, err := repos.User.GetByID(ctx, user.ID)
	require.NoError(t, err)
	assert.Equal(t, "survivor", got.Username)
}
