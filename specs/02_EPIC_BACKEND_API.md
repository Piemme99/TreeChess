# Epic 2: Backend API

**Framework:** Echo (github.com/labstack/echo/v4)  
**Database Driver:** pgx (github.com/jackc/pgx/v5)  
**Status:** Not Started  
**Dependencies:** Epic 1 (Infrastructure)

---

## 1. Objective

Create a complete Go backend using the **Echo** web framework that:
- Connects to PostgreSQL using pgx
- Exposes REST endpoints for repertoire CRUD
- Implements repository pattern for data access
- Returns JSON responses
- Handles errors gracefully

---

## 2. Definition of Done

- [ ] PostgreSQL connection works with pgx
- [ ] Repertoire can be fetched by color (GET /api/repertoire/:color)
- [ ] Repertoire can be saved (POST /api/repertoire/:color)
- [ ] Node can be added (POST /api/repertoire/:color/node)
- [ ] Node can be deleted (DELETE /api/repertoire/:color/node/:id)
- [ ] Health check works (GET /api/health)
- [ ] Logging middleware is in place
- [ ] Configuration is loaded from environment
- [ ] All tests pass (50% coverage)

---

## 3. Tasks

### 3.1 Project Structure

```
cmd/server/
├── main.go
├── config/
│   └── config.go
├── internal/
│   ├── handlers/
│   │   ├── repertoire.go
│   │   └── health.go
│   ├── repository/
│   │   └── repertoire_repo.go
│   ├── models/
│   │   └── repertoire.go
│   ├── services/
│   │   └── repertoire_service.go
│   └── middleware/
│       └── logger.go
└── go.mod
```

### 3.2 Configuration

**File: `config/config.go`**

```go
package config

import (
    "os"
    "strconv"
)

type Config struct {
    DatabaseURL string
    Port        string
}

func Load() (*Config, error) {
    databaseURL := os.Getenv("DATABASE_URL")
    if databaseURL == "" {
        databaseURL = "postgres://treechess:treechess@localhost:5432/treechess?sslmode=disable"
    }

    port := os.Getenv("PORT")
    if port == "" {
        port = "8080"
    }

    return &Config{
        DatabaseURL: databaseURL,
        Port:        port,
    }, nil
}

func (c *Config) MustLoad() *Config {
    cfg, err := Load()
    if err != nil {
        panic(err)
    }
    return cfg
}
```

### 3.3 Models

**File: `internal/models/repertoire.go`**

```go
package models

import "time"

type Color string

const (
    ColorWhite Color = "white"
    ColorBlack Color = "black"
)

type RepertoireNode struct {
    ID          string            `json:"id"`
    FEN         string            `json:"fen"`
    Move        *string           `json:"move,omitempty"`
    MoveNumber  int               `json:"moveNumber"`
    ColorToMove Color             `json:"colorToMove"`
    ParentID    *string           `json:"parentId,omitempty"`
    Children    []*RepertoireNode `json:"children"`
}

type Repertoire struct {
    ID        string          `json:"id"`
    Color     Color           `json:"color"`
    TreeData  RepertoireNode  `json:"treeData"`
    Metadata  Metadata        `json:"metadata"`
    CreatedAt time.Time       `json:"createdAt"`
    UpdatedAt time.Time       `json:"updatedAt"`
}

type Metadata struct {
    TotalNodes   int `json:"totalNodes"`
    TotalMoves   int `json:"totalMoves"`
    DeepestDepth int `json:"deepestDepth"`
}

type AddNodeRequest struct {
    ParentID    string  `json:"parentId"`
    Move        string  `json:"move"`
    FEN         string  `json:"fen"`
    MoveNumber  int     `json:"moveNumber"`
    ColorToMove Color   `json:"colorToMove"`
}

type DeleteNodeRequest struct {
    NodeID string `json:"nodeId"`
}
```

### 3.4 Database Connection

