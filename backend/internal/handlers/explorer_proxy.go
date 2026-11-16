package handlers

import (
	"errors"
	"log/slog"
	"net/http"
	"net/url"
	"slices"
	"strconv"
	"strings"
	"time"

	"github.com/labstack/echo/v5"

	"github.com/kumquat/backend/internal/repertoiretree"
	"github.com/kumquat/backend/internal/repository"
	"github.com/kumquat/backend/internal/services"
)

var (
	explorerProxyDatabases = []string{"lichess", "masters"}
	explorerProxySpeeds    = []string{"ultraBullet", "bullet", "blitz", "rapid", "classical", "correspondence"}
	explorerProxyRatings   = []string{"0", "1000", "1200", "1400", "1600", "1800", "2000", "2200", "2500"}
	explorerProxyCounts    = []string{"moves", "topGames", "recentGames"}
)

const maxExplorerProxyCount = 30

// ExplorerProxyHandler relaie l'explorateur Lichess sans compte Kumquat : depuis novembre 2026 Lichess exige un
// jeton pour toutes ses bases, et celui du serveur ne doit jamais atteindre le navigateur.
func ExplorerProxyHandler(fetcher services.ExplorerRawFetcher, cache repository.OpeningExplorerCacheRepository, token string, cacheTTL time.Duration) echo.HandlerFunc {
	return func(c *echo.Context) error {
		database := c.Param("database")
		if !slices.Contains(explorerProxyDatabases, database) {
			return BadRequestResponse(c, "unknown explorer database")
		}
		values, ok := explorerProxyQuery(c, database)
		if !ok {
			return nil
		}

		ctx := c.Request().Context()
		// Le cache ignore les deux derniers champs de la FEN : ils ne changent rien aux statistiques.
		keyed := url.Values{}
		for name, value := range values {
			keyed[name] = value
		}
		keyed.Set("fen", repertoiretree.NormalizeFEN(values.Get("fen")))
		cacheKey := "proxy/" + database + "?" + keyed.Encode()
		if payload, found, err := cache.Get(ctx, cacheKey); err == nil && found {
			return c.Blob(http.StatusOK, "application/json", payload)
		} else if err != nil {
			slog.Warn("explorer proxy cache read failed; falling back to upstream", "error", err)
		}

		if token == "" {
			return c.JSON(http.StatusServiceUnavailable, map[string]string{"error": "Lichess explorer is not configured"})
		}
		payload, err := fetcher.FetchRaw(ctx, database, values, token)
		if errors.Is(err, services.ErrExplorerUnauthorized) {
			slog.Error("lichess explorer rejected the server token (LICHESS_EXPLORER_TOKEN)")
			return c.JSON(http.StatusBadGateway, map[string]string{"error": "Lichess explorer refused the request"})
		}
		if err != nil {
			return mapFetchError(c, err)
		}
		if err := cache.Put(ctx, cacheKey, payload, time.Now().Add(cacheTTL)); err != nil {
			slog.Warn("explorer proxy cache write failed", "error", err)
		}
		return c.Blob(http.StatusOK, "application/json", payload)
	}
}

// Seuls les paramètres connus passent, et dans des listes fermées : sinon chaque variante d'URL ouvrirait une
// entrée de cache et une requête à Lichess.
func explorerProxyQuery(c *echo.Context, database string) (url.Values, bool) {
	values := url.Values{}
	fen := c.QueryParam("fen")
	if !ValidateFENField(c, "fen", fen) {
		return nil, false
	}
	values.Set("fen", fen)
	if variant := c.QueryParam("variant"); variant != "" {
		if variant != "standard" {
			_ = BadRequestResponse(c, "unsupported variant")
			return nil, false
		}
		values.Set("variant", variant)
	}
	for _, name := range explorerProxyCounts {
		raw := c.QueryParam(name)
		if raw == "" {
			continue
		}
		count, err := strconv.Atoi(raw)
		if err != nil || count < 0 || count > maxExplorerProxyCount {
			_ = BadRequestResponse(c, name+" must be between 0 and "+strconv.Itoa(maxExplorerProxyCount))
			return nil, false
		}
		values.Set(name, strconv.Itoa(count))
	}
	if database == "masters" {
		return values, true
	}
	for name, allowed := range map[string][]string{"speeds": explorerProxySpeeds, "ratings": explorerProxyRatings} {
		raw := c.QueryParam(name)
		if raw == "" {
			continue
		}
		var picked []string
		for _, item := range strings.Split(raw, ",") {
			if !slices.Contains(allowed, item) {
				_ = BadRequestResponse(c, "unsupported "+name+": "+item)
				return nil, false
			}
			if !slices.Contains(picked, item) {
				picked = append(picked, item)
			}
		}
		slices.SortFunc(picked, func(a, b string) int { return slices.Index(allowed, a) - slices.Index(allowed, b) })
		values.Set(name, strings.Join(picked, ","))
	}
	return values, true
}
