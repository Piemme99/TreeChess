# Kumquat - Guide for Coding Agents

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

---

## Build, Lint, and Test Commands

### Quick Start (Makefile - preferred)

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

### Frontend

```bash
cd frontend
npm install                    # Install dependencies
npm run dev                    # Dev server (port 5173, hot reload)
npm run build                  # Type check + production build
npm run lint                   # ESLint check (--max-warnings 0)
npm run lint -- --fix          # ESLint auto-fix
npx tsc --noEmit               # Type check only

# Testing (Vitest)
npm run test                   # Run tests in watch mode
npm run test:run               # Run tests once
npm run test:coverage          # Run tests with coverage
npx vitest run -t "test name"  # Run specific test by name
```

### Backend

```bash
cd backend
go mod download               # Install dependencies
air                           # Dev server with hot reload (requires .air.toml)
go build -o server .          # Build binary

# Testing
go test -v -run TestName ./internal/services/        # Run single test by name
go test -v -run "TestA|TestB" ./internal/...         # Multiple patterns
go test -v ./internal/handlers/                      # Run all tests in package
go test ./...                                        # Run all tests

# Integration tests (require Docker for testcontainers)
go test -v ./tests/integration/...

# Coverage & Linting
go test -coverprofile=coverage.out ./... && go tool cover -html=coverage.out
golangci-lint run ./...
```

### Docker (alternative to Make)

```bash
docker-compose up --build     # Build and start all services
docker-compose up -d          # Run in background
docker-compose logs -f        # Follow logs
docker-compose down           # Stop all services
docker-compose down -v        # Stop and delete database volume
```

---

## Code Style Guidelines

### Go (Backend)

**Imports:** Group in order: stdlib, third-party, local packages.

```go
import (
    "context"
    "fmt"

    "github.com/google/uuid"
    "github.com/labstack/echo/v4"

    "github.com/kumquat/backend/internal/models"
    "github.com/kumquat/backend/internal/repository"
)
```

**Naming:**
- Packages: lowercase (`repository`, `handlers`, `services`)
- Exported: PascalCase (`RepertoireService`, `AddNodeHandler`)
- Unexported: camelCase (`findNode`, `moveExistsAsChild`)
- Errors: `Err` prefix as package vars (`ErrNotFound`, `ErrInvalidMove`)
- Interfaces: Repository interfaces in `internal/repository/interfaces.go`; service interfaces in `internal/services/interfaces.go`

**Error Handling:** Wrap errors with context using `%w`:

```go
if err := doSomething(); err != nil {
    return nil, fmt.Errorf("failed to do something: %w", err)
}

// Sentinel errors pattern (from repository package)
if errors.Is(err, repository.ErrRepertoireNotFound) { ... }
```

**Types:** Use typed constants and JSON tags:

```go
type Color string
const (
    ColorWhite Color = "white"
    ColorBlack Color = "black"
)

type RepertoireNode struct {
    ID          string            `json:"id"`
    FEN         string            `json:"fen"`
    Move        *string           `json:"move,omitempty"`
    ParentID    *string           `json:"parentId,omitempty"`
    Children    []*RepertoireNode `json:"children"`
}
```

**Testing:** Use testify with mock-based dependency injection:

```go
func TestExample(t *testing.T) {
    mockRepo := &mocks.MockRepertoireRepo{
        GetByIDFunc: func(id string) (*models.Repertoire, error) {
            return &models.Repertoire{ID: id}, nil
        },
    }
    svc := NewRepertoireService(mockRepo)
    result, err := svc.GetRepertoire("some-uuid")
    require.NoError(t, err)
    assert.Equal(t, expected, result)
}
```

Integration tests use testcontainers for real PostgreSQL instances (`tests/integration/`).

### TypeScript/React (Frontend)

**Imports:** External packages first, then relative imports:

```typescript
import { useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';

import { useGameLoader } from './hooks/useGameLoader';
import { Button } from '../../shared/components/UI';
import type { Repertoire } from '../../types';
```

**Naming:**
- Components: PascalCase (`GameAnalysisPage`, `ChessBoard`)
- Hooks: `use` prefix (`useChessNavigation`, `useGameLoader`)
- Variables/functions: camelCase (`currentMoveIndex`, `goToMove`)
- Types/Interfaces: PascalCase (`RepertoireNode`, `GameAnalysis`)
- Constants: SCREAMING_SNAKE_CASE (`DEFAULT_OPENING_PLIES`)

**Formatting:** 2-space indent, semicolons required, ~100 char line limit.

**Types:** Prefer `interface` for objects, `type` for unions/primitives:

```typescript
interface RepertoireNode {
  id: string;
  fen: string;
  move: string | null;
  children: RepertoireNode[];
}

type Color = 'white' | 'black';
type ShortColor = 'w' | 'b';
```

**React Patterns:** Functional components with hooks:

```typescript
export function GameAnalysisPage() {
  const [flipped, setFlipped] = useState(false);
  const { currentFEN } = useFENComputed(game, currentMoveIndex);
  
  const handleAction = useCallback((move: MoveAnalysis) => {
    // handler logic
  }, [dependencies]);

  return <div>...</div>;
}
```

---

## Key Technologies

- **Backend:** Go 1.25, Echo v4, pgx v5, notnil/chess, testify, golang-jwt/jwt v5, testcontainers
- **Frontend:** React 18, TypeScript 5, Vite 5, Tailwind CSS 4, chess.js, Zustand, Axios, D3 (hierarchy/zoom/shape), Framer Motion, Lucide React
- **Testing:** Vitest + Testing Library (frontend), Go testing + testify + testcontainers (backend)
- **Database:** PostgreSQL 17 with JSONB for tree storage
- **Monitoring:** Prometheus + Grafana dashboards
- **Architecture:** Repository pattern (backend), Zustand stores (frontend), feature-based module structure

---

## Important Notes

- Use `chess.js` (frontend) and `notnil/chess` (backend) for move validation
- Store full FEN string for each node in the repertoire tree
- Color values: Backend uses `"white"/"black"`; frontend uses `'w'/'b'` for chess.js
- Multiple repertoires per color supported via POST `/api/repertoires` (max 50 total)
- CORS origins are configurable via `CORS_ALLOWED_ORIGINS` env var (default `http://localhost:5173`)
- All API endpoints return JSON; errors use `{"error": "message"}` format
- Transpositions can be auto-merged via POST `/api/repertoires/:id/merge-transpositions`
- Backend uses dependency injection with interfaces (`RepertoireRepository`, `AnalysisRepository`, etc. in `repository/interfaces.go`)
- Sentinel errors: `repository.ErrRepertoireNotFound`, `repository.ErrAnalysisNotFound`, `repository.ErrGameNotFound`, `repository.ErrCategoryNotFound`, `repository.ErrUserNotFound`, `repository.ErrUsernameExists`, `repository.ErrEmailExists`, `repository.ErrResetTokenNotFound`, `repository.ErrRefreshTokenNotFound`
- Game deduplication prevents duplicate imports via fingerprinting
- JWT access tokens are short-lived (15 min); refresh tokens via httpOnly cookies (30-day, single-use rotation)
- Application limits defined in `config/limits.go` (max repertoires: 50, max PGN: 10MB, max games per page: 100)
- Background worker: `EngineService.RunWorker` processes engine evaluations via Lichess Explorer API
- Metrics endpoint on port 9090 (separate from main API on 8080)
