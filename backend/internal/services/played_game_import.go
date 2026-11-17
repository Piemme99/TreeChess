package services

import (
	"bufio"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/notnil/chess"

	"github.com/kumquat/backend/internal/models"
)

// ErrLichessNotLinked : l'import lit les parties du compte Lichess connecté, avec son jeton.
var ErrLichessNotLinked = errors.New("lichess account not linked")

const (
	// L'arbre des ouvertures lit 24 coups ; au-delà, la vue d'une ligne lit où la partie se décide.
	playedGameMaxPlies = 80
	playedGameBatch    = 100
	playedGameTimeout  = 20 * time.Minute
)

// Le bullet est trop rapide pour suivre une préparation : il est laissé de côté, comme dans les parties de démo.
var playedGameSpeeds = map[string]bool{"blitz": true, "rapid": true, "classical": true}

// LichessExportedGame est une ligne de l'export NDJSON de Lichess (GET /api/games/user/{username}).
type LichessExportedGame struct {
	ID         string `json:"id"`
	Variant    string `json:"variant"`
	Speed      string `json:"speed"`
	Status     string `json:"status"`
	LastMoveAt int64  `json:"lastMoveAt"`
	Winner     string `json:"winner"`
	Moves      string `json:"moves"`
	Players    struct {
		White lichessExportedPlayer `json:"white"`
		Black lichessExportedPlayer `json:"black"`
	} `json:"players"`
}

type lichessExportedPlayer struct {
	User struct {
		Name string `json:"name"`
	} `json:"user"`
	Rating int `json:"rating"`
}

// PlayedGameFromLichess garde une partie d'échecs standard en blitz, rapide ou classique, finie, jouée par
// `username`, réduite à ses 80 premiers demi-coups validés ; false sinon.
func PlayedGameFromLichess(game LichessExportedGame, username string) (models.PlayedGame, bool) {
	if game.Variant != "standard" || !playedGameSpeeds[game.Speed] {
		return models.PlayedGame{}, false
	}
	switch game.Status {
	case "created", "started", "aborted", "noStart", "unknownFinish":
		return models.PlayedGame{}, false
	}
	var color string
	var player lichessExportedPlayer
	switch {
	case strings.EqualFold(game.Players.White.User.Name, username):
		color, player = "white", game.Players.White
	case strings.EqualFold(game.Players.Black.User.Name, username):
		color, player = "black", game.Players.Black
	default:
		return models.PlayedGame{}, false
	}

	sans := strings.Fields(game.Moves)
	if len(sans) > playedGameMaxPlies {
		sans = sans[:playedGameMaxPlies]
	}
	if len(sans) == 0 {
		return models.PlayedGame{}, false
	}
	board := chess.NewGame()
	for _, san := range sans {
		if err := board.MoveStr(san); err != nil {
			return models.PlayedGame{}, false
		}
	}

	score := 0.5
	if game.Winner == color {
		score = 1
	} else if game.Winner != "" {
		score = 0
	}
	var rating *int
	if player.Rating > 0 {
		rating = &player.Rating
	}
	return models.PlayedGame{
		Source:   "lichess",
		SourceID: game.ID,
		Color:    color,
		Moves:    strings.Join(sans, " "),
		Score:    score,
		Rating:   rating,
		PlayedAt: time.UnixMilli(game.LastMoveAt).UTC().Format("2006-01-02"),
	}, true
}

// PlayedGameStore garde les parties importées et l'état de l'import.
type PlayedGameStore interface {
	SaveGames(ctx context.Context, userID string, games []models.PlayedGame) (int, error)
	LastPlayedOn(ctx context.Context, userID string) (string, error)
	ListGames(ctx context.Context, userID string) ([]models.PlayedGame, error)
	GetImport(ctx context.Context, userID string) (*models.PlayedGameImport, error)
	StartImport(ctx context.Context, userID string) (bool, error)
	UpdateProgress(ctx context.Context, userID string, imported int) error
	FinishImport(ctx context.Context, userID string, imported int, failure string) error
}

// LichessGameStreamer lit les parties d'un joueur commencées depuis `since` (ms, 0 pour toutes), une à une.
type LichessGameStreamer interface {
	StreamGames(ctx context.Context, username, token string, since int64, each func(LichessExportedGame) error) error
}

type PlayedGameImportService struct {
	store    PlayedGameStore
	streamer LichessGameStreamer
}

func NewPlayedGameImportService(store PlayedGameStore, streamer LichessGameStreamer) *PlayedGameImportService {
	return &PlayedGameImportService{store: store, streamer: streamer}
}