**File: `internal/repository/db.go`**

```go
package repository

import (
    "context"
    "fmt"

    "github.com/jackc/pgx/v5/pgxpool"
    "github.com/treechess/backend/config"
)

var pool *pgxpool.Pool

func InitDB(cfg *config.Config) error {
    var err error
    pool, err = pgxpool.New(context.Background(), cfg.DatabaseURL)
    if err != nil {
        return fmt.Errorf("failed to connect to database: %w", err)
    }

    if err := pool.Ping(context.Background()); err != nil {
        return fmt.Errorf("failed to ping database: %w", err)
    }

    return nil
}

func GetPool() *pgxpool.Pool {
    return pool
}

func CloseDB() {
    if pool != nil {
        pool.Close()
    }
}
```

### 3.5 Repertoire Repository

**File: `internal/repository/repertoire_repo.go`**

```go
package repository

import (
    "context"
    "encoding/json"
    "fmt"

    "github.com/google/uuid"
    "github.com/treechess/backend/internal/models"
)

type RepertoireRepository struct{}

func NewRepertoireRepository() *RepertoireRepository {
    return &RepertoireRepository{}
}

// GetRepertoireByColor retrieves a repertoire by color (white or black)
func (r *RepertoireRepository) GetRepertoireByColor(color models.Color) (*models.Repertoire, error) {
    query := `
        SELECT id, color, tree_data, metadata, created_at, updated_at
        FROM repertoires
        WHERE color = $1
    `

    var repo models.Repertoire
    var treeDataJSON []byte
    var metadataJSON []byte

    err := GetPool().QueryRow(context.Background(), query, string(color)).Scan(
        &repo.ID,
        &repo.Color,
        &treeDataJSON,
        &metadataJSON,
        &repo.CreatedAt,
        &repo.UpdatedAt,
    )

    if err != nil {
        return nil, fmt.Errorf("repertoire not found: %w", err)
    }

    if err := json.Unmarshal(treeDataJSON, &repo.TreeData); err != nil {
        return nil, fmt.Errorf("failed to unmarshal tree data: %w", err)
    }

    if err := json.Unmarshal(metadataJSON, &repo.Metadata); err != nil {
        return nil, fmt.Errorf("failed to unmarshal metadata: %w", err)
    }

    return &repo, nil
}

// CreateRepertoire creates a new empty repertoire with root node
func (r *RepertoireRepository) CreateRepertoire(color models.Color) (*models.Repertoire, error) {
    rootFEN := "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -"
    
    rootNode := models.RepertoireNode{
        ID:          uuid.New().String(),
        FEN:         rootFEN,
        Move:        nil,
        MoveNumber:  0,
        ColorToMove: models.ColorWhite,
        ParentID:    nil,
        Children:    []*models.RepertoireNode{},
    }

    treeDataJSON, _ := json.Marshal(rootNode)
    metadataJSON, _ := json.Marshal(models.Metadata{
        TotalNodes:   1,
        TotalMoves:   0,
        DeepestDepth: 0,
    })

    query := `
        INSERT INTO repertoires (color, tree_data, metadata)
        VALUES ($1, $2, $3)
        RETURNING id, created_at, updated_at
    `

    repo := models.Repertoire{
        ID:        uuid.New().String(),
        Color:     color,
        TreeData:  rootNode,
        Metadata:  models.Metadata{},
        CreatedAt: time.Now(),
        UpdatedAt: time.Now(),
    }

    err := GetPool().QueryRow(context.Background(), query, string(color), treeDataJSON, metadataJSON).Scan(
        &repo.ID,
        &repo.CreatedAt,
        &repo.UpdatedAt,
    )

    if err != nil {
        return nil, fmt.Errorf("failed to create repertoire: %w", err)
    }

    return &repo, nil
}

// SaveRepertoire updates the entire repertoire tree
func (r *RepertoireRepository) SaveRepertoire(repo *models.Repertoire) error {
    treeDataJSON, err := json.Marshal(repo.TreeData)
    if err != nil {
        return fmt.Errorf("failed to marshal tree data: %w", err)
    }

    metadataJSON, err := json.Marshal(repo.Metadata)
    if err != nil {
        return fmt.Errorf("failed to marshal metadata: %w", err)
    }

    query := `
        UPDATE repertoires
        SET tree_data = $1, metadata = $2, updated_at = NOW()
        WHERE id = $3
    `

    _, err = GetPool().Exec(context.Background(), query, treeDataJSON, metadataJSON, repo.ID)
    if err != nil {
        return fmt.Errorf("failed to save repertoire: %w", err)
    }

    return nil
}

// GetOrCreateRepertoire returns existing or creates new repertoire
func (r *RepertoireRepository) GetOrCreateRepertoire(color models.Color) (*models.Repertoire, error) {
    repo, err := r.GetRepertoireByColor(color)
    if err == nil {
        return repo, nil
    }

    // Create new repertoire
    return r.CreateRepertoire(color)
}
```

