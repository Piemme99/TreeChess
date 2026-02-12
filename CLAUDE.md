# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build and Development Commands

### Makefile (preferred)

**Development:**
```bash
make dev                          # Build and start all containers (detached)
make build                        # Build images without starting
make stop                         # Stop all containers
make delete                       # Stop all and delete database volume
make logs                         # Follow container logs
make restart                      # Full stop + rebuild + start
```

**Production:**
```bash
make prod                         # Build and start production containers
make prod-stop                    # Stop production containers
make prod-logs                    # Follow production logs
make prod-restart                 # Full prod stop + rebuild + start
make prod-init-ssl                # Initialize Let's Encrypt SSL (requires DOMAIN and EMAIL)
make prod-renew-ssl               # Dry-run SSL certificate renewal
make prod-backup                  # Run database backup script
make prod-install-backup-cron     # Install automatic backup cron job
```

Services (dev): Frontend (5173), Backend (8080), PostgreSQL (5432), Mailhog SMTP (1025) / Web UI (8025), Prometheus (9091), Grafana (3000)

### Backend (Go)
```bash
cd backend
go mod download                   # Install dependencies
air                               # Dev server with hot reload (requires .air.toml)
go build -o server .              # Build binary
go test ./...                     # Run all tests
go test -v -run TestName ./internal/services/        # Run single test
go test -v -run "TestA|TestB" ./internal/handlers/   # Multiple patterns
go test -v ./tests/integration/...                   # Integration tests (require Docker)
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
npx vitest run -t "test name"    # Run specific test by name
```

## Architecture

**Stack:** React 18 + TypeScript + Vite + Tailwind CSS 4 | Go 1.25 + Echo v4 + pgx v5 | PostgreSQL 17 (JSONB)

### Backend (`backend/`)

**Project structure:**
```
backend/
├── main.go                       # Entry point, dependency wiring, route registration
├── config/                       # Environment-based config + application limits
└── internal/
    ├── handlers/                 # HTTP handlers (auth, repertoire, import, dashboard, explore, etc.)
    ├── middleware/                # JWT auth middleware
    ├── models/                   # Data structures (repertoire, analysis, dashboard, engine, etc.)
    ├── repository/               # Database access
    │   ├── interfaces.go         # Repository interfaces (10 total) for testability
    │   ├── mocks/                # Mock implementations for testing
    │   └── errors.go             # Sentinel errors
    ├── services/                 # Business logic
    │   ├── interfaces.go         # Service interfaces
    │   └── mocks/                # Service mocks for handler testing
    └── testhelpers/              # Test utilities (testcontainers DB, seeds, server)
```

**Key services:**
- `AuthService` - JWT tokens (15 min access + 30-day refresh), password hashing, refresh token rotation
- `RepertoireService` - Tree operations, node CRUD, merge, extract, transposition detection
- `ImportService` - PGN parsing, game analysis against repertoires, adherence scoring
- `SyncService` - Auto-sync games from Lichess/Chess.com
- `LichessService` / `ChesscomService` - External platform APIs
- `StudyImportService` - Import Lichess studies as repertoires
- `CategoryService` - Repertoire categorization
- `OAuthService` - Lichess OAuth PKCE flow
- `EngineService` - Background worker for Lichess Explorer-based evaluations
- `EmailService` - SMTP for password resets
- `PgnTreeParser` - PGN-to-tree converter (with variations support)

