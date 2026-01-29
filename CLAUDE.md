# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build and Development Commands

### Backend (Go)
```bash
cd backend
go mod download               # Install dependencies
air                           # Dev server with hot reload
go build -o server .          # Build binary
go test ./...                 # Run all tests
go test -v -run TestName ./internal/services/        # Run single test
go test -v -run "TestA|TestB" ./internal/handlers/   # Multiple patterns
go test -coverprofile=coverage.out ./...              # Coverage
golangci-lint run ./...       # Linting
```

### Frontend (React/TypeScript)
```bash
cd frontend
npm install                   # Install dependencies
npm run dev                   # Dev server (port 5173)
npm run build                 # Production build (runs tsc first)
npm run lint                  # ESLint (--max-warnings 0)
```

### Docker (Full Stack)
```bash
docker-compose up --build     # Build and start all services
docker-compose up -d          # Background mode
docker-compose down           # Stop all
```

Services: Frontend (5173), Backend (8080), PostgreSQL (5432)

## Architecture

**Stack:** React 18 + TypeScript + Vite | Go 1.25 + Echo + pgx | PostgreSQL 15+ (JSONB)

**Backend Structure** (`backend/`):
- `main.go` - Entry point, initializes DB, routes, services via dependency injection
- `internal/handlers/` - HTTP request handlers (return Echo handler functions)
- `internal/services/` - Business logic (RepertoireService, ImportService, VideoService, TreeBuilderService)
- `internal/recognition/` - Chess position recognition via GoCV (board detection, template matching, FEN extraction)
- `internal/repository/` - Database access layer with interfaces for testability
- `internal/models/` - Data structures (RepertoireNode, Repertoire, VideoImport, VideoPosition)
- `config/config.go` - Environment-based configuration

**Frontend Structure** (`frontend/src/`):
- `App.tsx` - React Router (Dashboard, RepertoireEdit, GameAnalysis, VideoRepertoirePreview)
- `features/` - Feature modules (repertoire/, game-analysis/, analyse-import/, analyse-tab/, video-import/)
- `shared/` - Shared components and utilities
- `stores/` - Zustand state management
- `services/api.ts` - Axios API client

**Data Flow:**
1. Repertoires stored as JSONB tree in PostgreSQL
2. Frontend fetches via GET `/api/repertoires` or `/api/repertoires/:id`
3. Moves added via POST `/api/repertoires/:id/nodes`
4. PGN files analyzed against repertoire via `/api/imports`
5. YouTube videos imported via `/api/video-imports` (pipeline: yt-dlp -> ffmpeg -> GoCV recognition -> Go tree builder)

**Video Pipeline Detail:**
- `internal/recognition/` - Native Go package using GoCV for chess position recognition:
  - `recognition.go` - Public API: `RecognizeFrames()`, types `Result`, `RecognizedPosition`, `ProgressFunc`
  - `board_detect.go` - Multi-scale checkerboard detection with refinement
  - `template.go` - Template extraction from starting position, averaging, variant synthesis
  - `piece_match.go` - Normalized inverse MSE matching per cell
  - `change_detect.go` - Frame change detection via `gocv.AbsDiff`
  - `fen.go` - FEN board parsing and generation
- `VideoService` uses `Recognizer` interface for testability (inject `gocvRecognizer` or mock)
- `TreeBuilderService` - Transforms FEN sequences into repertoire trees with backtracking detection
- `TreeBuilderOptions` - Configures structural FEN filtering (enabled by default), continuity filtering (disabled by default), and closest-move fallback (enabled by default)
- Filters are best-effort: if all positions are rejected, unfiltered positions are used as fallback

**Backend Testing:**
- Dependency injection with interfaces; mocks in `internal/repository/mocks/`
- Sentinel errors: `ErrRepertoireNotFound`, `ErrAnalysisNotFound`, `ErrVideoImportNotFound`
- Uses testify for assertions (`require.NoError`, `assert.Equal`)

## Key Technical Details

- **Color values:** Backend uses `"white"/"black"` in JSON; frontend uses `'w'/'b'` for chess.js
- **Chess validation:** `notnil/chess` (Go), `chess.js` (frontend) - never trust raw SAN
- **Multiple repertoires:** Users can create multiple repertoires per color (max 50 total)
- **Positions:** Stored as full FEN strings; board-only comparisons use `normalizeBoardFEN()`
- **Transpositions:** Not merged automatically in trees
- **CORS:** Only allows `http://localhost:5173`
- **Video import:** Requires `yt-dlp`, `ffmpeg`, OpenCV (libopencv-dev); paths configurable via env vars (`YTDLP_PATH`, `FFMPEG_PATH`)
- **SSE:** Video import progress streamed via `GET /api/video-imports/:id/progress` (`text/event-stream`)
- **API errors:** JSON format `{"error": "message"}` with appropriate HTTP status codes

## Documentation

- `AGENTS.md` - Code style guidelines, naming conventions, detailed patterns
- `SPECIFICATIONS.md` - Full technical and functional specifications
