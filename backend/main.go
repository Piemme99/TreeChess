package main

import (
	"fmt"
	"log"
	"net/http"

	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"

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
	videoRepo := repository.NewPostgresVideoRepo(db.Pool)

	// Initialize services
	authSvc := services.NewAuthService(userRepo, cfg.JWTSecret, cfg.JWTExpiry)
	callbackURL := fmt.Sprintf("http://localhost:%d/api/auth/lichess/callback", cfg.Port)
	oauthSvc := services.NewOAuthService(userRepo, authSvc, cfg.LichessClientID, callbackURL)
	repertoireSvc := services.NewRepertoireService(repertoireRepo)
	importSvc := services.NewImportService(repertoireSvc, analysisRepo)
	lichessSvc := services.NewLichessService()
	chesscomSvc := services.NewChesscomService()
	treeSvc := services.NewTreeBuilderService()
	videoSvc := services.NewVideoService(videoRepo, cfg, treeSvc)

	// Initialize handlers
	authHandler := handlers.NewAuthHandler(authSvc)
	oauthHandler := handlers.NewOAuthHandler(oauthSvc, cfg.FrontendURL, cfg.JWTSecret)

	// Initialize Echo
	e := echo.New()
	e.HideBanner = true

	// Middleware
	e.Use(middleware.Logger())
	e.Use(middleware.Recover())
	e.Use(middleware.CORSWithConfig(middleware.CORSConfig{
		AllowOrigins: cfg.AllowedOrigins,
		AllowMethods: []string{http.MethodGet, http.MethodPost, http.MethodPatch, http.MethodDelete},
		AllowHeaders: []string{echo.HeaderOrigin, echo.HeaderContentType, echo.HeaderAccept, echo.HeaderAuthorization},
	}))

	// Public routes (no auth required)
	e.GET("/api/health", handlers.HealthHandler)
	e.POST("/api/auth/register", authHandler.RegisterHandler)
	e.POST("/api/auth/login", authHandler.LoginHandler)
	e.GET("/api/auth/lichess/login", oauthHandler.LoginRedirect)
	e.GET("/api/auth/lichess/callback", oauthHandler.Callback)

	// Protected routes (auth required)
	protected := e.Group("", appMiddleware.JWTAuth(authSvc))

	// Auth - current user
	protected.GET("/api/auth/me", authHandler.MeHandler)

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

	// Games API
	protected.GET("/api/games", importHandler.GetGamesHandler)
	protected.DELETE("/api/games/:analysisId/:gameIndex", importHandler.DeleteGameHandler)
	protected.POST("/api/games/:analysisId/:gameIndex/reanalyze", importHandler.ReanalyzeGameHandler)

	// Video Import API
	videoHandler := handlers.NewVideoHandler(videoSvc, repertoireSvc)
	protected.POST("/api/video-imports", videoHandler.SubmitHandler)
	protected.GET("/api/video-imports", videoHandler.ListHandler)
	protected.GET("/api/video-imports/:id", videoHandler.GetHandler)
	protected.GET("/api/video-imports/:id/progress", videoHandler.ProgressHandler)
	protected.GET("/api/video-imports/:id/tree", videoHandler.TreeHandler)
	protected.POST("/api/video-imports/:id/cancel", videoHandler.CancelHandler)
	protected.POST("/api/video-imports/:id/save", videoHandler.SaveHandler)
	protected.DELETE("/api/video-imports/:id", videoHandler.DeleteHandler)
	protected.GET("/api/video-positions/search", videoHandler.SearchByFENHandler)

	log.Printf("Starting server on :%d", cfg.Port)
	if err := e.Start(fmt.Sprintf(":%d", cfg.Port)); err != nil {
		log.Fatal(err)
	}
}
