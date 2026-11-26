package services

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"time"

	"github.com/kumquat/backend/internal/models"
)

var (
	ErrChesscomPlayerNotFound = errors.New("chess.com player not found")
	ErrChesscomAlreadyLinked  = errors.New("another chess.com account is already linked")
	ErrChesscomUnreachable    = errors.New("chess.com did not answer")
	ErrImportRunning          = errors.New("an import is running")
)

// Les pseudos Chess.com : lettres, chiffres, tirets et soulignés, de 3 à 25 caractères.
var chesscomUsernamePattern = regexp.MustCompile(`^[A-Za-z0-9_-]{3,25}$`)

// Chess.com n'a pas de cadence classique, et le « daily » (un coup par jour) se joue livre ouvert.
var chesscomTimeClasses = map[string]bool{"blitz": true, "rapid": true}

var chesscomDraws = map[string]bool{
	"agreed": true, "repetition": true, "stalemate": true, "insufficient": true, "50move": true, "timevsinsufficient": true,
}

const standardStart = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"

// ChesscomGame est une partie d'une archive mensuelle de l'API publique de Chess.com.
type ChesscomGame struct {
	UUID         string         `json:"uuid"`
	PGN          string         `json:"pgn"`
	TimeClass    string         `json:"time_class"`
	Rules        string         `json:"rules"`
	EndTime      int64          `json:"end_time"`
	InitialSetup string         `json:"initial_setup"`
	White        chesscomPlayer `json:"white"`
	Black        chesscomPlayer `json:"black"`
}

type chesscomPlayer struct {
	Username string `json:"username"`
	Rating   int    `json:"rating"`
	Result   string `json:"result"`
}

// PlayedGameFromChesscom garde une partie d'échecs standard en blitz ou en rapide jouée par `username`, réduite à ses
// 80 premiers demi-coups validés ; false sinon.
func PlayedGameFromChesscom(game ChesscomGame, username string) (models.PlayedGame, bool) {
	if game.Rules != "chess" || !chesscomTimeClasses[game.TimeClass] || (game.InitialSetup != "" && game.InitialSetup != standardStart) {
		return models.PlayedGame{}, false
	}
	var color string
	var player chesscomPlayer
	switch {
	case strings.EqualFold(game.White.Username, username):
		color, player = "white", game.White
	case strings.EqualFold(game.Black.Username, username):
		color, player = "black", game.Black
	default:
		return models.PlayedGame{}, false
	}
	score := 0.0
	if player.Result == "win" {
		score = 1
	} else if chesscomDraws[player.Result] {
		score = 0.5
	}
	return newPlayedGame("chesscom", game.UUID, color, movesOfPGN(game.PGN), score, player.Rating, time.Unix(game.EndTime, 0))
}

var (
	pgnComment   = regexp.MustCompile(`\{[^}]*\}`)
	pgnVariation = regexp.MustCompile(`\([^()]*\)`)
	pgnNumber    = regexp.MustCompile(`^\d+\.+`)
)

// movesOfPGN rend les coups en SAN du PGN d'une partie, sans en-têtes, horloges, lignes secondaires, numéros ni résultat.
func movesOfPGN(pgn string) []string {
	var text strings.Builder
	for _, line := range strings.Split(pgn, "\n") {
		if !strings.HasPrefix(strings.TrimSpace(line), "[") {
			text.WriteString(line)
			text.WriteString(" ")
		}
	}
	body := pgnComment.ReplaceAllString(text.String(), " ")
	for pgnVariation.MatchString(body) {
		body = pgnVariation.ReplaceAllString(body, " ")
	}
	var sans []string
	for _, token := range strings.Fields(body) {
		token = pgnNumber.ReplaceAllString(token, "")
		switch {
		case token == "", token == "1-0", token == "0-1", token == "1/2-1/2", token == "*", strings.HasPrefix(token, "$"):
			continue
		}
		sans = append(sans, token)
	}
	return sans
}

// ChesscomGames lit l'API publique de Chess.com : elle ne demande pas de compte, n'importe quel pseudo se lit.
type ChesscomGames interface {
	PlayerExists(ctx context.Context, username string) (bool, error)
	// StreamGames lit les parties des mois depuis celui de `since` (zéro pour toutes), du plus ancien au plus récent.
	StreamGames(ctx context.Context, username string, since time.Time, each func(ChesscomGame) error) error
}

