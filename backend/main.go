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

	"github.com/labstack/echo-contrib/echoprometheus"
	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
	"golang.org/x/time/rate"

	"github.com/kumquat/backend/config"
	"github.com/kumquat/backend/internal/handlers"
	appMiddleware "github.com/kumquat/backend/internal/middleware"
	"github.com/kumquat/backend/internal/repository"
	"github.com/kumquat/backend/internal/services"
)

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

	// Initialize repositories
	userRepo := repository.NewPostgresUserRepo(db.Pool)
	repertoireRepo := repository.NewPostgresRepertoireRepo(db.Pool)
	categoryRepo := repository.NewPostgresCategoryRepo(db.Pool)
	analysisRepo := repository.NewPostgresAnalysisRepo(db.Pool)
	fingerprintRepo := repository.NewPostgresFingerprintRepo(db.Pool)
	engineEvalRepo := repository.NewPostgresEngineEvalRepo(db.Pool)
	dismissedMistakeRepo := repository.NewDismissedMistakeRepo(db.Pool)
	dismissedGapRepo := repository.NewDismissedGapRepo(db.Pool)
	passwordResetRepo := repository.NewPostgresPasswordResetRepo(db.Pool)
	refreshTokenRepo := repository.NewPostgresRefreshTokenRepo(db.Pool)

	// Initialize opening analysis service (uses Lichess Explorer API)
	engineSvc := services.NewEngineService(engineEvalRepo, analysisRepo)

	// Initialize services
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
		services.WithDismissedMistakeRepo(dismissedMistakeRepo),
		services.WithDismissedGapRepo(dismissedGapRepo),
	)
	lichessSvc := services.NewLichessService()
	chesscomSvc := services.NewChesscomService()
	syncSvc := services.NewSyncService(userRepo, importSvc, lichessSvc, chesscomSvc)
	studyImportSvc := services.NewStudyImportService(lichessSvc, repertoireSvc, categoryRepo, userRepo)

	// Initialize handlers
	authHandler := handlers.NewAuthHandler(authSvc, cfg.SecureCookies)
	oauthHandler := handlers.NewOAuthHandler(oauthSvc, userRepo, cfg.FrontendURL, cfg.JWTSecret, cfg.SecureCookies)
	syncHandler := handlers.NewSyncHandler(syncSvc)
	studyImportHandler := handlers.NewStudyImportHandler(studyImportSvc)
	trainingHandler := handlers.NewTrainingHandler(importSvc)

	// Initialize Echo
	e := echo.New()
	e.HideBanner = true

	// Middleware
	e.Use(middleware.Logger()) //nolint:staticcheck // TODO: migrate to middleware.RequestLoggerWithConfig
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
	e.Use(middleware.BodyLimit("10M"))

	// Rate limiting: 100 requests/minute per IP
	e.Use(middleware.RateLimiterWithConfig(middleware.RateLimiterConfig{
		Store: middleware.NewRateLimiterMemoryStoreWithConfig(
			middleware.RateLimiterMemoryStoreConfig{Rate: rate.Limit(100.0 / 60.0), Burst: 20},
		),
		IdentifierExtractor: func(ctx echo.Context) (string, error) {
			return ctx.RealIP(), nil
		},
		ErrorHandler: func(ctx echo.Context, err error) error {
			return ctx.JSON(http.StatusTooManyRequests, map[string]string{"error": "rate limit exceeded"})
		},
		DenyHandler: func(ctx echo.Context, identifier string, err error) error {
			return ctx.JSON(http.StatusTooManyRequests, map[string]string{"error": "rate limit exceeded"})
		},
	}))

	// Public routes (no auth required)
	e.GET("/api/health", handlers.HealthHandler(db.Pool))

	// Stricter rate limit for auth endpoints: 10 requests/minute per IP
	authGroup := e.Group("")
	authGroup.Use(middleware.RateLimiterWithConfig(middleware.RateLimiterConfig{
		Store: middleware.NewRateLimiterMemoryStoreWithConfig(
			middleware.RateLimiterMemoryStoreConfig{Rate: rate.Limit(10.0 / 60.0), Burst: 5},
		),
		IdentifierExtractor: func(ctx echo.Context) (string, error) {
			return ctx.RealIP(), nil
		},
		ErrorHandler: func(ctx echo.Context, err error) error {
			return ctx.JSON(http.StatusTooManyRequests, map[string]string{"error": "too many authentication attempts"})
		},
		DenyHandler: func(ctx echo.Context, identifier string, err error) error {
			return ctx.JSON(http.StatusTooManyRequests, map[string]string{"error": "too many authentication attempts"})
		},
	}))
	authGroup.POST("/api/auth/register", authHandler.RegisterHandler)
	authGroup.POST("/api/auth/login", authHandler.LoginHandler)
	authGroup.POST("/api/auth/forgot-password", authHandler.ForgotPasswordHandler)
	authGroup.POST("/api/auth/reset-password", authHandler.ResetPasswordHandler)
	authGroup.GET("/api/auth/lichess/login", oauthHandler.LoginRedirect)
	authGroup.GET("/api/auth/lichess/callback", oauthHandler.Callback)

	// Token refresh (public — uses httpOnly cookie, not Authorization header)
	e.POST("/api/auth/refresh", authHandler.RefreshHandler)
	// Logout (public — revokes refresh token)
	e.POST("/api/auth/logout", authHandler.LogoutHandler)

	// Protected routes (auth required)
	protected := e.Group("", appMiddleware.JWTAuth(authSvc))

	// Auth - current user
	protected.GET("/api/auth/me", authHandler.MeHandler)
	protected.PUT("/api/auth/profile", authHandler.UpdateProfileHandler)
	protected.POST("/api/auth/change-password", authHandler.ChangePasswordHandler)
	protected.GET("/api/auth/has-password", authHandler.HasPasswordHandler)
	protected.DELETE("/api/auth/account", authHandler.DeleteAccountHandler)

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
	protected.POST("/api/repertoires/:id/nodes/:nodeId/toggle-collapsed", handlers.ToggleNodeCollapsedHandler(repertoireSvc))
	protected.POST("/api/repertoires/:id/nodes/:nodeId/expand-to", handlers.ExpandToNodeHandler(repertoireSvc))
	protected.POST("/api/repertoires/:id/nodes/:nodeId/set-main-line", handlers.SetMainLineHandler(repertoireSvc))
	protected.POST("/api/repertoires/:id/clear-main-line", handlers.ClearMainLineHandler(repertoireSvc))
	protected.POST("/api/repertoires/merge", handlers.MergeRepertoiresHandler(repertoireSvc))
	protected.POST("/api/repertoires/:id/extract", handlers.ExtractSubtreeHandler(repertoireSvc))
	protected.POST("/api/repertoires/:id/merge-transpositions", handlers.MergeTranspositionsHandler(repertoireSvc))
	protected.PATCH("/api/repertoires/:id/category", handlers.AssignCategoryHandler(repertoireSvc, categorySvc))
	protected.PATCH("/api/repertoires/:id/visibility", handlers.UpdateVisibilityHandler(repertoireSvc))

	// Explore API (public repertoires)
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
	dashboardHandler := handlers.NewDashboardHandler(importSvc)
	protected.GET("/api/dashboard/stats", dashboardHandler.GetStats)
	protected.POST("/api/dashboard/gaps/dismiss", dashboardHandler.DismissGap)

	// Import/Analysis API
	importHandler := handlers.NewImportHandler(importSvc, repertoireSvc, lichessSvc, chesscomSvc)
	protected.POST("/api/imports", importHandler.UploadHandler)
	protected.POST("/api/imports/lichess", importHandler.LichessImportHandler)
	protected.POST("/api/imports/chesscom", importHandler.ChesscomImportHandler)
	protected.GET("/api/analyses", importHandler.ListAnalysesHandler)
	protected.GET("/api/analyses/:id", importHandler.GetAnalysisHandler)
	protected.DELETE("/api/analyses/:id", importHandler.DeleteAnalysisHandler)
	protected.POST("/api/imports/validate-pgn", importHandler.ValidatePGNHandler)
	protected.POST("/api/imports/validate-move", importHandler.ValidateMoveHandler)
	protected.GET("/api/imports/legal-moves", importHandler.GetLegalMovesHandler)

	// Study Import API
	protected.GET("/api/studies/preview", studyImportHandler.PreviewStudyHandler)
	protected.POST("/api/studies/import", studyImportHandler.ImportStudyHandler)
	protected.GET("/api/studies/browse", studyImportHandler.BrowseStudiesHandler)
	protected.GET("/api/studies/topics", studyImportHandler.StudyTopicsHandler)

	// Training API
	protected.POST("/api/training/analyze", trainingHandler.AnalyzeHandler)

	// Sync API
	protected.POST("/api/sync", syncHandler.HandleSync)

	// Games API
	protected.GET("/api/games/insights", importHandler.GetInsightsHandler)
	protected.POST("/api/games/insights/dismiss", importHandler.DismissMistakeHandler)
	protected.GET("/api/games/repertoires", importHandler.GetDistinctRepertoiresHandler)
	protected.POST("/api/games/reanalyze-all", importHandler.ReanalyzeAllGamesHandler)
	protected.GET("/api/games", importHandler.GetGamesHandler)
	protected.DELETE("/api/games/:analysisId/:gameIndex", importHandler.DeleteGameHandler)
	protected.POST("/api/games/bulk-delete", importHandler.BulkDeleteGamesHandler)
	protected.POST("/api/games/:analysisId/:gameIndex/reanalyze", importHandler.ReanalyzeGameHandler)
	protected.POST("/api/games/:analysisId/:gameIndex/view", importHandler.MarkGameViewedHandler)

	// Internal metrics server (separate port, not publicly exposed)
	metrics := echo.New()
	metrics.HideBanner = true
	metrics.GET("/metrics", echoprometheus.NewHandler())

	// Start opening analysis worker
	workerCtx, workerCancel := context.WithCancel(context.Background())
	go engineSvc.RunWorker(workerCtx)

	// Start metrics server in a goroutine
	go func() {
		metricsAddr := fmt.Sprintf(":%d", cfg.MetricsPort)
		slog.Info("starting metrics server", "addr", metricsAddr)
		if err := metrics.Start(metricsAddr); err != nil && err != http.ErrServerClosed {
			slog.Error("metrics server error", "error", err)
		}
	}()

	// Start server in a goroutine
	go func() {
		addr := fmt.Sprintf(":%d", cfg.Port)
		slog.Info("starting server", "addr", addr)
		if err := e.Start(addr); err != nil && err != http.ErrServerClosed {
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
	if err := metrics.Shutdown(shutdownCtx); err != nil {
		slog.Error("metrics server forced to shutdown", "error", err)
	}
	if err := e.Shutdown(shutdownCtx); err != nil {
		slog.Error("server forced to shutdown", "error", err)
	}

	// Close DB after server is shut down
	db.Close()
	slog.Info("server stopped")
}

// securityHeaders adds standard security headers to all responses.
func securityHeaders(next echo.HandlerFunc) echo.HandlerFunc {
	return func(c echo.Context) error {
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
