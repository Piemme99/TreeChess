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

	score := 0.5
	if game.Winner == color {
		score = 1
	} else if game.Winner != "" {
		score = 0
	}
	return newPlayedGame("lichess", game.ID, color, strings.Fields(game.Moves), score, player.Rating, time.UnixMilli(game.LastMoveAt))
}

// newPlayedGame réduit une partie à ses 80 premiers demi-coups, tous validés ; false si elle n'en a aucun de légal.
func newPlayedGame(source, id, color string, sans []string, score float64, rating int, endedAt time.Time) (models.PlayedGame, bool) {
	if len(sans) > playedGameMaxPlies {
		sans = sans[:playedGameMaxPlies]
	}
	if len(sans) == 0 {
		return models.PlayedGame{}, false
	}
	// Decode ne rend qu'un coup légal ; Game.MoveStr le revaliderait et chercherait l'issue de la partie à chaque coup,
	// ce qui multiplie par 19 le temps d'un import (2 min 40 au lieu de 8 s pour les 6 380 parties Chess.com de PMG).
	position := chess.StartingPosition()
	for _, san := range sans {
		move, err := chess.AlgebraicNotation{}.Decode(position, san)
		if err != nil {
			return models.PlayedGame{}, false
		}
		position = position.Update(move)
	}
	var kept *int
	if rating > 0 {
		kept = &rating
	}
	return models.PlayedGame{
		Source:   source,
		SourceID: id,
		Color:    color,
		Moves:    strings.Join(sans, " "),
		Score:    score,
		Rating:   kept,
		PlayedAt: endedAt.UTC().Format("2006-01-02"),
	}, true
}

// PlayedGameStore garde les parties importées et l'état de l'import.
type PlayedGameStore interface {
	SaveGames(ctx context.Context, userID string, games []models.PlayedGame) (int, error)
	LastPlayedOn(ctx context.Context, userID, source string) (string, error)
	ListGames(ctx context.Context, userID string) ([]models.PlayedGame, error)
	GetImport(ctx context.Context, userID string) (*models.PlayedGameImport, error)
	StartImport(ctx context.Context, userID string) (bool, error)
	UpdateProgress(ctx context.Context, userID string, imported int) error
	// FinishImport : `born` dit que les parties Lichess sont toutes là, de quoi faire naître le répertoire.
	FinishImport(ctx context.Context, userID string, imported int, failure string, born bool) error
	ChesscomUsername(ctx context.Context, userID string) (string, error)
	// LinkChesscom garde le compte Chess.com du joueur ; false s'il en a déjà un autre.
	LinkChesscom(ctx context.Context, userID, username string) (bool, error)
	// UnlinkChesscom oublie le compte Chess.com et ses parties.
	UnlinkChesscom(ctx context.Context, userID string) error
}

// LichessGameStreamer lit les parties d'un joueur commencées depuis `since` (ms, 0 pour toutes), une à une.
type LichessGameStreamer interface {
	StreamGames(ctx context.Context, username, token string, since int64, each func(LichessExportedGame) error) error
}

type PlayedGameImportService struct {
	store    PlayedGameStore
	streamer LichessGameStreamer
	chesscom ChesscomGames
}

func NewPlayedGameImportService(store PlayedGameStore, streamer LichessGameStreamer, chesscom ChesscomGames) *PlayedGameImportService {
	return &PlayedGameImportService{store: store, streamer: streamer, chesscom: chesscom}
}

// Start lance l'import des parties Lichess du joueur, puis Chess.com s'il en a donné le compte, en tâche de fond ; un
// import en cours n'est pas doublé. Après le premier, seules les parties depuis la plus récente connue sont lues.
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
	return s.Status(ctx, user.ID)
}

// Status rend l'état du dernier import, « none » s'il n'y en a pas eu, avec le compte Chess.com.
func (s *PlayedGameImportService) Status(ctx context.Context, userID string) (*models.PlayedGameImport, error) {
	state, err := s.store.GetImport(ctx, userID)
	if err != nil {
		return nil, err
	}
	if state == nil {
		state = &models.PlayedGameImport{Status: models.PlayedGameImportNone}
	}
	if state.Chesscom, err = s.store.ChesscomUsername(ctx, userID); err != nil {
		return nil, err
	}
	return state, nil
}