### 3.6 Repertoire Service

**File: `internal/services/repertoire_service.go`**

```go
package services

import (
    "errors"
    "fmt"

    "github.com/google/uuid"
    "github.com/treechess/backend/internal/models"
    "github.com/treechess/backend/internal/repository"
)

type RepertoireService struct {
    repo *repository.RepertoireRepository
}

func NewRepertoireService() *RepertoireService {
    return &RepertoireService{
        repo: repository.NewRepertoireRepository(),
    }
}

func (s *RepertoireService) GetRepertoire(color string) (*models.Repertoire, error) {
    if color != "white" && color != "black" {
        return nil, errors.New("invalid color: must be 'white' or 'black'")
    }

    repo, err := s.repo.GetOrCreateRepertoire(models.Color(color))
    if err != nil {
        return nil, fmt.Errorf("failed to get repertoire: %w", err)
    }

    return repo, nil
}

func (s *RepertoireService) AddNode(color string, req models.AddNodeRequest) (*models.Repertoire, error) {
    if color != "white" && color != "black" {
        return nil, errors.New("invalid color: must be 'white' or 'black'")
    }

    repo, err := s.GetRepertoire(color)
    if err != nil {
        return nil, err
    }

    // Find parent node and add child
    parent := findNodeByID(repo.TreeData, req.ParentID)
    if parent == nil {
        return nil, errors.New("parent node not found")
    }

    newNode := &models.RepertoireNode{
        ID:          uuid.New().String(),
        FEN:         req.FEN,
        Move:        &req.Move,
        MoveNumber:  req.MoveNumber,
        ColorToMove: req.ColorToMove,
        ParentID:    &req.ParentID,
        Children:    []*models.RepertoireNode{},
    }

    parent.Children = append(parent.Children, newNode)

    // Update metadata
    repo.Metadata.TotalNodes++
    repo.Metadata.TotalMoves++

    if err := s.repo.SaveRepertoire(repo); err != nil {
        return nil, fmt.Errorf("failed to save repertoire: %w", err)
    }

    return repo, nil
}

func (s *RepertoireService) DeleteNode(color string, nodeID string) (*models.Repertoire, error) {
    if color != "white" && color != "black" {
        return nil, errors.New("invalid color: must be 'white' or 'black'")
    }

    repo, err := s.GetRepertoire(color)
    if err != nil {
        return nil, err
    }

    deleted := deleteNodeRecursive(&repo.TreeData, nodeID)
    if !deleted {
        return nil, errors.New("node not found")
    }

    if err := s.repo.SaveRepertoire(repo); err != nil {
        return nil, fmt.Errorf("failed to save repertoire: %w", err)
    }

    return repo, nil
}

// Helper function to find node by ID
func findNodeByID(root *models.RepertoireNode, id string) *models.RepertoireNode {
    if root.ID == id {
        return root
    }

    for _, child := range root.Children {
        if found := findNodeByID(child, id); found != nil {
            return found
        }
    }

    return nil
}

// Helper function to delete node recursively
func deleteNodeRecursive(root *models.RepertoireNode, id string) bool {
    for i, child := range root.Children {
        if child.ID == id {
            root.Children = append(root.Children[:i], root.Children[i+1:]...)
            return true
        }
        if deleteNodeRecursive(child, id) {
            return true
        }
    }
    return false
}
```

