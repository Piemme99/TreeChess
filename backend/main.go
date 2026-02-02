package main

import (
	"context"
	"fmt"
	"log"
	"net/http"

	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
	"golang.org/x/time/rate"

	"github.com/treechess/backend/config"
	"github.com/treechess/backend/internal/handlers"
	appMiddleware "github.com/treechess/backend/internal/middleware"
	"github.com/treechess/backend/internal/repository"
	"github.com/treechess/backend/internal/services"
)

func main() {
	cfg := config.MustLoad()

	// Initialize database
	db, err := repository.NewDB(cfg)
	if err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}
	defer db.Close()

	// Initialize repositories
	userRepo := repository.NewPostgresUserRepo(db.Pool)
	repertoireRepo := repository.NewPostgresRepertoireRepo(db.Pool)
	analysisRepo := repository.NewPostgresAnalysisRepo(db.Pool)
	fingerprintRepo := repository.NewPostgresFingerprintRepo(db.Pool)
	engineEvalRepo := repository.NewPostgresEngineEvalRepo(db.Pool)

	// Initialize opening analysis service (uses Lichess Explorer API)
	engineSvc := services.NewEngineService(engineEvalRepo, analysisRepo)

	// Initialize services
	authSvc := services.NewAuthService(userRepo, cfg.JWTSecret, cfg.JWTExpiry)
	oauthSvc := services.NewOAuthService(userRepo, authSvc, cfg.LichessClientID, cfg.OAuthCallbackURL)
	repertoireSvc := services.NewRepertoireService(repertoireRepo)
	importSvc := services.NewImportService(repertoireSvc, analysisRepo,
		services.WithFingerprintRepo(fingerprintRepo),
		services.WithEngineService(engineSvc),
	)
	lichessSvc := services.NewLichessService()
	chesscomSvc := services.NewChesscomService()
	syncSvc := services.NewSyncService(userRepo, importSvc, lichessSvc, chesscomSvc)
	studyImportSvc := services.NewStudyImportService(lichessSvc, repertoireSvc, userRepo)

	// Initialize handlers
	authHandler := handlers.NewAuthHandler(authSvc)
	oauthHandler := handlers.NewOAuthHandler(oauthSvc, userRepo, cfg.FrontendURL, cfg.JWTSecret, cfg.SecureCookies)
	syncHandler := handlers.NewSyncHandler(syncSvc)
	studyImportHandler := handlers.NewStudyImportHandler(studyImportSvc)

	// Initialize Echo
	e := echo.New()
	e.HideBanner = true

	// Middleware
	e.Use(middleware.Logger())
	e.Use(middleware.Recover())
	e.Use(middleware.CORSWithConfig(middleware.CORSConfig{
		AllowOrigins: cfg.AllowedOrigins,
		AllowMethods: []string{http.MethodGet, http.MethodPost, http.MethodPut, http.MethodPatch, http.MethodDelete},
		AllowHeaders: []string{echo.HeaderOrigin, echo.HeaderContentType, echo.HeaderAccept, echo.HeaderAuthorization},
	}))

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
	e.GET("/api/health", handlers.HealthHandler)

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
	e.GET("/api/auth/lichess/login", oauthHandler.LoginRedirect)
	e.GET("/api/auth/lichess/callback", oauthHandler.Callback)

	// Protected routes (auth required)
	protected := e.Group("", appMiddleware.JWTAuth(authSvc))

	// Auth - current user
	protected.GET("/api/auth/me", authHandler.MeHandler)
	protected.PUT("/api/auth/profile", authHandler.UpdateProfileHandler)

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
	protected.POST("/api/repertoires/merge", handlers.MergeRepertoiresHandler(repertoireSvc))
	protected.POST("/api/repertoires/:id/extract", handlers.ExtractSubtreeHandler(repertoireSvc))
	protected.POST("/api/repertoires/:id/merge-transpositions", handlers.MergeTranspositionsHandler(repertoireSvc))

	// Import/Analysis API
	importHandler := handlers.NewImportHandler(importSvc, lichessSvc, chesscomSvc)
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

	// Sync API
	protected.POST("/api/sync", syncHandler.HandleSync)

	// Games API
	protected.GET("/api/games/insights", importHandler.GetInsightsHandler)
	protected.GET("/api/games/repertoires", importHandler.GetDistinctRepertoiresHandler)
	protected.GET("/api/games", importHandler.GetGamesHandler)
	protected.DELETE("/api/games/:analysisId/:gameIndex", importHandler.DeleteGameHandler)
	protected.POST("/api/games/bulk-delete", importHandler.BulkDeleteGamesHandler)
	protected.POST("/api/games/:analysisId/:gameIndex/reanalyze", importHandler.ReanalyzeGameHandler)
	protected.POST("/api/games/:analysisId/:gameIndex/view", importHandler.MarkGameViewedHandler)

	// Start opening analysis worker
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go engineSvc.RunWorker(ctx)

	log.Printf("Starting server on :%d", cfg.Port)
	if err := e.Start(fmt.Sprintf(":%d", cfg.Port)); err != nil {
		log.Fatal(err)
	}
}

// securityHeaders adds standard security headers to all responses.
func securityHeaders(next echo.HandlerFunc) echo.HandlerFunc {
	return func(c echo.Context) error {
		c.Response().Header().Set("X-Content-Type-Options", "nosniff")
		c.Response().Header().Set("X-Frame-Options", "DENY")
		c.Response().Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")
		c.Response().Header().Set("X-XSS-Protection", "1; mode=block")
		return next(c)
	}
}
