# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build and Development Commands

### Makefile (preferred)
```bash
make dev                          # Build and start all containers (detached)
make build                        # Build images without starting
make stop                         # Stop all containers
make delete                       # Stop all and delete database volume
make logs                         # Follow container logs
make restart                      # Full stop + rebuild + start
```

Services: Frontend (5173), Backend (8080), PostgreSQL (5432), Mailhog SMTP (1025) / Web UI (8025)

### Backend (Go)
```bash
cd backend
go mod download                   # Install dependencies
air                               # Dev server with hot reload (requires .air.toml)
go build -o server .              # Build binary
go test ./...                     # Run all tests
go test -v -run TestName ./internal/services/        # Run single test
go test -v -run "TestA|TestB" ./internal/handlers/   # Multiple patterns
go test -coverprofile=coverage.out ./...              # Coverage
golangci-lint run ./...           # Linting
```

### Frontend (React/TypeScript)
```bash
cd frontend
npm install                       # Install dependencies
npm run dev                       # Dev server (port 5173)
npm run build                     # Production build (runs tsc first)
npm run lint                      # ESLint (--max-warnings 0)
npm run lint -- --fix             # ESLint auto-fix

# Testing (Vitest)
npm run test                      # Run tests in watch mode
npm run test:run                  # Run tests once
npm run test:coverage             # Run tests with coverage
npx vitest run -t "test name"     # Run specific test by name
```

## Architecture

**Stack:** React 18 + TypeScript + Vite | Go 1.25 + Echo v4 + pgx v5 | PostgreSQL 15+ (JSONB)

### Backend (`backend/`)

**Project structure:**
```
backend/
├── main.go                       # Entry point, dependency wiring
├── config/                       # Environment-based configuration
└── internal/
    ├── handlers/                 # HTTP handlers (return Echo handler functions)
    ├── middleware/               # JWT auth, rate limiting
    ├── models/                   # Data structures
    ├── repository/               # Database access
    │   ├── interfaces.go         # Repository interfaces for testability
    │   ├── mocks/                # Mock implementations for testing
    │   └── errors.go             # Sentinel errors (ErrRepertoireNotFound, etc.)
    ├── services/                 # Business logic
    └── testhelpers/              # Test utilities
```

**Key services:**
- `AuthService` - JWT tokens, password hashing
- `RepertoireService` - Tree operations, node CRUD, merge, extract
- `ImportService` - PGN parsing, game analysis against repertoires
- `SyncService` - Auto-sync games from Lichess/Chess.com
- `LichessService` / `ChesscomService` - External platform APIs
- `StudyImportService` - Import Lichess studies as repertoires
- `CategoryService` - Repertoire categorization
- `EmailService` - SMTP for password resets

**Backend testing:**
- Dependency injection with interfaces; mocks in `internal/repository/mocks/`
- Sentinel errors defined in `internal/repository/errors.go`: `ErrRepertoireNotFound`, `ErrAnalysisNotFound`, `ErrCategoryNotFound`, `ErrUserNotFound`
- Uses testify for assertions (`require.NoError`, `assert.Equal`)

**Code style (Go):**
- Imports: stdlib, third-party, local packages (separated by blank lines)
- Naming: PascalCase for exported, camelCase for unexported, `Err` prefix for errors
- Error handling: Wrap with `fmt.Errorf("...: %w", err)`
- Check sentinel errors with `errors.Is(err, repository.ErrXxx)`

### Frontend (`frontend/src/`)

**Project structure:**
```
src/
├── features/                     # Feature modules
│   ├── auth/
│   ├── dashboard/
│   ├── game-analysis/
│   ├── games/
│   ├── landing/
│   ├── profile/
│   └── repertoire/
├── services/                     # API clients
├── shared/                       # Shared code
│   ├── components/               # Reusable components (Layout, UI, Board)
│   ├── hooks/                    # Custom React hooks
│   └── utils/                    # Utility functions
├── stores/                       # Zustand state stores
├── test/                         # Test setup
└── types/                        # TypeScript type definitions
```

**Routes** (defined in `App.tsx`):
- Public: `/`, `/login`, `/forgot-password`, `/reset-password`
- Protected: `/dashboard`, `/repertoires`, `/repertoire/:id/edit`, `/games`, `/analyse/:id/game/:gameIdx`, `/profile`

**State management** (Zustand stores in `stores/`):
- `authStore` - User, token, login/register/logout, OAuth, sync triggers
- `repertoireStore` - Repertoires list, selected node, tree operations, categories
- `engineStore` - Engine evaluation state
- `toastStore` - Notifications

**API client:** `services/api.ts` - Axios with JWT Bearer token injection. Exports `authApi`, `repertoireApi`, `categoryApi`, `analysisApi`, `gameApi`, `importApi`, `studyApi`, `syncApi`.

**Code style (TypeScript/React):**
- Imports: External packages first, then relative imports
- Naming: PascalCase for components, camelCase for functions/variables, `use` prefix for hooks
- Types: Prefer `interface` for objects, `type` for unions
- Functional components with hooks
- 2-space indent, semicolons required

### Data Flow

1. Repertoires stored as JSONB tree in PostgreSQL
2. Frontend fetches via GET `/api/repertoires` or `/api/repertoires/:id`
3. Moves added via POST `/api/repertoires/:id/nodes`
4. PGN files analyzed against repertoire via `/api/imports`
5. Games auto-synced from Lichess/Chess.com via `/api/sync`
6. Lichess studies imported via `/api/studies/import`

## Authentication & Middleware

- **JWT auth:** Stateless, 7-day default expiry. Middleware in `internal/middleware/` extracts `userID` from Bearer token or `token` query param.
- **Lichess OAuth:** Login flow via `/api/auth/lichess/login` -> callback -> JWT issued
- **Rate limiting:** 100 req/min global, 10 req/min for auth endpoints
- **Body limit:** 10MB max request size
- **CORS:** Configured origins (default `http://localhost:5173`)
- **Password reset:** Email with token via SMTP (Mailhog in dev)

## Key Technical Details

- **Color values:** Backend uses `"white"/"black"` in JSON; frontend uses `'w'/'b'` for chess.js
- **Chess validation:** `notnil/chess` (Go), `chess.js` (frontend) - never trust raw SAN
- **Multiple repertoires:** Users can create multiple repertoires per color (max 50 total)
- **Positions:** Stored as full FEN strings; board-only comparisons use `normalizeBoardFEN()`
- **Transpositions:** Not merged automatically in trees
- **API errors:** JSON format `{"error": "message"}` with appropriate HTTP status codes
- **Game deduplication:** `PostgresFingerprintRepo` prevents duplicate game imports

## Documentation

- `AGENTS.md` - Build commands, code style guidelines, naming conventions, detailed patterns
- `SPECIFICATIONS.md` - Full technical and functional specifications
