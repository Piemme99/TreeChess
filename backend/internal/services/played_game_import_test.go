package services

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/kumquat/backend/internal/models"
)

func lichessGame(speed, white, black, winner, moves string) LichessExportedGame {
	game := LichessExportedGame{ID: "g1", Variant: "standard", Speed: speed, Status: "mate", LastMoveAt: 1767225600000, Winner: winner, Moves: moves}
	game.Players.White.User.Name = white
	game.Players.White.Rating = 1810
	game.Players.Black.User.Name = black
	game.Players.Black.Rating = 1790
	return game
}

func TestPlayedGameFromLichess_KeepsBlitzRapidClassical_LeavesBulletOut(t *testing.T) {
	for _, speed := range []string{"blitz", "rapid", "classical"} {
		_, ok := PlayedGameFromLichess(lichessGame(speed, "Piemme78", "rival", "white", "e4 e5"), "piemme78")
		assert.True(t, ok, speed)
	}
	for _, speed := range []string{"bullet", "ultraBullet", "correspondence"} {
		_, ok := PlayedGameFromLichess(lichessGame(speed, "Piemme78", "rival", "white", "e4 e5"), "piemme78")
		assert.False(t, ok, speed)
	}
}

func TestPlayedGameFromLichess_ScoresFromThePlayersSide(t *testing.T) {
	won, _ := PlayedGameFromLichess(lichessGame("blitz", "rival", "Piemme78", "black", "e4 e5"), "Piemme78")
	assert.Equal(t, "black", won.Color)
	assert.Equal(t, 1.0, won.Score)
	assert.Equal(t, 1790, *won.Rating)

	lost, _ := PlayedGameFromLichess(lichessGame("blitz", "Piemme78", "rival", "black", "e4 e5"), "Piemme78")
	assert.Equal(t, "white", lost.Color)
	assert.Equal(t, 0.0, lost.Score)

	drawn, _ := PlayedGameFromLichess(lichessGame("blitz", "Piemme78", "rival", "", "e4 e5"), "Piemme78")
	assert.Equal(t, 0.5, drawn.Score)
	assert.Equal(t, "2026-01-01", drawn.PlayedAt)
}

func TestPlayedGameFromLichess_KeepsTheFirst80Plies(t *testing.T) {
	// Les cavaliers vont et viennent : 100 demi-coups légaux.
	cycle := []string{"Nf3", "Nf6", "Ng1", "Ng8"}
	moves := make([]string, 0, 100)
	for len(moves) < 100 {
		moves = append(moves, cycle[len(moves)%4])
	}
	game, ok := PlayedGameFromLichess(lichessGame("rapid", "Piemme78", "rival", "", strings.Join(moves, " ")), "Piemme78")
	require.True(t, ok)
	assert.Len(t, strings.Fields(game.Moves), 80)
}

func TestPlayedGameFromLichess_LeavesOutWhatIsNotAPlayedGame(t *testing.T) {
	illegal := lichessGame("blitz", "Piemme78", "rival", "white", "e4 e4")
	aborted := lichessGame("blitz", "Piemme78", "rival", "", "e4")
	aborted.Status = "aborted"
	variant := lichessGame("blitz", "Piemme78", "rival", "white", "e4 e5")
	variant.Variant = "chess960"
	someoneElse := lichessGame("blitz", "a", "b", "white", "e4 e5")
	for name, game := range map[string]LichessExportedGame{"illegal": illegal, "aborted": aborted, "variant": variant, "someone else": someoneElse} {
		_, ok := PlayedGameFromLichess(game, "Piemme78")
		assert.False(t, ok, name)
	}
}

type fakePlayedGameStore struct {
	mu       sync.Mutex
	saved    []models.PlayedGame
	progress []int
	failure  *string
	running  bool
}

func (f *fakePlayedGameStore) SaveGames(_ context.Context, _ string, games []models.PlayedGame) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.saved = append(f.saved, games...)
	return nil
}
func (f *fakePlayedGameStore) ListGames(context.Context, string) ([]models.PlayedGame, error) {
	return f.saved, nil
}
func (f *fakePlayedGameStore) GetImport(context.Context, string) (*models.PlayedGameImport, error) {
	return &models.PlayedGameImport{Status: models.PlayedGameImportRunning}, nil
}
func (f *fakePlayedGameStore) StartImport(context.Context, string) (bool, error) {
	if f.running {
		return false, nil
	}
	f.running = true
	return true, nil
}
func (f *fakePlayedGameStore) UpdateProgress(_ context.Context, _ string, imported int) error {
	f.progress = append(f.progress, imported)
	return nil
}
func (f *fakePlayedGameStore) FinishImport(_ context.Context, _ string, _ int, failure string) error {
	f.failure = &failure
	return nil
}

type fakeStreamer struct {
	games []LichessExportedGame
	err   error
}

func (f fakeStreamer) StreamGames(_ context.Context, _, _ string, each func(LichessExportedGame) error) error {
	for _, game := range f.games {
		if err := each(game); err != nil {
			return err
		}
	}
	return f.err
}

func TestPlayedGameImportService_Start_NeedsALinkedLichessAccount(t *testing.T) {
	svc := NewPlayedGameImportService(&fakePlayedGameStore{}, fakeStreamer{})
	_, err := svc.Start(context.Background(), &models.User{ID: "u1"})
	assert.ErrorIs(t, err, ErrLichessNotLinked)
}

func TestPlayedGameImportService_Run_SavesTheKeptGamesAndRecordsTheEnd(t *testing.T) {
	games := make([]LichessExportedGame, 0, 450)
	for i := 0; i < 450; i++ {
		speed := "blitz"
		if i%3 == 0 {
			speed = "bullet"
		}
		games = append(games, lichessGame(speed, "Piemme78", "rival", "white", "e4 e5"))
	}
	store := &fakePlayedGameStore{}
	NewPlayedGameImportService(store, fakeStreamer{games: games}).run("u1", "Piemme78", "token")

	assert.Len(t, store.saved, 300)
	assert.Equal(t, []int{100, 200, 300}, store.progress)
	require.NotNil(t, store.failure)
	assert.Empty(t, *store.failure)
}

func TestPlayedGameImportService_Run_RecordsAFailedImport(t *testing.T) {
	store := &fakePlayedGameStore{}
	NewPlayedGameImportService(store, fakeStreamer{err: errors.New("HTTP 429")}).run("u1", "Piemme78", "token")
	require.NotNil(t, store.failure)
	assert.NotEmpty(t, *store.failure)
}

func TestLichessGameExport_StreamGames_ReadsTheNDJSONExportWithTheToken(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "/games/user/Piemme78", r.URL.Path)
		assert.Equal(t, "Bearer secret", r.Header.Get("Authorization"))
		assert.Equal(t, "blitz,rapid,classical", r.URL.Query().Get("perfType"))
		_, _ = w.Write([]byte(`{"id":"a","variant":"standard","speed":"blitz","moves":"e4 e5"}` + "\n\n" + `{"id":"b","variant":"standard","speed":"rapid","moves":"d4"}` + "\n"))
	}))
	defer server.Close()

	var ids []string
	err := NewLichessGameExport(server.URL, server.Client()).StreamGames(context.Background(), "Piemme78", "secret", func(game LichessExportedGame) error {
		ids = append(ids, game.ID)
		return nil
	})
	require.NoError(t, err)
	assert.Equal(t, []string{"a", "b"}, ids)
}
