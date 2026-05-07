package handlers

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/labstack/echo/v5"

	"github.com/kumquat/backend/internal/repository"
	"github.com/kumquat/backend/internal/services"
)

type TrainingExplorerHandler struct {
	fetcher  services.OpeningExplorerFetcher
	cache    repository.OpeningExplorerCacheRepository
	userRepo repository.UserRepository
	cacheTTL time.Duration
}

func NewTrainingExplorerHandler(
	fetcher services.OpeningExplorerFetcher,
	cache repository.OpeningExplorerCacheRepository,
	userRepo repository.UserRepository,
	cacheTTL time.Duration,
) *TrainingExplorerHandler {
	return &TrainingExplorerHandler{
		fetcher:  fetcher,
		cache:    cache,
		userRepo: userRepo,
		cacheTTL: cacheTTL,
	}
}

// GetOpening serves opening statistics for a FEN. Cache hits never touch the
// upstream and never require a Lichess link. Misses require the requesting
// user to have a linked Lichess account; their token is forwarded to Lichess.
func (h *TrainingExplorerHandler) GetOpening(c *echo.Context) error {
	fen := c.QueryParam("fen")
	if fen == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "fen is required",
			"code":  "invalid_fen",
		})
	}

	query := services.DefaultOpeningQuery(fen)
	if v := c.QueryParam("variant"); strings.TrimSpace(v) != "" {
		query.Variant = v
	}

	ctx := c.Request().Context()
	cacheKey := services.CanonicalKey(query)

	if payload, found, err := h.cache.Get(ctx, cacheKey); err == nil && found {
		return c.Blob(http.StatusOK, "application/json", payload)
	} else if err != nil {
		slog.Warn("opening explorer cache read failed; falling back to upstream", "error", err)
	}

	userID, _ := c.Get("userID").(string)
	user, err := h.userRepo.GetByID(userID)
	if err != nil || user == nil {
		return InternalErrorResponse(c, "could not load user")
	}

	if user.LichessAccessToken == nil || *user.LichessAccessToken == "" {
		return c.JSON(http.StatusForbidden, map[string]string{
			"error": "Connect your Lichess account to load opening data",
			"code":  "lichess_not_linked",
		})
	}

	stats, err := h.fetcher.FetchOpening(ctx, query, *user.LichessAccessToken)
	if err != nil {
		return mapFetchError(c, err)
	}

	payload, err := json.Marshal(stats)
	if err != nil {
		return InternalErrorResponse(c, "failed to encode opening data")
	}

	if putErr := h.cache.Put(ctx, cacheKey, payload, time.Now().Add(h.cacheTTL)); putErr != nil {
		slog.Warn("opening explorer cache write failed", "error", putErr)
	}

	return c.Blob(http.StatusOK, "application/json", payload)
}

func mapFetchError(c *echo.Context, err error) error {
	var rl *services.RateLimitedError
	if errors.As(err, &rl) {
		return c.JSON(http.StatusTooManyRequests, map[string]any{
			"error":             "Lichess rate limit reached",
			"code":              "rate_limited",
			"retryAfterSeconds": rl.RetryAfterSeconds,
		})
	}
	if errors.Is(err, services.ErrExplorerUnauthorized) {
		return c.JSON(http.StatusForbidden, map[string]string{
			"error": "Lichess token rejected; please reconnect your Lichess account",
			"code":  "lichess_token_invalid",
		})
	}
	if errors.Is(err, services.ErrExplorerUnavailable) {
		return c.JSON(http.StatusBadGateway, map[string]string{
			"error": "Lichess Explorer is unavailable; try again later",
			"code":  "upstream_unavailable",
		})
	}
	slog.Error("opening explorer fetch failed", "error", err)
	return c.JSON(http.StatusBadGateway, map[string]string{
		"error": "Failed to fetch opening data",
		"code":  "upstream_error",
	})
}

