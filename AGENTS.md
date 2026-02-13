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
│   └── go.mod        # Module: github.com/kumquat/backend
├── frontend/         # React 19 + TypeScript 5 + Vite 5
│   ├── src/{features,services,shared,stores,test,types}/
│   └── package.json
├── migrations/       # SQL schema migrations
├── monitoring/       # Prometheus + Grafana configs
├── scripts/          # Backup, restore, SSL init scripts
├── testdata/         # Sample PGNs and repertoire seed data
├── Makefile          # Docker orchestration (dev + production)
├── docker-compose.yml       # Development
└── docker-compose.prod.yml  # Production
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

### Testing & Linting (Makefile)

```bash
make test                     # Run all tests (frontend + backend)
make test-frontend            # Vitest only
make test-backend             # Go unit tests only
make test-integration         # Go integration tests (requires Docker, -timeout 300s)
make lint                     # Run all linters (frontend + backend)
make lint-frontend            # ESLint + TypeScript check (npx tsc --noEmit)
make lint-backend             # go vet + golangci-lint
```

### Frontend (cd frontend)

```bash
npm run dev                    # Dev server (port 5173, hot reload)
npm run build                  # tsc && vite build (type check + production build)
npm run lint                   # ESLint (--max-warnings 0)
npm run lint -- --fix          # ESLint auto-fix
npx tsc --noEmit               # Type check only (no emit)
npm run test                   # Run tests in watch mode (Vitest 4)
npm run test:run               # Run tests once
npm run test:coverage          # Run tests with coverage
npx vitest run -t "test name"  # Run specific test by name
```

### Backend (cd backend)

```bash
go build -o server .                                 # Build binary
go test -v -run TestName ./internal/services/        # Run single test by name in a package
go test -v -run "TestA|TestB" ./internal/...         # Multiple patterns
go test -v ./internal/handlers/                      # Run all tests in a package
go test ./...                                        # Run all tests
go test -v -tags=integration -timeout 300s ./tests/integration/...  # Integration tests
go test -coverprofile=coverage.out ./...             # Coverage
golangci-lint run ./...                              # Lint
```

## Code Style Guidelines

### Go (Backend)

**Imports:** Three groups separated by blank lines: stdlib, third-party, local packages.

```go
import (
    "errors"
    "net/http"

    "github.com/google/uuid"
    "github.com/labstack/echo/v4"

    "github.com/kumquat/backend/internal/models"
    "github.com/kumquat/backend/internal/services"
)
```

**Naming:**
- Packages: lowercase (`repository`, `handlers`, `services`)
- Exported: PascalCase (`RepertoireService`, `AddNodeHandler`)
- Unexported: camelCase (`findNode`, `moveExistsAsChild`)
- Errors: `Err` prefix as package-level vars (`ErrNotFound`, `ErrInvalidMove`)
- Interfaces: in `repository/interfaces.go` and `services/interfaces.go`
- Test functions: `TestServiceName_MethodName_Scenario`

**Error Handling:** Sentinel errors use `fmt.Errorf(...)`. Wrap with `%w`, check with `errors.Is()`:

```go
// Sentinel errors (in repository/errors.go or at service top-level)
var ErrRepertoireNotFound = fmt.Errorf("repertoire not found")

// Wrapping
return nil, fmt.Errorf("failed to fetch repertoire: %w", err)

// Checking
if errors.Is(err, repository.ErrRepertoireNotFound) { ... }
```

**Handler Pattern:** Handlers are closures returning `echo.HandlerFunc`:

```go
func CreateRepertoireHandler(svc services.RepertoireServiceInterface) echo.HandlerFunc {
    return func(c echo.Context) error { ... }
}
```

**Testing:** testify (`require` for fatal, `assert` for non-fatal). Hand-written mocks use `XxxFunc` fields:

```go
mock := &mocks.MockRepertoireRepo{
    CreateRepertoireFunc: func(ctx context.Context, r *models.Repertoire) error {
        return nil
    },
}
svc := services.NewRepertoireService(mock)
```

**Types:** Typed constants with JSON tags. Use `*string` for nullable fields with `omitempty`.

### TypeScript/React (Frontend)

**Imports:** External packages first, then relative imports (blank line between groups preferred but not enforced).

**Naming:**
- Components: PascalCase (`GameAnalysisPage`, `ChessBoard`)
- Hooks: `use` prefix (`useChessNavigation`, `useGameLoader`)
- Variables/functions: camelCase (`currentMoveIndex`, `goToMove`)
- Types/Interfaces: PascalCase (`RepertoireNode`, `GameAnalysis`)
- Constants: SCREAMING_SNAKE_CASE (`DEFAULT_OPENING_PLIES`)
- Zustand stores: `use` + PascalCase + `Store` (`useRepertoireStore`, `useAuthStore`)

**Formatting:** 2-space indent, semicolons required, ~100 char line limit. No Prettier — formatting is by convention.

**Types:** Prefer `interface` for object shapes, `type` for unions/primitives. Centralized in `src/types/index.ts`.

**Components:** Functional components with hooks, named exports (not default). Props via inline interface above component. Lazy loading via `React.lazy()` with `.then(m => ({ default: m.ComponentName }))`.

**Stores (Zustand):** `create<StateInterface>((set, get) => ({...}))` pattern. State interface defines both properties and action methods.

## Key Technologies

- **Backend:** Go 1.25, Echo v4, pgx v5, notnil/chess, testify, golang-jwt/jwt v5, testcontainers
- **Frontend:** React 19, TypeScript 5, Vite 5, Tailwind CSS 4, chess.js, Zustand, Axios, D3, Framer Motion, Vitest 4
- **Database:** PostgreSQL 17 with JSONB for tree storage
- **Architecture:** Repository pattern + DI (backend), Zustand stores (frontend), feature-based module structure

## Important Notes

- Use `chess.js` (frontend) and `notnil/chess` (backend) for move validation — never trust raw SAN
- Color values: Backend uses `"white"/"black"`; frontend uses `'w'/'b'` for chess.js
- All API endpoints return JSON; errors use `{"error": "message"}` format
- Sentinel errors: `repository.ErrRepertoireNotFound`, `repository.ErrAnalysisNotFound`, `repository.ErrGameNotFound`, `repository.ErrCategoryNotFound`, `repository.ErrUserNotFound`, `repository.ErrUsernameExists`, `repository.ErrEmailExists`, `repository.ErrResetTokenNotFound`, `repository.ErrRefreshTokenNotFound`
- Service-level errors: `services.ErrInvalidColor`, `services.ErrRepertoireExists`, `services.ErrInvalidMove`, `services.ErrLimitReached`, etc.
- JWT access tokens: 15 min; refresh tokens: httpOnly cookies, 30-day, single-use rotation
- Application limits in `config/limits.go`: max repertoires 50, max PGN 10MB, max games/page 100, max name 100 chars, max description 500 chars
- Production uses `.env.production` (not `.env`). All prod Make targets pass `--env-file .env.production`

## Workflow Rules

- **Always ask before committing:** After completing any task, always ask the user whether they would like you to commit the changes before proceeding. Never commit automatically without explicit user approval.
