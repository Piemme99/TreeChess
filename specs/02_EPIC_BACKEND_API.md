# Epic 2: Backend API

**Framework:** Echo v4
**Database Driver:** pgx v5
**Chess Library:** notnil/chess
**Status:** In Progress (Repertoire CRUD complete, Import/Analysis pending)
**Dependencies:** Epic 1 (Infrastructure)

---

## Objective

Create a complete Go backend using Echo that connects to PostgreSQL, exposes REST endpoints for repertoire CRUD and PGN analysis, and handles errors gracefully implements repository pattern,. Repertoires are auto-created at startup.

---

## Definition of Done

- [x] PostgreSQL connection works with pgx
- [x] Repertoire can be fetched by color (GET /api/repertoire/:color)
- [x] Node can be added (POST /api/repertoire/:color/node)
- [x] Node can be deleted (DELETE /api/repertoire/:color/node/:id)
- [ ] PGN import and analysis works (POST /api/imports)
- [ ] Analyses can be listed and deleted (GET/DELETE /api/analyses/:id)
- [x] Health check works (GET /api/health)
- [x] Logging middleware is in place
- [x] Configuration is loaded from environment
- [x] Tests pass (50% coverage)

---

## Tickets

### BACKEND-001: Create config loader ✅ DONE
**Description:** Implement configuration loading from environment variables.
**Acceptance:**
- [x] DATABASE_URL loaded from env or default
- [x] PORT loaded from env or default 8080
- [x] Config struct exported
- [x] MustLoad function panics on error
**Dependencies:** None

### BACKEND-002: Create database connection ✅ DONE
**Description:** Implement pgx connection pool initialization.
**Acceptance:**
- [x] Connection pool created from config
- [x] Ping succeeds on startup
- [x] Pool exposed via GetPool function
- [x] CloseDB function properly closes pool
**Dependencies:** BACKEND-001

### BACKEND-003: Define data models ✅ DONE
**Description:** Create Go structs for RepertoireNode, Repertoire, and request types.
**Acceptance:**
- [x] Color type with White/Black constants
- [x] RepertoireNode struct with all fields
- [x] Repertoire struct with metadata
- [x] AddNodeRequest struct
- [x] Analysis-related structs (GameAnalysis, MoveAnalysis)
- [x] JSON tags on all exported fields
**Dependencies:** None

### BACKEND-004: Implement repertoire repository ✅ DONE
**Description:** Create repository methods for CRUD operations.
**Acceptance:**
- [x] GetRepertoireByColor returns full repertoire
- [x] CreateRepertoire creates empty tree with root node
- [x] SaveRepertoire updates tree_data and metadata
- [x] JSON marshaling/unmarshaling works
**Dependencies:** BACKEND-002, BACKEND-003

### BACKEND-005: Implement repertoire service ✅ DONE
**Description:** Create service layer with business logic for repertoire operations.
**Acceptance:**
- [x] CreateRepertoire validates color
- [x] GetRepertoire validates color
- [x] AddNode finds parent and appends child
- [x] DeleteNode removes node recursively
- [x] Metadata updated on mutations
- [x] Errors returned for invalid operations
**Dependencies:** BACKEND-004

### BACKEND-006: Create health handler ✅ DONE
**Description:** Implement /api/health endpoint.
**Acceptance:**
- [x] GET /api/health returns 200
- [x] Response is JSON with status field
**Dependencies:** None

### BACKEND-007: Create repertoire handler ✅ DONE
**Description:** Implement API endpoints for repertoire CRUD.
**Acceptance:**
- [x] GET /api/repertoire/:color returns repertoire (auto-created at startup)
- [x] POST /api/repertoire/:color/node adds node
- [x] DELETE /api/repertoire/:color/node/:id deletes node
- [x] Proper error handling with HTTP status codes
**Dependencies:** BACKEND-005

### BACKEND-008: Wire main.go ✅ DONE
**Description:** Connect all backend components in main.go.
**Acceptance:**
- [x] Config loaded at startup
- [x] Database initialized
- [x] Repertoires auto-created for white and black if not exist
- [x] Echo instance created with middleware
- [x] CORS configured for localhost:5173
- [x] Logger middleware active
- [x] Routes registered
- [x] Server starts on configured port
**Dependencies:** BACKEND-006, BACKEND-007

### BACKEND-004b: Implement import repository ⏳ PENDING
**Description:** Create repository methods for analyses storage.
**Acceptance:**
- [ ] SaveAnalysis stores filename, color, gameCount, results
- [ ] GetAnalyses returns list with summary (filtered by color optional)
- [ ] GetAnalysisByID returns full analysis with results
- [ ] DeleteAnalysis removes analysis
- [ ] Results stored as JSONB
**Dependencies:** BACKEND-002, BACKEND-003

### BACKEND-005b: Implement import service ⏳ PENDING
**Description:** Create service layer for PGN parsing and analysis.
**Acceptance:**
- [ ] ParsePGN extracts games and headers
- [ ] AnalyzeGame classifies each move against repertoire
- [ ] Results structured as GameAnalysis[]
- [ ] Color parameter determines which repertoire to analyze against
- [ ] Errors returned for invalid PGN
**Dependencies:** BACKEND-004b, BACKEND-005

### BACKEND-009: Create import/analysis handler ⏳ PENDING
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

| Method | Path | Description | Status |
|--------|------|-------------|--------|
| GET | /api/health | Health check | ✅ Done |
| GET | /api/repertoire/:color | Get repertoire (white/black) | ✅ Done |
| POST | /api/repertoire/:color/node | Add node to repertoire | ✅ Done |
| DELETE | /api/repertoire/:color/node/:id | Delete node from repertoire | ✅ Done |
| POST | /api/imports | Upload PGN + auto analyze | ⏳ Pending |
| GET | /api/analyses | List all analyses | ⏳ Pending |
| GET | /api/analyses/:id | Get analysis details | ⏳ Pending |
| DELETE | /api/analyses/:id | Delete analysis | ⏳ Pending |

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
│   │   └── repertoire.go
│   ├── models/
│   │   └── repertoire.go
│   ├── repository/
│   │   ├── db.go
│   │   └── repertoire_repo.go
│   └── services/
│       └── repertoire_service.go
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
