package services

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/kumquat/backend/internal/models"
)

const chesscomPGN = `[Event "Live Chess"]
[Site "Chess.com"]
[White "Piemme78"]
[Black "rival"]
[Result "1-0"]

1. e4 {[%clk 0:02:59.9]} 1... c5 {[%clk 0:02:58.3]} 2. Nf3 {[%clk 0:02:57]} 2... d6 {[%clk 0:02:55]} 3. d4 $1 {[%clk 0:02:54]} 3... cxd4 4. Nxd4 1-0`

func chesscomGame(timeClass, white, black, whiteResult, blackResult string) ChesscomGame {
	return ChesscomGame{
		UUID: "uuid-1", PGN: chesscomPGN, TimeClass: timeClass, Rules: "chess", EndTime: 1767225600,
		White: chesscomPlayer{Username: white, Rating: 1163, Result: whiteResult},
		Black: chesscomPlayer{Username: black, Rating: 1190, Result: blackResult},
	}
}

func TestPlayedGameFromChesscom_ReadsTheMovesOfThePGN(t *testing.T) {
	game, ok := PlayedGameFromChesscom(chesscomGame("blitz", "Piemme78", "rival", "win", "resigned"), "piemme78")
	require.True(t, ok)
	assert.Equal(t, models.PlayedGame{Source: "chesscom", SourceID: "uuid-1", Color: "white", Moves: "e4 c5 Nf3 d6 d4 cxd4 Nxd4", Score: 1, Rating: game.Rating, PlayedAt: "2026-01-01"}, game)
	assert.Equal(t, 1163, *game.Rating)
}

func TestPlayedGameFromChesscom_KeepsBlitzAndRapid_LeavesBulletAndDailyOut(t *testing.T) {
	for _, timeClass := range []string{"blitz", "rapid"} {
		_, ok := PlayedGameFromChesscom(chesscomGame(timeClass, "Piemme78", "rival", "win", "resigned"), "Piemme78")
		assert.True(t, ok, timeClass)
	}
	for _, timeClass := range []string{"bullet", "daily"} {
		_, ok := PlayedGameFromChesscom(chesscomGame(timeClass, "Piemme78", "rival", "win", "resigned"), "Piemme78")
		assert.False(t, ok, timeClass)
	}
}

func TestPlayedGameFromChesscom_ScoresFromThePlayersSide(t *testing.T) {
	cases := map[string]float64{"win": 1, "agreed": 0.5, "repetition": 0.5, "stalemate": 0.5, "timevsinsufficient": 0.5, "checkmated": 0, "timeout": 0, "abandoned": 0}
	for result, score := range cases {
		game, ok := PlayedGameFromChesscom(chesscomGame("rapid", "rival", "Piemme78", "win", result), "Piemme78")
		require.True(t, ok, result)
		assert.Equal(t, "black", game.Color)
		assert.Equal(t, score, game.Score, result)
	}
}

func TestPlayedGameFromChesscom_LeavesOutWhatIsNotAStandardGameOfThePlayer(t *testing.T) {
	variant := chesscomGame("blitz", "Piemme78", "rival", "win", "resigned")
	variant.Rules = "chess960"
	custom := chesscomGame("blitz", "Piemme78", "rival", "win", "resigned")
	custom.InitialSetup = "4k3/8/8/8/8/8/8/4K2R w K - 0 1"
	illegal := chesscomGame("blitz", "Piemme78", "rival", "win", "resigned")
	illegal.PGN = "1. e4 e4"
	empty := chesscomGame("blitz", "Piemme78", "rival", "win", "abandoned")
	empty.PGN = `[Event "Live Chess"]` + "\n\n1-0"
	someoneElse := chesscomGame("blitz", "a", "b", "win", "resigned")
	for name, game := range map[string]ChesscomGame{"variant": variant, "custom start": custom, "illegal": illegal, "no move": empty, "someone else": someoneElse} {
		_, ok := PlayedGameFromChesscom(game, "Piemme78")
		assert.False(t, ok, name)
	}
}

type fakeChesscom struct {
	games  []ChesscomGame
	err    error
	since  *time.Time
	absent bool
}

func (f fakeChesscom) PlayerExists(context.Context, string) (bool, error) {
	return !f.absent, f.err
}

func (f fakeChesscom) StreamGames(_ context.Context, _ string, since time.Time, each func(ChesscomGame) error) error {
	if f.since != nil {
		*f.since = since
	}
	for _, game := range f.games {
		if err := each(game); err != nil {
			return err
		}
	}
	return f.err
}

func TestPlayedGameImportService_Run_AddsTheChesscomGamesAfterTheLichessOnes(t *testing.T) {
	var since time.Time
	store := &fakePlayedGameStore{last: map[string]string{"lichess": "2026-11-15", "chesscom": "2026-09-01"}, chesscom: "Piemme78"}
	lichess := lichessGame("blitz", "Piemme78", "rival", "white", "e4 e5")
	svc := NewPlayedGameImportService(store, fakeStreamer{games: []LichessExportedGame{lichess}}, fakeChesscom{games: []ChesscomGame{chesscomGame("rapid", "Piemme78", "rival", "win", "resigned")}, since: &since})
	svc.run("u1", "Piemme78", "token")

	require.Len(t, store.saved, 2)
	assert.Equal(t, []string{"lichess", "chesscom"}, []string{store.saved[0].Source, store.saved[1].Source})
	assert.Equal(t, "2026-08-31", since.Format("2006-01-02"))
	assert.Empty(t, *store.failure)
}