### 3.7 Handlers

**File: `internal/handlers/repertoire.go`**

```go
package handlers

import (
    "encoding/json"
    "net/http"

    "github.com/labstack/echo/v4"
    "github.com/treechess/backend/internal/models"
    "github.com/treechess/backend/internal/services"
)

type RepertoireHandler struct {
    service *services.RepertoireService
}

func NewRepertoireHandler() *RepertoireHandler {
    return &RepertoireHandler{
        service: services.NewRepertoireService(),
    }
}

func (h *RepertoireHandler) RegisterRoutes(e *echo.Echo) {
    e.GET("/api/repertoire/:color", h.GetRepertoire)
    e.POST("/api/repertoire/:color/node", h.AddNode)
    e.DELETE("/api/repertoire/:color/node/:id", h.DeleteNode)
}

func (h *RepertoireHandler) GetRepertoire(c echo.Context) error {
    color := c.Param("color")
    
    repo, err := h.service.GetRepertoire(color)
    if err != nil {
        return c.JSON(http.StatusNotFound, map[string]string{
            "error": err.Error(),
        })
    }

    return c.JSON(http.StatusOK, repo)
}

func (h *RepertoireHandler) AddNode(c echo.Context) error {
    color := c.Param("color")

    var req models.AddNodeRequest
    if err := json.NewDecoder(c.Request().Body).Decode(&req); err != nil {
        return c.JSON(http.StatusBadRequest, map[string]string{
            "error": "invalid request body",
        })
    }

    repo, err := h.service.AddNode(color, req)
    if err != nil {
        return c.JSON(http.StatusBadRequest, map[string]string{
            "error": err.Error(),
        })
    }

    return c.JSON(http.StatusOK, repo)
}

func (h *RepertoireHandler) DeleteNode(c echo.Context) error {
    color := c.Param("color")
    nodeID := c.Param("id")

    repo, err := h.service.DeleteNode(color, nodeID)
    if err != nil {
        return c.JSON(http.StatusBadRequest, map[string]string{
            "error": err.Error(),
        })
    }

    return c.JSON(http.StatusOK, repo)
}
```

**File: `internal/handlers/health.go`**

```go
package handlers

import (
    "net/http"

    "github.com/labstack/echo/v4"
)

type HealthHandler struct{}

func NewHealthHandler() *HealthHandler {
    return &HealthHandler{}
}

func (h *HealthHandler) RegisterRoutes(e *echo.Echo) {
    e.GET("/api/health", h.Health)
}

func (h *HealthHandler) Health(c echo.Context) error {
    return c.JSON(http.StatusOK, map[string]string{
        "status": "ok",
    })
}
```

### 3.8 Middleware

**File: `internal/middleware/logger.go`**

```go
package middleware

import (
    "encoding/json"
    "log"
    "time"

    "github.com/labstack/echo/v4"
)

type LogEntry struct {
    Timestamp string `json:"timestamp"`
    Level     string `json:"level"`
    Message   string `json:"message"`
    Method    string `json:"method"`
    Path      string `json:"path"`
    Status    int    `json:"status"`
    Duration  string `json:"duration"`
}

func Logger(next echo.HandlerFunc) echo.HandlerFunc {
    return func(c echo.Context) error {
        start := time.Now()
        
        err := next(c)
        
        duration := time.Since(start)
        level := "INFO"
        if err != nil {
            level = "ERROR"
        }

        entry := LogEntry{
            Timestamp: start.UTC().Format(time.RFC3339),
            Level:     level,
            Message:   "request completed",
            Method:    c.Request().Method,
            Path:      c.Request().URL.Path,
            Status:    c.Response().Status,
            Duration:  duration.String(),
        }

        entryJSON, _ := json.Marshal(entry)
        log.Println(string(entryJSON))

        return err
    }
}
```