// Start lance l'import des parties Lichess du joueur en tâche de fond ; un import en cours n'est pas doublé. Après le
// premier, seules les parties depuis la plus récente connue sont lues.
func (s *PlayedGameImportService) Start(ctx context.Context, user *models.User) (*models.PlayedGameImport, error) {
	if user.LichessUsername == nil || *user.LichessUsername == "" || user.LichessAccessToken == nil || *user.LichessAccessToken == "" {
		return nil, ErrLichessNotLinked
	}
	started, err := s.store.StartImport(ctx, user.ID)
	if err != nil {
		return nil, err
	}
	if started {
		go s.run(user.ID, *user.LichessUsername, *user.LichessAccessToken)
	}
	return s.store.GetImport(ctx, user.ID)
}

func (s *PlayedGameImportService) Status(ctx context.Context, userID string) (*models.PlayedGameImport, error) {
	return s.store.GetImport(ctx, userID)
}

func (s *PlayedGameImportService) Games(ctx context.Context, userID string) ([]models.PlayedGame, error) {
	return s.store.ListGames(ctx, userID)
}

func (s *PlayedGameImportService) run(userID, username, token string) {
	// Hors de toute requête : l'import continue si le joueur quitte la page.
	ctx, cancel := context.WithTimeout(context.Background(), playedGameTimeout)
	defer cancel()

	since, err := s.since(ctx, userID)
	if err != nil {
		slog.Error("played game import: cannot read the last game", "user", userID, "error", err)
	}
	imported := 0
	batch := make([]models.PlayedGame, 0, playedGameBatch)
	flush := func() error {
		if len(batch) == 0 {
			return nil
		}
		added, err := s.store.SaveGames(ctx, userID, batch)
		if err != nil {
			return err
		}
		imported += added
		batch = batch[:0]
		return s.store.UpdateProgress(ctx, userID, imported)
	}
	err = s.streamer.StreamGames(ctx, username, token, since, func(game LichessExportedGame) error {
		if played, ok := PlayedGameFromLichess(game, username); ok {
			batch = append(batch, played)
		}
		if len(batch) >= playedGameBatch {
			return flush()
		}
		return nil
	})
	if err == nil {
		err = flush()
	}
	failure := ""
	if err != nil {
		slog.Error("played game import failed", "user", userID, "error", err)
		failure = "Lichess did not send all your games. Try again in a few minutes."
	}
	if finishErr := s.store.FinishImport(context.Background(), userID, imported, failure); finishErr != nil {
		slog.Error("played game import: cannot record the end", "user", userID, "error", finishErr)
	}
}

// since part de la veille de la partie la plus récente : une partie commencée avant minuit et finie après est relue,
// les doublons sont écartés à l'enregistrement.
func (s *PlayedGameImportService) since(ctx context.Context, userID string) (int64, error) {
	last, err := s.store.LastPlayedOn(ctx, userID)
	if err != nil || last == "" {
		return 0, err
	}
	day, err := time.Parse("2006-01-02", last)
	if err != nil {
		return 0, err
	}
	return day.AddDate(0, 0, -1).UnixMilli(), nil
}

// LichessGameExport lit l'export NDJSON des parties d'un joueur.
type LichessGameExport struct {
	baseURL string
	client  *http.Client
}

func NewLichessGameExport(baseURL string, client *http.Client) *LichessGameExport {
	return &LichessGameExport{baseURL: strings.TrimRight(baseURL, "/"), client: client}
}

func (l *LichessGameExport) StreamGames(ctx context.Context, username, token string, since int64, each func(LichessExportedGame) error) error {
	query := url.Values{}
	query.Set("perfType", "blitz,rapid,classical")
	query.Set("finished", "true")
	query.Set("moves", "true")
	query.Set("tags", "false")
	query.Set("clocks", "false")
	query.Set("evals", "false")
	query.Set("opening", "false")
	// Du plus ancien au plus récent : un import coupé en route ne laisse pas de trou avant la partie la plus récente
	// enregistrée, d'où l'import suivant repart.
	query.Set("sort", "dateAsc")
	if since > 0 {
		query.Set("since", strconv.FormatInt(since, 10))
	}
	endpoint := fmt.Sprintf("%s/games/user/%s?%s", l.baseURL, url.PathEscape(username), query.Encode())
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return err
	}
	req.Header.Set("Accept", "application/x-ndjson")
	req.Header.Set("Authorization", "Bearer "+token)
	resp, err := l.client.Do(req)
	if err != nil {
		return fmt.Errorf("lichess games export: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("lichess games export: HTTP %d", resp.StatusCode)
	}
	scanner := bufio.NewScanner(resp.Body)
	scanner.Buffer(make([]byte, 64*1024), 1024*1024)
	for scanner.Scan() {
		line := scanner.Bytes()
		if len(line) == 0 {
			continue
		}
		var game LichessExportedGame
		if err := json.Unmarshal(line, &game); err != nil {
			return fmt.Errorf("lichess games export: %w", err)
		}
		if err := each(game); err != nil {
			return err
		}
	}
	return scanner.Err()
}