func TestPlayedGameImportService_Run_KeepsTheLichessGamesWhenChesscomFails(t *testing.T) {
	store := &fakePlayedGameStore{chesscom: "Piemme78"}
	lichess := lichessGame("blitz", "Piemme78", "rival", "white", "e4 e5")
	svc := NewPlayedGameImportService(store, fakeStreamer{games: []LichessExportedGame{lichess}}, fakeChesscom{err: errors.New("HTTP 429")})
	svc.run("u1", "Piemme78", "token")

	assert.Len(t, store.saved, 1)
	assert.Contains(t, *store.failure, "Chess.com")
	assert.NotContains(t, *store.failure, "Lichess")
	assert.True(t, store.born, "a Chess.com failure must not keep the player on the import screen")
}

func linkedUser() *models.User {
	name, token := "Piemme78", "lio_token"
	return &models.User{ID: "u1", LichessUsername: &name, LichessAccessToken: &token}
}

func TestPlayedGameImportService_LinkChesscom_NeedsAnExistingPlayer(t *testing.T) {
	store := &fakePlayedGameStore{running: true}
	svc := NewPlayedGameImportService(store, fakeStreamer{}, fakeChesscom{absent: true})
	for _, username := range []string{"nosuchplayer", "a b", ""} {
		_, err := svc.LinkChesscom(context.Background(), linkedUser(), username)
		assert.ErrorIs(t, err, ErrChesscomPlayerNotFound, username)
	}
	assert.Empty(t, store.chesscom)
}

func TestPlayedGameImportService_LinkChesscom_KeepsTheFirstAccount(t *testing.T) {
	store := &fakePlayedGameStore{running: true, chesscom: "Piemme78"}
	svc := NewPlayedGameImportService(store, fakeStreamer{}, fakeChesscom{})
	_, err := svc.LinkChesscom(context.Background(), linkedUser(), "someoneelse")
	assert.ErrorIs(t, err, ErrChesscomAlreadyLinked)

	state, err := svc.LinkChesscom(context.Background(), linkedUser(), "piemme78")
	require.NoError(t, err)
	assert.Equal(t, "Piemme78", state.Chesscom)
}

func TestPlayedGameImportService_UnlinkChesscom_WaitsForTheRunningImport(t *testing.T) {
	store := &fakePlayedGameStore{chesscom: "Piemme78"}
	svc := NewPlayedGameImportService(store, fakeStreamer{}, fakeChesscom{})
	assert.ErrorIs(t, svc.UnlinkChesscom(context.Background(), "u1"), ErrImportRunning)

	store.state = &models.PlayedGameImport{Status: models.PlayedGameImportDone}
	require.NoError(t, svc.UnlinkChesscom(context.Background(), "u1"))
	assert.Empty(t, store.chesscom)
}

func TestChesscomArchive_StreamGames_ReadsTheMonthsSinceTheGivenDay(t *testing.T) {
	var asked []string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		asked = append(asked, r.URL.Path)
		assert.Contains(t, r.Header.Get("User-Agent"), "Kumquat")
		if strings.HasSuffix(r.URL.Path, "/archives") {
			_, _ = w.Write([]byte(`{"archives":["https://api.chess.com/pub/player/piemme78/games/2026/07","https://api.chess.com/pub/player/piemme78/games/2026/08","https://api.chess.com/pub/player/piemme78/games/2026/09"]}`))
			return
		}
		_, _ = w.Write([]byte(`{"games":[{"uuid":"` + r.URL.Path[len(r.URL.Path)-2:] + `"}]}`))
	}))
	defer server.Close()

	var uuids []string
	err := NewChesscomArchive(server.URL, server.Client()).StreamGames(context.Background(), "Piemme78", time.Date(2026, 8, 31, 0, 0, 0, 0, time.UTC), func(game ChesscomGame) error {
		uuids = append(uuids, game.UUID)
		return nil
	})
	require.NoError(t, err)
	assert.Equal(t, []string{"08", "09"}, uuids)
	assert.Equal(t, []string{"/player/piemme78/games/archives", "/player/piemme78/games/2026/08", "/player/piemme78/games/2026/09"}, asked)
}

func TestChesscomArchive_PlayerExists_SaysNoForAnUnknownName(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/player/piemme78" {
			_, _ = w.Write([]byte(`{"username":"piemme78"}`))
			return
		}
		w.WriteHeader(http.StatusNotFound)
	}))
	defer server.Close()
	archive := NewChesscomArchive(server.URL, server.Client())

	known, err := archive.PlayerExists(context.Background(), "Piemme78")
	require.NoError(t, err)
	assert.True(t, known)
	unknown, err := archive.PlayerExists(context.Background(), "nosuchplayer")
	require.NoError(t, err)
	assert.False(t, unknown)
}
