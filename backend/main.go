package main

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
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

// appServices bundles every service and handler the HTTP layer depends on. It is
// produced by buildServices so that route registration and the engine worker can
// be wired from a single, fully-constructed object instead of a long sequence of
// order-dependent local variables in main().
type appServices struct {
	// engineSvc drives the background opening-analysis worker.
	engineSvc *services.EngineService

	// cleanupSvc drives the background worker that purges expired tokens and
	// stale explorer cache entries.
	cleanupSvc *services.CleanupService

	// authSvc is needed by main() to build the JWT auth middleware.
	authSvc *services.AuthService

	// repertoireSvc and categorySvc back the closure-style handler factories that
	// registerRoutes invokes at mount time. repertoireSvc is also retained so the
	// re-analysis queue wiring can be asserted in tests.
	repertoireSvc *services.RepertoireService
	categorySvc   *services.CategoryService

	// Handlers consumed by registerRoutes.
	authHandler             *handlers.AuthHandler
	oauthHandler            *handlers.OAuthHandler
	syncHandler             *handlers.SyncHandler
	studyImportHandler      *handlers.StudyImportHandler
	trainingHandler         *handlers.TrainingHandler
	trainingExplorerHandler *handlers.TrainingExplorerHandler
	importHandler           *handlers.ImportHandler
	dashboardHandler        *handlers.DashboardHandler
}

