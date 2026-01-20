# Epic 2: Backend API

**Framework:** Echo v4
**Database Driver:** pgx v5
**Chess Library:** notnil/chess
**Status:** Not Started
**Dependencies:** Epic 1 (Infrastructure)

---

## Objective

Create a complete Go backend using Echo that connects to PostgreSQL, exposes REST endpoints for repertoire CRUD and PGN analysis, implements repository pattern, and handles errors gracefully. Repertoires are auto-created at startup.

---

## Definition of Done

- [ ] PostgreSQL connection works with pgx
- [ ] Repertoire can be fetched by color (GET /api/repertoire/:color)
- [ ] Node can be added (POST /api/repertoire/:color/node)
- [ ] Node can be deleted (DELETE /api/repertoire/:color/node/:id)
- [ ] PGN import and analysis works (POST /api/imports)
- [ ] Analyses can be listed and deleted (GET/DELETE /api/analyses/:id)
- [ ] Health check works (GET /api/health)
- [ ] Logging middleware is in place
- [ ] Configuration is loaded from environment
- [ ] Tests pass (50% coverage)

---

## Tickets

### BACKEND-001: Create config loader
**Description:** Implement configuration loading from environment variables.
**Acceptance:**
- [ ] DATABASE_URL loaded from env or default
- [ ] PORT loaded from env or default 8080
- [ ] Config struct exported
- [ ] MustLoad function panics on error
**Dependencies:** None

### BACKEND-002: Create database connection
**Description:** Implement pgx connection pool initialization.
**Acceptance:**
- [ ] Connection pool created from config
- [ ] Ping succeeds on startup
- [ ] Pool exposed via GetPool function
- [ ] CloseDB function properly closes pool
**Dependencies:** BACKEND-001

### BACKEND-003: Define data models
**Description:** Create Go structs for RepertoireNode, Repertoire, and request types.
**Acceptance:**
- [ ] Color type with White/Black constants
- [ ] RepertoireNode struct with all fields
- [ ] Repertoire struct with metadata
- [ ] AddNodeRequest struct
- [ ] Analysis-related structs (GameAnalysis, MoveAnalysis)
- [ ] JSON tags on all exported fields
**Dependencies:** None

### BACKEND-004: Implement repertoire repository
**Description:** Create repository methods for CRUD operations.
**Acceptance:**
- [ ] GetRepertoireByColor returns full repertoire
- [ ] CreateRepertoire creates empty tree with root node
- [ ] SaveRepertoire updates tree_data and metadata
- [ ] JSON marshaling/unmarshaling works
**Dependencies:** BACKEND-002, BACKEND-003

### BACKEND-004b: Implement import repository
**Description:** Create repository methods for analyses storage.
**Acceptance:**
- [ ] SaveAnalysis stores filename, color, gameCount, results
- [ ] GetAnalyses returns list with summary (filtered by color optional)
- [ ] GetAnalysisByID returns full analysis with results
- [ ] DeleteAnalysis removes analysis
- [ ] Results stored as JSONB
**Dependencies:** BACKEND-002, BACKEND-003

### BACKEND-005: Implement repertoire service
**Description:** Create service layer with business logic for repertoire operations.
**Acceptance:**
- [ ] CreateRepertoire validates color
- [ ] GetRepertoire validates color
- [ ] AddNode finds parent and appends child
- [ ] DeleteNode removes node recursively
- [ ] Metadata updated on mutations
- [ ] Errors returned for invalid operations
**Dependencies:** BACKEND-004

### BACKEND-005b: Implement import service
**Description:** Create service layer for PGN parsing and analysis.
**Acceptance:**
- [ ] ParsePGN extracts games and headers
- [ ] AnalyzeGame classifies each move against repertoire
- [ ] Results structured as GameAnalysis[]
- [ ] Color parameter determines which repertoire to analyze against
- [ ] Errors returned for invalid PGN
**Dependencies:** BACKEND-004b, BACKEND-005

### BACKEND-006: Create health handler
**Description:** Implement /api/health endpoint.
**Acceptance:**
- [ ] GET /api/health returns 200
- [ ] Response is JSON with status field
**Dependencies:** None

### BACKEND-007: Create repertoire handler
**Description:** Implement API endpoints for repertoire CRUD.
**Acceptance:**
- [ ] GET /api/repertoire/:color returns repertoire (auto-created at startup)
- [ ] POST /api/repertoire/:color/node adds node
- [ ] DELETE /api/repertoire/:color/node/:id deletes node
- [ ] Proper error handling with HTTP status codes
**Dependencies:** BACKEND-005

### BACKEND-008: Wire main.go
**Description:** Connect all backend components in main.go.
**Acceptance:**
- [ ] Config loaded at startup
- [ ] Database initialized
- [ ] Repertoires auto-created for white and black if not exist
- [ ] Echo instance created with middleware
- [ ] CORS configured for localhost:5173
- [ ] Logger middleware active
- [ ] Routes registered
- [ ] Server starts on configured port
**Dependencies:** BACKEND-006, BACKEND-007

### BACKEND-009: Create import/analysis handler
**Description:** Implement API endpoints for PGN import and analysis.
**Acceptance:**
- [ ] POST /api/imports handles multipart upload with color parameter
- [ ] PGN parsed and analyzed immediately against specified repertoire
- [ ] Results stored in analyses table with color
- [ ] GET /api/analyses returns list
- [ ] GET /api/analyses/:id returns full details
- [ ] DELETE /api/analyses/:id removes analysis
- [ ] Proper error handling with HTTP status codes
**Dependencies:** BACKEND-005b

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/health | Health check |
| GET | /api/repertoire/:color | Get repertoire (white/black) |
| POST | /api/repertoire/:color/node | Add node to repertoire |
| DELETE | /api/repertoire/:color/node/:id | Delete node from repertoire |
| POST | /api/imports | Upload PGN + auto analyze |
| GET | /api/analyses | List all analyses |
| GET | /api/analyses/:id | Get analysis details |
| DELETE | /api/analyses/:id | Delete analysis |

**Note:** Repertoires are auto-created at startup. No POST /api/repertoire endpoint needed.

---

## Backend Directory Structure

```
backend/
├── main.go
├── config/
│   └── config.go
├── internal/
│   ├── handlers/
│   │   ├── health.go
│   │   ├── repertoire.go
│   │   └── import.go
│   ├── middleware/
│   │   └── logger.go
│   ├── models/
│   │   └── repertoire.go
│   ├── repository/
│   │   ├── db.go
│   │   ├── repertoire_repo.go
│   │   └── import_repo.go
│   └── services/
│       ├── repertoire_service.go
│       ├── import_service.go
│       └── chess_service.go
└── go.mod
```

---

## Dependencies to Other Epics

- Chess Logic (Epic 3) uses notnil/chess for move validation
- Frontend Core (Epic 4) will consume this API
- PGN Import (Epic 7) uses the import endpoints

## Go Dependencies

```bash
go get github.com/labstack/echo/v4
go get github.com/jackc/pgx/v5/pgxpool
go get github.com/google/uuid
go get github.com/notnil/chess
```
