package main

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"sync"
	"syscall"
	"time"

	"github.com/kumquat/backend/config"
	"github.com/kumquat/backend/internal/handlers"
	appMiddleware "github.com/kumquat/backend/internal/middleware"
	"github.com/kumquat/backend/internal/repository"
	"github.com/kumquat/backend/internal/services"
	"github.com/labstack/echo-contrib/v5/echoprometheus"
	"github.com/labstack/echo/v5"
	"github.com/labstack/echo/v5/middleware"
)

// appServices bundles every service and handler the HTTP layer depends on, so
// route registration and the background worker are wired from a single,
// fully-constructed object.
type appServices struct {
	// cleanupSvc drives the background worker that purges expired tokens and
	// stale explorer cache entries.
	cleanupSvc *services.CleanupService

	// authSvc is needed by main() to build the JWT auth middleware.
	authSvc *services.AuthService

	authHandler          *handlers.AuthHandler
	oauthHandler         *handlers.OAuthHandler
	explorerProxyHandler echo.HandlerFunc
	playedGames          *handlers.PlayedGames
	playerState          *repository.PostgresPlayerStateRepo
}

// buildServices constructs the full dependency graph (repositories, services and
// handlers) from config and an open database pool.
func buildServices(cfg config.Config, db *repository.DB) *appServices {
	userRepo := repository.NewPostgresUserRepo(db.Pool, cfg.JWTSecret)
	passwordResetRepo := repository.NewPostgresPasswordResetRepo(db.Pool)
	refreshTokenRepo := repository.NewPostgresRefreshTokenRepo(db.Pool)
	openingCacheRepo := repository.NewPostgresOpeningExplorerCacheRepo(db.Pool)

	cleanupSvc := services.NewCleanupService(refreshTokenRepo, passwordResetRepo, openingCacheRepo, cfg.CleanupInterval)

	authSvc := services.NewAuthService(userRepo, cfg.JWTSecret, cfg.JWTExpiry)
	authSvc.WithRefreshTokens(refreshTokenRepo)
	emailSvc := services.NewEmailService(cfg)
	authSvc.WithPasswordReset(passwordResetRepo, emailSvc, cfg.PasswordResetExpiryHours)
	oauthSvc := services.NewOAuthService(userRepo, authSvc, cfg.LichessClientID, cfg.OAuthCallbackURL)
	explorerSvc := services.NewLichessExplorerService(cfg.LichessExplorerBaseURL, &http.Client{Timeout: 15 * time.Second})

	return &appServices{
		cleanupSvc:           cleanupSvc,
		authSvc:              authSvc,
		authHandler:          handlers.NewAuthHandler(authSvc, cfg.SecureCookies),
		oauthHandler:         handlers.NewOAuthHandler(oauthSvc, userRepo, cfg.FrontendURL, cfg.JWTSecret, cfg.SecureCookies),
		explorerProxyHandler: handlers.ExplorerProxyHandler(explorerSvc, openingCacheRepo, userRepo, cfg.LichessExplorerCacheTTL),
		playedGames: handlers.NewPlayedGames(
			services.NewPlayedGameImportService(
				repository.NewPostgresPlayedGameRepo(db.Pool),
				// Pas de délai global : l'export d'un historique se lit en flux pendant plusieurs minutes.
				services.NewLichessGameExport("https://lichess.org/api", &http.Client{}),
			),
			userRepo,
		),
		playerState: repository.NewPostgresPlayerStateRepo(db.Pool),
	}
}

// proxyAwareIPExtractor derives the real client IP from the X-Forwarded-For
// header while trusting only loopback, link-local and private-network hops (the
// reverse proxy that fronts the app in the documented deployment). It walks
// X-Forwarded-For from the proxy side inward and returns the nearest *untrusted*
// address — i.e. the client IP as recorded by the trusted proxy — so a spoofed
// client-supplied X-Forwarded-For entry cannot forge the rate-limit / logging
// identity. With no proxy in front, it falls back to the TCP remote address.
func proxyAwareIPExtractor() echo.IPExtractor {
	return echo.ExtractIPFromXFFHeader(
		echo.TrustLoopback(true),
		echo.TrustLinkLocal(true),
		echo.TrustPrivateNet(true),
	)
}