### 3.9 Main Update

**File: `cmd/server/main.go`**

```go
package main

import (
    "log"
    "os"

    "github.com/labstack/echo/v4"
    "github.com/labstack/echo/v4/middleware"
    "github.com/treechess/backend/config"
    "github.com/treechess/backend/internal/handlers"
    "github.com/treechess/backend/internal/middleware"
    "github.com/treechess/backend/internal/repository"
)

func main() {
    cfg := config.MustLoad()

    // Initialize database
    if err := repository.InitDB(cfg); err != nil {
        log.Fatalf("Failed to initialize database: %v", err)
    }
    defer repository.CloseDB()

    // Create Echo instance
    e := echo.New()
    e.HideBanner = true

    // Middleware
    e.Use(middleware.Logger)
    e.Use(middleware.Recover)
    e.Use(middleware.CORSWithConfig(middleware.CORSConfig{
        AllowOrigins: []string{"http://localhost:5173"},
    }))

    // Register handlers
    healthHandler := handlers.NewHealthHandler()
    healthHandler.RegisterRoutes(e)

    repertoireHandler := handlers.NewRepertoireHandler()
    repertoireHandler.RegisterRoutes(e)

    // Start server
    log.Printf("Starting server on :%s", cfg.Port)
    if err := e.Start(":" + cfg.Port); err != nil {
        log.Fatal(err)
    }
}
```

---

## 4. API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/health | Health check |
| GET | /api/repertoire/:color | Get repertoire (white or black) |
| POST | /api/repertoire/:color/node | Add node to repertoire |
| DELETE | /api/repertoire/:color/node/:id | Delete node from repertoire |

### 4.1 GET /api/repertoire/:color

**Response:**
```json
{
  "id": "uuid",
  "color": "white",
  "treeData": {
    "id": "root",
    "fen": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -",
    "move": null,
    "moveNumber": 0,
    "colorToMove": "w",
    "parentId": null,
    "children": []
  },
  "metadata": {
    "totalNodes": 1,
    "totalMoves": 0,
    "deepestDepth": 0
  },
  "createdAt": "2026-01-19T10:00:00Z",
  "updatedAt": "2026-01-19T10:00:00Z"
}
```

### 4.2 POST /api/repertoire/:color/node

**Request:**
```json
{
  "parentId": "root",
  "move": "e4",
  "fen": "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3",
  "moveNumber": 1,
  "colorToMove": "b"
}
```

**Response:** Full updated repertoire

### 4.3 DELETE /api/repertoire/:color/node/:id

**Response:** Full updated repertoire

---

## 5. Testing

### 5.1 Unit Tests

**File: `internal/services/repertoire_service_test.go`**

```go
package services

import (
    "testing"
)

func TestAddNode(t *testing.T) {
    // TODO: Write tests
}

func TestDeleteNode(t *testing.T) {
    // TODO: Write tests
}
```

---

## 6. Dependencies to Other Epics

- Chess Logic (Epic 3) will use this API for validation
- Frontend Core (Epic 4) will consume this API
- PGN Import (Epic 7) will use this API for repertoire operations

---

## 7. Notes

### 7.1 UUID Generation

Uses `github.com/google/uuid` for generating unique node IDs.

### 7.2 Error Handling

All errors are returned as JSON with appropriate HTTP status codes.

### 7.3 CORS

CORS is configured to allow requests from `http://localhost:5173` (Vite dev server).
