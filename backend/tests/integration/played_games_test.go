//go:build integration

package integration

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/kumquat/backend/internal/models"
	"github.com/kumquat/backend/internal/testhelpers"
)

func TestPlayedGames_ChesscomAccount_AddsASecondSourceThatCanBeRemoved(t *testing.T) {
	testDB.TruncateAll(t)
	repos := testDB.Repos()
	ctx := context.Background()
	user := testhelpers.SeedUser(t, repos, "pia")

	_, err := repos.PlayedGame.SaveGames(ctx, user.ID, []models.PlayedGame{
		{Source: "lichess", SourceID: "abcd1234", Color: "white", Moves: "e4 e5", Score: 1, PlayedAt: "2026-11-01"},
		{Source: "chesscom", SourceID: "uuid-1", Color: "black", Moves: "e4 c5", Score: 0, PlayedAt: "2026-11-10"},
	})
	require.NoError(t, err)

	last, err := repos.PlayedGame.LastPlayedOn(ctx, user.ID, "lichess")
	require.NoError(t, err)
	assert.Equal(t, "2026-11-01", last, "a newer Chess.com game must not hide the Lichess games in between")

	linked, err := repos.PlayedGame.LinkChesscom(ctx, user.ID, "Piemme78")
	require.NoError(t, err)
	assert.True(t, linked)
	linked, err = repos.PlayedGame.LinkChesscom(ctx, user.ID, "piemme78")
	require.NoError(t, err)
	assert.True(t, linked)
	linked, err = repos.PlayedGame.LinkChesscom(ctx, user.ID, "someoneelse")
	require.NoError(t, err)
	assert.False(t, linked)
	name, err := repos.PlayedGame.ChesscomUsername(ctx, user.ID)
	require.NoError(t, err)
	assert.Equal(t, "Piemme78", name)

	require.NoError(t, repos.PlayedGame.UnlinkChesscom(ctx, user.ID))
	games, err := repos.PlayedGame.ListGames(ctx, user.ID)
	require.NoError(t, err)
	require.Len(t, games, 1)
	assert.Equal(t, "lichess", games[0].Source)
	name, err = repos.PlayedGame.ChesscomUsername(ctx, user.ID)
	require.NoError(t, err)
	assert.Empty(t, name)
}