// rateLimiter builds a per-IP, in-memory rate-limiter middleware that responds
// with HTTP 429 and the given JSON error message when the limit is exceeded.
//
// Clients are keyed on ctx.RealIP(). The server installs proxyAwareIPExtractor
// (see newServer), so RealIP returns the real client IP recorded by the trusted
// reverse proxy and a client-supplied X-Forwarded-For header cannot be used to
// forge an identity and evade the limit. See the deployment notes in .env.example.
func rateLimiter(rate float64, burst int, msg string) echo.MiddlewareFunc {
	deny := func(ctx *echo.Context) error {
		return ctx.JSON(http.StatusTooManyRequests, map[string]string{"error": msg})
	}
	return middleware.RateLimiterWithConfig(middleware.RateLimiterConfig{
		Store: middleware.NewRateLimiterMemoryStoreWithConfig(
			middleware.RateLimiterMemoryStoreConfig{Rate: rate, Burst: burst},
		),
		IdentifierExtractor: func(ctx *echo.Context) (string, error) {
			return ctx.RealIP(), nil
		},
		ErrorHandler: func(ctx *echo.Context, err error) error {
			return deny(ctx)
		},
		DenyHandler: func(ctx *echo.Context, identifier string, err error) error {
			return deny(ctx)
		},
	})
}

// registerRoutes mounts every HTTP route onto e using the supplied services.
func registerRoutes(e *echo.Echo, db *repository.DB, svc *appServices) {
	// Public routes (no auth required)
	e.GET("/api/health", handlers.HealthHandler(db.Pool))
	e.GET("/api/explorer/:database", svc.explorerProxyHandler, appMiddleware.OptionalJWTAuth(svc.authSvc))

	// Stricter rate limit for auth endpoints: 20 requests/minute per IP.
	authGroup := e.Group("")
	authGroup.Use(rateLimiter(20.0/60.0, 10, "too many authentication attempts"))
	authGroup.POST("/api/auth/register", svc.authHandler.RegisterHandler)
	authGroup.POST("/api/auth/login", svc.authHandler.LoginHandler)
	authGroup.POST("/api/auth/forgot-password", svc.authHandler.ForgotPasswordHandler)
	authGroup.POST("/api/auth/reset-password", svc.authHandler.ResetPasswordHandler)
	authGroup.GET("/api/auth/lichess/login", svc.oauthHandler.LoginRedirect)
	authGroup.GET("/api/auth/lichess/callback", svc.oauthHandler.Callback)

	// Token refresh & logout — in auth rate-limit group (uses httpOnly cookie, not Authorization header)
	authGroup.POST("/api/auth/refresh", svc.authHandler.RefreshHandler)
	authGroup.POST("/api/auth/logout", svc.authHandler.LogoutHandler)

	// Protected routes (auth required), with a 30s request timeout.
	protected := e.Group("", appMiddleware.JWTAuth(svc.authSvc))
	protected.Use(middleware.ContextTimeoutWithConfig(middleware.ContextTimeoutConfig{
		Timeout: 30 * time.Second,
	}))

	protected.GET("/api/auth/me", svc.authHandler.MeHandler)
	protected.PUT("/api/auth/profile", svc.authHandler.UpdateProfileHandler)
	protected.POST("/api/auth/change-password", svc.authHandler.ChangePasswordHandler)
	protected.GET("/api/auth/has-password", svc.authHandler.HasPasswordHandler)
	protected.DELETE("/api/auth/account", svc.authHandler.DeleteAccountHandler)

	// v2 : les parties Lichess du joueur, importées une fois puis lues par toutes les pages.
	// Sa propre limite : Home relance l'import à chaque chargement.
	gameImports := e.Group("", appMiddleware.JWTAuth(svc.authSvc))
	gameImports.Use(rateLimiter(6.0/60.0, 3, "too many imports, please wait"))
	gameImports.POST("/api/v2/games/import", svc.playedGames.StartImport)
	protected.GET("/api/v2/games/import", svc.playedGames.ImportStatus)
	protected.GET("/api/v2/games", svc.playedGames.List)
	protected.GET("/api/v2/state", handlers.GetPlayerStateHandler(svc.playerState))
	protected.PUT("/api/v2/state/:key", handlers.PutPlayerStateHandler(svc.playerState))
}

