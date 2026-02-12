# Kumquat - Guide for Coding Agents

Live site: **https://kumquatchess.com**

## Project Structure

```
kumquat/
├── backend/          # Go 1.25 + Echo v4 + pgx v5
│   ├── main.go
│   ├── config/       # Environment config + application limits
│   ├── internal/{handlers,middleware,models,repository,services,testhelpers}/
│   ├── tests/integration/
│   └── go.mod
├── frontend/         # React 18 + TypeScript 5 + Vite 5
│   ├── src/{features,services,shared,stores,test,types}/
│   └── package.json
├── migrations/       # SQL schema migrations (001-003)
├── monitoring/       # Prometheus + Grafana configs and dashboards
├── scripts/          # Backup, restore, SSL init scripts
├── testdata/         # Sample PGNs and repertoire seed data
├── Makefile          # Docker orchestration (dev + production)
├── docker-compose.yml       # Development
└── docker-compose.prod.yml  # Production (TLS, monitoring, isolated networks)
```

## Build, Lint, and Test Commands

### Development (Makefile)

```bash
make dev          # Build and start all containers (detached)
make stop         # Stop all containers
make delete       # Stop all and delete database volume
make logs         # Follow container logs
make restart      # Full stop + rebuild + start
```

Services: Frontend (5173), Backend (8080), PostgreSQL (5432), Mailhog SMTP (1025) / Web UI (8025), Prometheus (9091), Grafana (3000)

### Testing & Linting

```bash
make test                     # Run all tests (frontend + backend)
make test-frontend            # Vitest only
make test-backend             # Go unit tests only
make test-integration         # Go integration tests (requires Docker)
make lint                     # Run all linters (frontend + backend)
make lint-frontend            # ESLint + TypeScript check
make lint-backend             # go vet + golangci-lint
```

### Production (local build)

```bash
make prod                     # Build and start production containers
make prod-stop / prod-logs / prod-restart
make prod-init-ssl            # Initialize Let's Encrypt SSL (requires DOMAIN and EMAIL)
make prod-backup              # Run database backup script
make prod-install-backup-cron # Install automatic backup cron job
```

### Production (GHCR images, used by CD pipeline)

```bash
make prod-deploy              # Start production with pre-built GHCR images (IMAGE_TAG=latest)
make prod-deploy-stop         # Stop GHCR production containers
make prod-deploy-logs         # Follow GHCR production logs
```

Production uses `.env.production` (not `.env`). All prod Make targets pass `--env-file .env.production`.

### Frontend

```bash
cd frontend
npm run dev                    # Dev server (port 5173, hot reload)
npm run build                  # Type check + production build
npm run lint                   # ESLint check (--max-warnings 0)
npm run lint -- --fix          # ESLint auto-fix
npx tsc --noEmit               # Type check only
npm run test                   # Run tests in watch mode
npm run test:run               # Run tests once
npm run test:coverage          # Run tests with coverage
npx vitest run -t "test name"  # Run specific test by name
```

### Backend

```bash
cd backend
go build -o server .                                 # Build binary
go test -v -run TestName ./internal/services/        # Run single test by name
go test -v -run "TestA|TestB" ./internal/...         # Multiple patterns
go test -v ./internal/handlers/                      # Run all tests in package
go test ./...                                        # Run all tests
go test -v ./tests/integration/...                   # Integration tests (require Docker)
go test -coverprofile=coverage.out ./...             # Coverage
golangci-lint run ./...                              # Lint
```

## Code Style Guidelines

### Go (Backend)

**Imports:** Group in order: stdlib, third-party, local packages.

```go
import (
    "context"
    "fmt"

    "github.com/labstack/echo/v4"

    "github.com/kumquat/backend/internal/models"
)
```

**Naming:**
- Packages: lowercase (`repository`, `handlers`, `services`)
- Exported: PascalCase (`RepertoireService`, `AddNodeHandler`)
- Unexported: camelCase (`findNode`, `moveExistsAsChild`)
- Errors: `Err` prefix as package vars (`ErrNotFound`, `ErrInvalidMove`)
- Interfaces: in `repository/interfaces.go` and `services/interfaces.go`

**Error Handling:** Wrap with `%w`, check with `errors.Is()`:

```go
return nil, fmt.Errorf("failed to do something: %w", err)
if errors.Is(err, repository.ErrRepertoireNotFound) { ... }
```

**Types:** Typed constants with JSON tags. Use `*string` for nullable fields with `omitempty`.

**Testing:** testify with mock-based DI. Mocks use `XxxFunc` fields. Integration tests use testcontainers.

### TypeScript/React (Frontend)

**Imports:** External packages first, blank line, then relative imports.

**Naming:**
- Components: PascalCase (`GameAnalysisPage`, `ChessBoard`)
- Hooks: `use` prefix (`useChessNavigation`, `useGameLoader`)
- Variables/functions: camelCase (`currentMoveIndex`, `goToMove`)
- Types/Interfaces: PascalCase (`RepertoireNode`, `GameAnalysis`)
- Constants: SCREAMING_SNAKE_CASE (`DEFAULT_OPENING_PLIES`)

**Formatting:** 2-space indent, semicolons required, ~100 char line limit.

**Types:** Prefer `interface` for objects, `type` for unions/primitives.

**React Patterns:** Functional components with hooks. Use `useCallback` for handlers passed as props.

## Key Technologies

- **Backend:** Go 1.25, Echo v4, pgx v5, notnil/chess, testify, golang-jwt/jwt v5, testcontainers
- **Frontend:** React 18, TypeScript 5, Vite 5, Tailwind CSS 4, chess.js, Zustand, Axios, D3, Framer Motion, Lucide React
- **Testing:** Vitest + Testing Library (frontend), Go testing + testify + testcontainers (backend)
- **Database:** PostgreSQL 17 with JSONB for tree storage
- **Monitoring:** Prometheus + Grafana dashboards
- **Architecture:** Repository pattern (backend), Zustand stores (frontend), feature-based module structure

## Important Notes

- Use `chess.js` (frontend) and `notnil/chess` (backend) for move validation
- Store full FEN string for each node in the repertoire tree
- Color values: Backend uses `"white"/"black"`; frontend uses `'w'/'b'` for chess.js
- All API endpoints return JSON; errors use `{"error": "message"}` format
- Backend uses dependency injection with interfaces (`RepertoireRepository`, `AnalysisRepository`, etc.)
- Sentinel errors: `repository.ErrRepertoireNotFound`, `repository.ErrAnalysisNotFound`, `repository.ErrGameNotFound`, `repository.ErrCategoryNotFound`, `repository.ErrUserNotFound`, `repository.ErrUsernameExists`, `repository.ErrEmailExists`, `repository.ErrResetTokenNotFound`, `repository.ErrRefreshTokenNotFound`
- JWT access tokens are short-lived (15 min); refresh tokens via httpOnly cookies (30-day, single-use rotation)
- Application limits defined in `config/limits.go` (max repertoires: 50, max PGN: 10MB, max games per page: 100)
- Background worker: `EngineService.RunWorker` processes evaluations via Lichess Explorer API
- Metrics endpoint on port 9090 (separate from main API on 8080)
- CORS origins configurable via `CORS_ALLOWED_ORIGINS` env var (default `http://localhost:5173`)
