package main

import (
	"fmt"
	"log"
	"net/http"

	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"

	"github.com/treechess/backend/config"
	"github.com/treechess/backend/internal/handlers"
	"github.com/treechess/backend/internal/repository"
	"github.com/treechess/backend/internal/services"
)

func main() {
	cfg := config.MustLoad()

	if err := repository.InitDB(cfg); err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}
	defer repository.CloseDB()

	repertoireSvc := services.NewRepertoireService()
	importSvc := services.NewImportService(repertoireSvc)
	lichessSvc := services.NewLichessService()

	e := echo.New()
	e.HideBanner = true

	e.Use(middleware.Logger())
	e.Use(middleware.Recover())
	e.Use(middleware.CORSWithConfig(middleware.CORSConfig{
		AllowOrigins: []string{"http://localhost:5173"},
		AllowMethods: []string{http.MethodGet, http.MethodPost, http.MethodPatch, http.MethodDelete},
		AllowHeaders: []string{echo.HeaderOrigin, echo.HeaderContentType, echo.HeaderAccept},
	}))

	e.GET("/api/health", handlers.HealthHandler)

	// Repertoire API - new endpoints supporting multiple repertoires
	e.GET("/api/repertoires", handlers.ListRepertoiresHandler(repertoireSvc))
	e.POST("/api/repertoires", handlers.CreateRepertoireHandler(repertoireSvc))
	e.GET("/api/repertoire/:id", handlers.GetRepertoireHandler(repertoireSvc))
	e.PATCH("/api/repertoire/:id", handlers.UpdateRepertoireHandler(repertoireSvc))
	e.DELETE("/api/repertoire/:id", handlers.DeleteRepertoireHandler(repertoireSvc))
	e.POST("/api/repertoire/:id/node", handlers.AddNodeHandler(repertoireSvc))
	e.DELETE("/api/repertoire/:id/node/:nodeId", handlers.DeleteNodeHandler(repertoireSvc))

	// Import/Analysis API
	importHandler := handlers.NewImportHandler(importSvc, lichessSvc)
	e.POST("/api/imports", importHandler.UploadHandler)
	e.POST("/api/imports/lichess", importHandler.LichessImportHandler)
	e.GET("/api/analyses", importHandler.ListAnalysesHandler)
	e.GET("/api/analyses/:id", importHandler.GetAnalysisHandler)
	e.DELETE("/api/analyses/:id", importHandler.DeleteAnalysisHandler)
	e.POST("/api/import/validate-pgn", importHandler.ValidatePGNHandler)
	e.POST("/api/import/validate-move", importHandler.ValidateMoveHandler)
	e.GET("/api/import/legal-moves", importHandler.GetLegalMovesHandler)

	// Games API
	e.GET("/api/games", importHandler.GetGamesHandler)
	e.DELETE("/api/games/:analysisId/:gameIndex", importHandler.DeleteGameHandler)

	log.Printf("Starting server on :%d", cfg.Port)
	if err := e.Start(fmt.Sprintf(":%d", cfg.Port)); err != nil {
		log.Fatal(err)
	}
}
