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
go test -run TestName ./internal/handlers/   # Run single test
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
- `main.go` - Entry point, initializes DB, routes, services
- `internal/handlers/` - HTTP request handlers
- `internal/services/` - Business logic (RepertoireService, ImportService, ChessService)
- `internal/repository/` - Database access layer
- `internal/models/` - Data structures (RepertoireNode, Repertoire)

**Frontend Structure** (`frontend/src/`):
- `App.tsx` - React Router (Dashboard, RepertoireEdit, ImportList, ImportDetail)
- `components/` - UI organized by feature (Board/, Tree/, Repertoire/, Import/, UI/)
- `stores/` - Zustand state management
- `services/api.ts` - Axios API client

**Data Flow:**
1. Repertoires stored as JSONB tree in PostgreSQL
2. Frontend fetches via GET `/api/repertoire/:color`
3. Moves added via POST `/api/repertoire/:color/node`
4. PGN files analyzed against repertoire via `/api/imports`

## Key Technical Details

- **Color values:** Backend uses `"white"/"black"` in JSON; frontend uses `'w'/'b'` for chess.js
- **Chess validation:** `notnil/chess` (Go), `chess.js` (frontend) - never trust raw SAN
- **Repertoires auto-created:** White and Black repertoires created on first backend startup
- **Positions:** Stored as full FEN strings
- **Transpositions:** Not merged automatically
- **CORS:** Only allows `http://localhost:5173`

## Documentation

- `AGENTS.md` - Code style guidelines, naming conventions, detailed patterns
- `SPECIFICATIONS.md` - Full technical and functional specifications