**Backend testing:**
- Dependency injection with interfaces; mocks in `internal/repository/mocks/` and `internal/services/mocks/`
- Sentinel errors in `internal/repository/errors.go`: `ErrRepertoireNotFound`, `ErrAnalysisNotFound`, `ErrGameNotFound`, `ErrCategoryNotFound`, `ErrUserNotFound`, `ErrUsernameExists`, `ErrEmailExists`, `ErrResetTokenNotFound`, `ErrRefreshTokenNotFound`
- Uses testify for assertions (`require.NoError`, `assert.Equal`)
- Integration tests in `tests/integration/` use testcontainers for real PostgreSQL instances

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
│   ├── analyse-import/           # Import detail view (per-game analysis)
│   ├── analyse-tab/              # Import/analysis listing tab
│   ├── auth/                     # Login, register, forgot/reset password, onboarding
│   ├── dashboard/                # Stats, health, gaps, branches, recent games
│   ├── explore/                  # Public repertoire browsing
│   ├── game-analysis/            # Individual game replay + move annotations
│   ├── games/                    # Games list page with insights
│   ├── landing/                  # Public landing page
│   ├── not-found/                # 404 page
│   ├── profile/                  # User profile management
│   ├── repertoire/               # Repertoire management
│   │   ├── edit/                 # Board, tree nav, engine, add/delete moves
│   │   └── shared/               # RepertoireTree viz, MoveHistory, StudyBrowser
│   └── training/                 # Training modes (repertoire drill + explorer)
├── services/                     # API client + Stockfish WASM bridge
├── shared/                       # Shared code
│   ├── components/               # Reusable components (Layout, UI, Board, ErrorBoundary)
│   ├── hooks/                    # Custom React hooks (useAbortController, useAnalysisBase, useChess, usePageTitle)
│   └── utils/                    # Utility functions (chess.ts, animations.ts)
├── stores/                       # Zustand state stores
├── test/                         # Test setup
└── types/                        # TypeScript type definitions
```

**Routes** (defined in `App.tsx`):
- Public: `/`, `/login`, `/forgot-password`, `/reset-password`
- Protected: `/dashboard`, `/repertoires`, `/repertoire/:id/edit`, `/training`, `/games`, `/analyse/:id/game/:gameIndex`, `/profile`, `/explore`, `/explore/repertoire/:id`

**State management** (Zustand stores in `stores/`):
- `authStore` - User, token, login/register/logout, OAuth, sync triggers, profile update, account deletion
- `repertoireStore` - Repertoires list, selected node, tree operations, categories, CRUD
- `engineStore` - Stockfish WASM evaluation state (FEN, depth, score, best move)
- `exploreStore` - Public repertoire browsing state
- `toastStore` - Toast notification queue

**API client:** `services/api.ts` - Axios with JWT Bearer token injection (in-memory only, never localStorage). Automatic 401 retry via httpOnly refresh cookie with request queuing. Exports `authApi`, `repertoireApi`, `categoryApi`, `analysisApi`, `gameApi`, `importApi`, `studyApi`, `syncApi`, `exploreApi`, `dashboardApi`, `trainingApi`.

**Stockfish:** `services/stockfish.ts` - Stockfish WASM web worker bridge for browser-side engine analysis in the repertoire editor.

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
7. Dashboard stats aggregated via `/api/dashboard/stats`
8. Training analysis via `/api/training/analyze`
9. Public repertoires browsed/imported via `/api/explore/repertoires`
10. Opening insights generated by background `EngineService` worker using Lichess Explorer API

## Authentication & Middleware

- **JWT auth:** Short-lived access tokens (15 min) stored in memory. Refresh tokens via httpOnly cookies (30-day, single-use rotation). Middleware in `internal/middleware/` extracts `userID` from Bearer token or `token` query param.
- **Lichess OAuth:** PKCE flow via `/api/auth/lichess/login` -> callback -> JWT issued. Cookie encryption via HKDF.
- **Rate limiting:** 100 req/min global (burst 20), 10 req/min for auth endpoints (burst 5)
- **Body limit:** 10MB max request size
- **CORS:** Configurable origins via `CORS_ALLOWED_ORIGINS` env var (default `http://localhost:5173`)
- **Password reset:** Email with token via SMTP (Mailhog in dev). All refresh tokens revoked on password change/reset.
- **Security headers:** `Permissions-Policy`, `X-Content-Type-Options`, `X-Frame-Options`, `X-XSS-Protection`, `Referrer-Policy`, `HSTS`, `CSP`
- **Metrics:** Prometheus endpoint on port 9090 (separate from main API on 8080), prefix: `treechess`

## Key Technical Details

- **Color values:** Backend uses `"white"/"black"` in JSON; frontend uses `'w'/'b'` for chess.js
- **Chess validation:** `notnil/chess` (Go), `chess.js` (frontend) - never trust raw SAN
- **Multiple repertoires:** Users can create multiple repertoires per color (max 50 total)
- **Positions:** Stored as full FEN strings; board-only comparisons use `normalizeBoardFEN()`
- **Transpositions:** Can be auto-merged via POST `/api/repertoires/:id/merge-transpositions`
- **API errors:** JSON format `{"error": "message"}` with appropriate HTTP status codes
- **Game deduplication:** `PostgresFingerprintRepo` prevents duplicate game imports
- **Application limits:** Defined in `config/limits.go` (max repertoires: 50, max PGN: 10MB, max games per page: 100)
- **Background worker:** `EngineService.RunWorker` processes engine evaluations via Lichess Explorer API

## Documentation

- `AGENTS.md` - Build commands, code style guidelines, naming conventions, detailed patterns
- `SPECIFICATIONS.md` - Full technical and functional specifications