// LinkChesscom ajoute les parties Chess.com du joueur aux siennes et lance leur import.
func (s *PlayedGameImportService) LinkChesscom(ctx context.Context, user *models.User, username string) (*models.PlayedGameImport, error) {
	if !chesscomUsernamePattern.MatchString(username) {
		return nil, ErrChesscomPlayerNotFound
	}
	exists, err := s.chesscom.PlayerExists(ctx, username)
	if err != nil {
		return nil, fmt.Errorf("%w: %w", ErrChesscomUnreachable, err)
	}
	if !exists {
		return nil, ErrChesscomPlayerNotFound
	}
	linked, err := s.store.LinkChesscom(ctx, user.ID, username)
	if err != nil {
		return nil, err
	}
	if !linked {
		return nil, ErrChesscomAlreadyLinked
	}
	return s.Start(ctx, user)
}

// UnlinkChesscom oublie le compte Chess.com et ses parties ; pas pendant un import, qui les rajouterait.
func (s *PlayedGameImportService) UnlinkChesscom(ctx context.Context, userID string) error {
	state, err := s.store.GetImport(ctx, userID)
	if err != nil {
		return err
	}
	if state != nil && state.Status == models.PlayedGameImportRunning {
		return ErrImportRunning
	}
	return s.store.UnlinkChesscom(ctx, userID)
}

// ChesscomArchive lit les archives mensuelles d'un joueur sur l'API publique de Chess.com.
type ChesscomArchive struct {
	baseURL string
	client  *http.Client
}

func NewChesscomArchive(baseURL string, client *http.Client) *ChesscomArchive {
	return &ChesscomArchive{baseURL: strings.TrimRight(baseURL, "/"), client: client}
}

func (c *ChesscomArchive) get(ctx context.Context, path string, into any) (int, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.baseURL+path, nil)
	if err != nil {
		return 0, err
	}
	// Chess.com demande un User-Agent qui dise qui l'appelle.
	req.Header.Set("User-Agent", "Kumquat (https://kumquatchess.com)")
	req.Header.Set("Accept", "application/json")
	resp, err := c.client.Do(req)
	if err != nil {
		return 0, fmt.Errorf("chess.com %s: %w", path, err)
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode != http.StatusOK {
		return resp.StatusCode, nil
	}
	if err := json.NewDecoder(resp.Body).Decode(into); err != nil {
		return resp.StatusCode, fmt.Errorf("chess.com %s: %w", path, err)
	}
	return resp.StatusCode, nil
}

func (c *ChesscomArchive) PlayerExists(ctx context.Context, username string) (bool, error) {
	var profile struct{}
	status, err := c.get(ctx, "/player/"+url.PathEscape(strings.ToLower(username)), &profile)
	switch {
	case err != nil:
		return false, err
	case status == http.StatusOK:
		return true, nil
	case status == http.StatusNotFound || status == http.StatusGone:
		return false, nil
	default:
		return false, fmt.Errorf("chess.com profile: HTTP %d", status)
	}
}

func (c *ChesscomArchive) StreamGames(ctx context.Context, username string, since time.Time, each func(ChesscomGame) error) error {
	player := "/player/" + url.PathEscape(strings.ToLower(username))
	var list struct {
		Archives []string `json:"archives"`
	}
	if status, err := c.get(ctx, player+"/games/archives", &list); err != nil {
		return err
	} else if status != http.StatusOK {
		return fmt.Errorf("chess.com archives: HTTP %d", status)
	}
	from := ""
	if !since.IsZero() {
		from = since.UTC().Format("2006/01")
	}
	for _, archive := range list.Archives {
		// …/games/2026/09 : le mois se lit à la fin de l'adresse, qu'on reconstruit sur la base configurée.
		parts := strings.Split(strings.TrimRight(archive, "/"), "/")
		if len(parts) < 2 {
			continue
		}
		month := parts[len(parts)-2] + "/" + parts[len(parts)-1]
		if month < from {
			continue
		}
		var page struct {
			Games []ChesscomGame `json:"games"`
		}
		status, err := c.get(ctx, player+"/games/"+month, &page)
		if err != nil {
			return err
		}
		if status != http.StatusOK {
			return fmt.Errorf("chess.com archive %s: HTTP %d", month, status)
		}
		for _, game := range page.Games {
			if err := each(game); err != nil {
				return err
			}
		}
	}
	return nil
}