func (s *PlayedGameImportService) Games(ctx context.Context, userID string) ([]models.PlayedGame, error) {
	return s.store.ListGames(ctx, userID)
}

func (s *PlayedGameImportService) run(userID, username, token string) {
	// Hors de toute requête : l'import continue si le joueur quitte la page.
	ctx, cancel := context.WithTimeout(context.Background(), playedGameTimeout)
	defer cancel()

	saver := &gameSaver{store: s.store, ctx: ctx, userID: userID}
	var failed []string
	lichessErr := s.fromLichess(ctx, saver, username, token)
	if lichessErr != nil {
		slog.Error("played game import failed", "user", userID, "source", "lichess", "error", lichessErr)
		failed = append(failed, "Lichess")
	}
	// Lu ici, pas au lancement : un compte lié pendant la lecture de Lichess est encore pris.
	chesscom, err := s.store.ChesscomUsername(ctx, userID)
	if err != nil {
		slog.Error("played game import: cannot read the chess.com account", "user", userID, "error", err)
		failed = append(failed, "Chess.com")
	}
	if chesscom != "" {
		if err := s.fromChesscom(ctx, saver, chesscom); err != nil {
			slog.Error("played game import failed", "user", userID, "source", "chesscom", "error", err)
			failed = append(failed, "Chess.com")
		}
	}
	failure := ""
	if len(failed) > 0 {
		failure = strings.Join(failed, " and ") + " did not send all your games. Try again in a few minutes."
	}
	// Un échec Chess.com ne retient pas le joueur sur l'écran d'import : ses parties Lichess suffisent pour commencer.
	if finishErr := s.store.FinishImport(context.Background(), userID, saver.imported, failure, lichessErr == nil); finishErr != nil {
		slog.Error("played game import: cannot record the end", "user", userID, "error", finishErr)
	}
}

func (s *PlayedGameImportService) fromLichess(ctx context.Context, saver *gameSaver, username, token string) error {
	last, err := s.store.LastPlayedOn(ctx, saver.userID, "lichess")
	if err != nil {
		return err
	}
	var since int64
	if day, ok := dayBefore(last); ok {
		since = day.UnixMilli()
	}
	err = s.streamer.StreamGames(ctx, username, token, since, func(game LichessExportedGame) error {
		if played, ok := PlayedGameFromLichess(game, username); ok {
			return saver.add(played)
		}
		return nil
	})
	if err != nil {
		return err
	}
	return saver.flush()
}

func (s *PlayedGameImportService) fromChesscom(ctx context.Context, saver *gameSaver, username string) error {
	last, err := s.store.LastPlayedOn(ctx, saver.userID, "chesscom")
	if err != nil {
		return err
	}
	var since time.Time
	if day, ok := dayBefore(last); ok {
		since = day
	}
	err = s.chesscom.StreamGames(ctx, username, since, func(game ChesscomGame) error {
		if played, ok := PlayedGameFromChesscom(game, username); ok {
			return saver.add(played)
		}
		return nil
	})
	if err != nil {
		return err
	}
	return saver.flush()
}

// dayBefore rend la veille de la partie la plus récente d'une source : une partie commencée avant minuit et finie
// après est relue, les doublons sont écartés à l'enregistrement.
func dayBefore(last string) (time.Time, bool) {
	day, err := time.Parse("2006-01-02", last)
	if err != nil {
		return time.Time{}, false
	}
	return day.AddDate(0, 0, -1), true
}

// gameSaver enregistre les parties par lots et compte, toutes sources confondues, celles qui sont nouvelles.
type gameSaver struct {
	store    PlayedGameStore
	ctx      context.Context
	userID   string
	batch    []models.PlayedGame
	imported int
}

func (g *gameSaver) add(game models.PlayedGame) error {
	g.batch = append(g.batch, game)
	if len(g.batch) >= playedGameBatch {
		return g.flush()
	}
	return nil
}

func (g *gameSaver) flush() error {
	if len(g.batch) == 0 {
		return nil
	}
	added, err := g.store.SaveGames(g.ctx, g.userID, g.batch)
	g.batch = g.batch[:0]
	if err != nil {
		return err
	}
	g.imported += added
	return g.store.UpdateProgress(g.ctx, g.userID, g.imported)
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