// newServer builds a fully-configured Echo instance: middleware stack plus all
// routes. It is split out from main() so the wiring can be exercised in tests.
func newServer(cfg config.Config, db *repository.DB, svc *appServices) *echo.Echo {
	// Les groupes de préfixe "" n'enregistrent pas de 404 attrape-tout : il passerait par leurs middlewares
	// (JWT, quota d'import) pour toute route inconnue.
	e := echo.NewWithConfig(echo.Config{NoGroupAutoRegister404Routes: true})

	// Derive the client IP from X-Forwarded-For trusting only the reverse-proxy
	// hop, so the rate limiter and request logger cannot be fooled by a
	// client-supplied X-Forwarded-For header (see proxyAwareIPExtractor).
	e.IPExtractor = proxyAwareIPExtractor()

	// Middleware
	e.Use(middleware.RequestLogger())
	e.Use(middleware.Recover())
	e.Use(middleware.CORSWithConfig(middleware.CORSConfig{
		AllowOrigins:     cfg.AllowedOrigins,
		AllowMethods:     []string{http.MethodGet, http.MethodPost, http.MethodPut, http.MethodPatch, http.MethodDelete},
		AllowHeaders:     []string{echo.HeaderOrigin, echo.HeaderContentType, echo.HeaderAccept, echo.HeaderAuthorization},
		AllowCredentials: true,
	}))

	// Prometheus metrics
	e.Use(echoprometheus.NewMiddleware("kumquat"))

	// Security headers
	e.Use(securityHeaders)

	// Global body size limit (10MB)
	e.Use(middleware.BodyLimit(10_485_760)) // 10MB

	// Global rate limiting: 100 requests/minute per IP.
	e.Use(rateLimiter(100.0/60.0, 20, "rate limit exceeded"))

	registerRoutes(e, db, svc)

	return e
}

func main() {
	cfg := config.MustLoad()

	// Set up structured logging
	var logHandler slog.Handler
	if cfg.Environment == "production" {
		logHandler = slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo})
	} else {
		logHandler = slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelDebug})
	}
	slog.SetDefault(slog.New(logHandler))

	// Initialize database
	db, err := repository.NewDB(cfg)
	if err != nil {
		slog.Error("failed to initialize database", "error", err)
		os.Exit(1)
	}
	defer db.Close()

	// Build the dependency graph and the HTTP server.
	svc := buildServices(cfg, db)
	e := newServer(cfg, db, svc)

	// Internal metrics server (separate port, not publicly exposed)
	metrics := echo.New()
	metrics.GET("/metrics", echoprometheus.NewHandler())

	// Start the background worker under a cancellable context. A WaitGroup lets
	// us join it on shutdown before closing the DB pool, so no query runs against
	// a closed pool.
	workerCtx, workerCancel := context.WithCancel(context.Background())
	var workerWG sync.WaitGroup

	// Start periodic cleanup worker (expired tokens + stale explorer cache)
	workerWG.Add(1)
	go func() {
		defer workerWG.Done()
		svc.cleanupSvc.RunWorker(workerCtx)
	}()

	// Start metrics server in a goroutine
	metricsAddr := fmt.Sprintf(":%d", cfg.MetricsPort)
	metricsServer := &http.Server{
		Addr:    metricsAddr,
		Handler: metrics,
	}
	go func() {
		slog.Info("starting metrics server", "addr", metricsAddr)
		if err := metricsServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("metrics server error", "error", err)
		}
	}()

	// Start server in a goroutine with explicit timeouts (Slowloris protection)
	addr := fmt.Sprintf(":%d", cfg.Port)
	appServer := &http.Server{
		Addr:              addr,
		Handler:           e,
		ReadTimeout:       10 * time.Second,
		ReadHeaderTimeout: 5 * time.Second,
		WriteTimeout:      120 * time.Second,
		IdleTimeout:       60 * time.Second,
	}
	go func() {
		slog.Info("starting server", "addr", addr)
		if err := appServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("server error", "error", err)
		}
	}()

	// Wait for interrupt signal for graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	slog.Info("shutting down server")

	// Signal the background workers to stop.
	workerCancel()

	// Graceful shutdown with 10s timeout
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutdownCancel()
	if err := metricsServer.Shutdown(shutdownCtx); err != nil {
		slog.Error("metrics server forced to shutdown", "error", err)
	}
	if err := appServer.Shutdown(shutdownCtx); err != nil {
		slog.Error("server forced to shutdown", "error", err)
	}

	// Join the background workers so no in-flight query races db.Close().
	workerWG.Wait()

	// Close DB after the servers are shut down and the workers have stopped.
	db.Close()
	slog.Info("server stopped")
}

// securityHeaders adds standard security headers to all responses.
func securityHeaders(next echo.HandlerFunc) echo.HandlerFunc {
	return func(c *echo.Context) error {
		h := c.Response().Header()
		h.Set("X-Content-Type-Options", "nosniff")
		h.Set("X-Frame-Options", "DENY")
		h.Set("Referrer-Policy", "strict-origin-when-cross-origin")
		h.Set("X-XSS-Protection", "1; mode=block")
		h.Set("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
		h.Set("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'")
		h.Set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()")
		return next(c)
	}
}