// buildServices constructs the full dependency graph (repositories, services and
// handlers) from config and an open database pool.
//
// The re-analysis queue is the one piece of wiring that cannot be expressed as a
// plain constructor chain: it must be created after importSvc (whose method it
// calls) yet injected back into repertoireSvc (which notifies it on every tree
// mutation). That cycle is resolved explicitly here, and the resulting wiring is
// observable via RepertoireService.ReanalysisQueue so a mis-wire is caught by a
// test rather than silently disabling auto-re-analysis.
func buildServices(cfg config.Config, db *repository.DB) *appServices {
	// Repositories
	userRepo := repository.NewPostgresUserRepo(db.Pool, cfg.JWTSecret)
	repertoireRepo := repository.NewPostgresRepertoireRepo(db.Pool)
	categoryRepo := repository.NewPostgresCategoryRepo(db.Pool)
	analysisRepo := repository.NewPostgresAnalysisRepo(db.Pool)
	fingerprintRepo := repository.NewPostgresFingerprintRepo(db.Pool)
	engineEvalRepo := repository.NewPostgresEngineEvalRepo(db.Pool)
	dismissedMistakeRepo := repository.NewDismissedMistakeRepo(db.Pool)
	dismissedGapRepo := repository.NewDismissedGapRepo(db.Pool)
	passwordResetRepo := repository.NewPostgresPasswordResetRepo(db.Pool)
	refreshTokenRepo := repository.NewPostgresRefreshTokenRepo(db.Pool)
	openingCacheRepo := repository.NewPostgresOpeningExplorerCacheRepo(db.Pool)

	// Opening analysis service (cache-only; cache is populated by the user-facing
	// TrainingExplorerHandler when authenticated users request a position).
	engineSvc := services.NewEngineService(engineEvalRepo, analysisRepo, openingCacheRepo)

	// Periodic cleanup of expired refresh/reset tokens and stale explorer cache.
	cleanupSvc := services.NewCleanupService(refreshTokenRepo, passwordResetRepo, openingCacheRepo, cfg.CleanupInterval)

	// Services
	authSvc := services.NewAuthService(userRepo, cfg.JWTSecret, cfg.JWTExpiry)
	authSvc.WithRefreshTokens(refreshTokenRepo)
	emailSvc := services.NewEmailService(cfg)
	authSvc.WithPasswordReset(passwordResetRepo, emailSvc, cfg.PasswordResetExpiryHours)
	oauthSvc := services.NewOAuthService(userRepo, authSvc, cfg.LichessClientID, cfg.OAuthCallbackURL)
	repertoireSvc := services.NewRepertoireService(repertoireRepo)
	categorySvc := services.NewCategoryService(categoryRepo, repertoireRepo)
	importSvc := services.NewImportService(repertoireSvc, analysisRepo,
		services.WithFingerprintRepo(fingerprintRepo),
		services.WithEngineService(engineSvc),
	)

	// Focused services carved out of the former ImportService god object so each
	// handler depends only on the data it actually reads (issue #128).
	dashboardSvc := services.NewDashboardStatsService(repertoireSvc, analysisRepo,
		services.WithDashboardDismissedGapRepo(dismissedGapRepo),
	)
	insightsSvc := services.NewInsightsService(repertoireSvc, analysisRepo,
		services.WithInsightsEngineService(engineSvc),
		services.WithInsightsDismissedMistakeRepo(dismissedMistakeRepo),
	)
	trainingSvc := services.NewTrainingService(repertoireSvc)

	// Auto re-analyse games whenever a repertoire mutates (issue #45).
	// In-memory debounce coalesces rapid edits into one run per user.
	// The queue closes over importSvc and is injected back into repertoireSvc,
	// closing the construction cycle described above.
	reanalysisQueue := services.NewReanalysisQueue(func(userID string) error {
		_, err := importSvc.ReanalyzeAllGames(userID, true)
		return err
	}, services.DefaultReanalysisDebounce)
	repertoireSvc.WithReanalysisQueue(reanalysisQueue)

	lichessSvc := services.NewLichessService()
	chesscomSvc := services.NewChesscomService()
	syncSvc := services.NewSyncService(userRepo, importSvc, lichessSvc, chesscomSvc)
	studyImportSvc := services.NewStudyImportService(lichessSvc, repertoireSvc, categoryRepo, userRepo)
	explorerSvc := services.NewLichessExplorerService(cfg.LichessExplorerBaseURL, nil)

	// Handlers
	importHandler := handlers.NewImportHandler(importSvc, repertoireSvc, lichessSvc, chesscomSvc).
		WithReanalysisQueue(reanalysisQueue).
		WithInsightsService(insightsSvc)

	return &appServices{
		engineSvc:               engineSvc,
		cleanupSvc:              cleanupSvc,
		authSvc:                 authSvc,
		repertoireSvc:           repertoireSvc,
		authHandler:             handlers.NewAuthHandler(authSvc, cfg.SecureCookies),
		oauthHandler:            handlers.NewOAuthHandler(oauthSvc, userRepo, cfg.FrontendURL, cfg.JWTSecret, cfg.SecureCookies),
		syncHandler:             handlers.NewSyncHandler(syncSvc),
		studyImportHandler:      handlers.NewStudyImportHandler(studyImportSvc),
		trainingHandler:         handlers.NewTrainingHandler(trainingSvc),
		trainingExplorerHandler: handlers.NewTrainingExplorerHandler(explorerSvc, openingCacheRepo, userRepo, cfg.LichessExplorerCacheTTL),
		importHandler:           importHandler,
		dashboardHandler:        handlers.NewDashboardHandler(dashboardSvc),
		categorySvc:             categorySvc,
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
	repertoireSvc := svc.repertoireSvc
	categorySvc := svc.categorySvc

	// Public routes (no auth required)
	e.GET("/api/health", handlers.HealthHandler(db.Pool))

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

	// Protected routes (auth required)
	// 30s request timeout for standard operations; heavy ops use the server WriteTimeout (120s)
	protected := e.Group("", appMiddleware.JWTAuth(svc.authSvc))
	protected.Use(middleware.ContextTimeoutWithConfig(middleware.ContextTimeoutConfig{
		Timeout: 30 * time.Second,
	}))

	// Heavy operations rate limit: 5 requests/minute per IP.
	// For expensive endpoints like imports, sync, reanalyze that trigger
	// external API calls, PGN parsing, or bulk database writes.
	heavyOps := e.Group("", appMiddleware.JWTAuth(svc.authSvc))
	heavyOps.Use(rateLimiter(5.0/60.0, 3, "too many requests for this operation, please wait"))

	// Auth - current user
	protected.GET("/api/auth/me", svc.authHandler.MeHandler)
	protected.PUT("/api/auth/profile", svc.authHandler.UpdateProfileHandler)
	protected.POST("/api/auth/change-password", svc.authHandler.ChangePasswordHandler)
	protected.GET("/api/auth/has-password", svc.authHandler.HasPasswordHandler)
	protected.DELETE("/api/auth/account", svc.authHandler.DeleteAccountHandler)

	// Repertoire API
	protected.GET("/api/repertoires/templates", handlers.ListTemplatesHandler())
	protected.POST("/api/repertoires/seed", handlers.SeedHandler(repertoireSvc))
	protected.GET("/api/repertoires", handlers.ListRepertoiresHandler(repertoireSvc))
	protected.POST("/api/repertoires", handlers.CreateRepertoireHandler(repertoireSvc))
	protected.GET("/api/repertoires/:id", handlers.GetRepertoireHandler(repertoireSvc))
	protected.PATCH("/api/repertoires/:id", handlers.UpdateRepertoireHandler(repertoireSvc))
	protected.DELETE("/api/repertoires/:id", handlers.DeleteRepertoireHandler(repertoireSvc))
	protected.POST("/api/repertoires/:id/nodes", handlers.AddNodeHandler(repertoireSvc))
	protected.DELETE("/api/repertoires/:id/nodes/:nodeId", handlers.DeleteNodeHandler(repertoireSvc))
	protected.PATCH("/api/repertoires/:id/nodes/:nodeId/comment", handlers.UpdateNodeCommentHandler(repertoireSvc))
	protected.PATCH("/api/repertoires/:id/nodes/:nodeId/branch-name", handlers.UpdateNodeBranchNameHandler(repertoireSvc))
	protected.PATCH("/api/repertoires/:id/nodes/:nodeId/branch-color", handlers.UpdateNodeBranchColorHandler(repertoireSvc))
	protected.PATCH("/api/repertoires/:id/nodes/:nodeId/annotations", handlers.UpdateNodeAnnotationsHandler(repertoireSvc))
	protected.POST("/api/repertoires/:id/nodes/:nodeId/toggle-collapsed", handlers.ToggleNodeCollapsedHandler(repertoireSvc))
	protected.POST("/api/repertoires/:id/nodes/:nodeId/expand-to", handlers.ExpandToNodeHandler(repertoireSvc))
	protected.POST("/api/repertoires/:id/nodes/:nodeId/set-main-line", handlers.SetMainLineHandler(repertoireSvc))
	protected.POST("/api/repertoires/:id/clear-main-line", handlers.ClearMainLineHandler(repertoireSvc))
	heavyOps.POST("/api/repertoires/merge", handlers.MergeRepertoiresHandler(repertoireSvc))
	protected.POST("/api/repertoires/:id/extract", handlers.ExtractSubtreeHandler(repertoireSvc))
	protected.POST("/api/repertoires/:id/merge-transpositions", handlers.MergeTranspositionsHandler(repertoireSvc))
	protected.PATCH("/api/repertoires/:id/category", handlers.AssignCategoryHandler(repertoireSvc, categorySvc))
	protected.PATCH("/api/repertoires/:id/visibility", handlers.UpdateVisibilityHandler(repertoireSvc))

	// Explore API (public repertoires + starter templates)
	protected.GET("/api/explore/templates", handlers.ListExploreTemplatesHandler())
	protected.POST("/api/explore/templates/:id/import", handlers.ImportExploreTemplateHandler(repertoireSvc))
	protected.GET("/api/explore/repertoires", handlers.ListPublicRepertoiresHandler(repertoireSvc))
	protected.GET("/api/explore/repertoires/:id", handlers.GetPublicRepertoireHandler(repertoireSvc))
	protected.POST("/api/explore/repertoires/:id/import", handlers.ImportRepertoireHandler(repertoireSvc))

	// Category API
	protected.GET("/api/categories", handlers.ListCategoriesHandler(categorySvc))
	protected.POST("/api/categories", handlers.CreateCategoryHandler(categorySvc))
	protected.GET("/api/categories/:id", handlers.GetCategoryHandler(categorySvc))
	protected.PATCH("/api/categories/:id", handlers.UpdateCategoryHandler(categorySvc))
	protected.DELETE("/api/categories/:id", handlers.DeleteCategoryHandler(categorySvc))

	// Dashboard API
	protected.GET("/api/dashboard/stats", svc.dashboardHandler.GetStats)
	protected.POST("/api/dashboard/gaps/dismiss", svc.dashboardHandler.DismissGap)

	// Import/Analysis API
	heavyOps.POST("/api/imports", svc.importHandler.UploadHandler)
	heavyOps.POST("/api/imports/lichess", svc.importHandler.LichessImportHandler)
	heavyOps.POST("/api/imports/chesscom", svc.importHandler.ChesscomImportHandler)
	protected.GET("/api/analyses", svc.importHandler.ListAnalysesHandler)
	protected.GET("/api/analyses/:id", svc.importHandler.GetAnalysisHandler)
	protected.DELETE("/api/analyses/:id", svc.importHandler.DeleteAnalysisHandler)
	protected.POST("/api/imports/validate-pgn", svc.importHandler.ValidatePGNHandler)
	protected.POST("/api/imports/validate-move", svc.importHandler.ValidateMoveHandler)
	protected.GET("/api/imports/legal-moves", svc.importHandler.GetLegalMovesHandler)

	// Study Import API
	protected.GET("/api/studies/preview", svc.studyImportHandler.PreviewStudyHandler)
	heavyOps.POST("/api/studies/import", svc.studyImportHandler.ImportStudyHandler)
	protected.GET("/api/studies/browse", svc.studyImportHandler.BrowseStudiesHandler)
	protected.GET("/api/studies/topics", svc.studyImportHandler.StudyTopicsHandler)

	// Training API
	protected.POST("/api/training/analyze", svc.trainingHandler.AnalyzeHandler)
	protected.GET("/api/training/opening", svc.trainingExplorerHandler.GetOpening)

	// Sync API
	heavyOps.POST("/api/sync", svc.syncHandler.HandleSync)

	// Games API
	protected.GET("/api/games/insights", svc.importHandler.GetInsightsHandler)
	protected.POST("/api/games/insights/dismiss", svc.importHandler.DismissMistakeHandler)
	protected.GET("/api/games/repertoires", svc.importHandler.GetDistinctRepertoiresHandler)
	heavyOps.POST("/api/games/reanalyze-all", svc.importHandler.ReanalyzeAllGamesHandler)
	protected.GET("/api/games/reanalysis-status", svc.importHandler.ReanalysisStatusHandler)
	protected.GET("/api/games", svc.importHandler.GetGamesHandler)
	protected.POST("/api/games/:analysisId/:gameIndex/reanalyze", svc.importHandler.ReanalyzeGameHandler)
	protected.POST("/api/games/:analysisId/:gameIndex/view", svc.importHandler.MarkGameViewedHandler)
}

// newServer builds a fully-configured Echo instance: middleware stack plus all
// routes. It is split out from main() so the wiring can be exercised in tests.
func newServer(cfg config.Config, db *repository.DB, svc *appServices) *echo.Echo {
	e := echo.New()

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

	// Start opening analysis worker
	workerCtx, workerCancel := context.WithCancel(context.Background())
	go svc.engineSvc.RunWorker(workerCtx)

	// Start periodic cleanup worker (expired tokens + stale explorer cache)
	go svc.cleanupSvc.RunWorker(workerCtx)

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
		WriteTimeout:      120 * time.Second, // generous for long-running imports/sync
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

	// Stop the engine worker
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

	// Close DB after server is shut down
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
