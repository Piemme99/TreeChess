# TreeChess - Guide for Coding Agents

## Project Structure

```
treechess/
├── backend/          # Go 1.25 + Echo v4 + pgx v5
│   ├── main.go
│   ├── config/
│   ├── internal/{handlers,middleware,models,repository,services}/
│   └── go.mod
├── frontend/         # React 18 + TypeScript 5 + Vite 5
│   ├── src/{components,features,shared,stores,types,utils}/
│   └── package.json
└── docker-compose.yml
```

---

## Build, Lint, and Test Commands

### Frontend

```bash
cd frontend
npm install                    # Install dependencies
npm run dev                    # Dev server (port 5173, hot reload)
npm run build                  # Type check + production build
npm run lint                   # ESLint check
npm run lint -- --fix          # ESLint auto-fix
npx tsc --noEmit               # Type check only (no emit)
```

### Backend

```bash
cd backend
go mod download               # Install dependencies
air                           # Dev server with hot reload (uses .air.toml)
go build -o server .          # Build binary

# Run a SINGLE test
go test -v -run TestRepertoireService_CreateRepertoire ./internal/services/
go test -v -run TestFindNode ./internal/services/
go test -v -run "TestName|TestOther" ./internal/...   # Multiple patterns

# Run tests in a specific package
go test -v ./internal/handlers/
go test -v ./internal/repository/
go test ./...                                         # All tests

# Coverage
go test -coverprofile=coverage.out ./... && go tool cover -html=coverage.out -o coverage.html

# Linting
golangci-lint run ./...
```

### Docker

```bash
docker-compose up --build    # Build and start all services
docker-compose up -d         # Run in background
docker-compose logs -f       # Follow logs
docker-compose down          # Stop all services
```

---

## Code Style Guidelines

### Go (Backend)

**Imports:** Group in order: stdlib, third-party, local packages.

```go
import (
    "context"
    "fmt"
    "net/http"
    "time"

    "github.com/google/uuid"
    "github.com/labstack/echo/v4"
    "github.com/notnil/chess"

    "github.com/treechess/backend/internal/models"
    "github.com/treechess/backend/internal/repository"
)
```

**Naming:**
- Packages: lowercase (`repository`, `handlers`, `services`)
- Exported: PascalCase (`RepertoireService`, `AddNodeHandler`)
- Unexported: camelCase (`findNode`, `moveExistsAsChild`)
- Errors: `Err` prefix as package vars (`ErrNotFound`, `ErrInvalidMove`)
- Constants: PascalCase for exported, camelCase for unexported

**Error Handling:** Always wrap errors with context using `%w`:
```go
if err := doSomething(); err != nil {
    return nil, fmt.Errorf("failed to do something: %w", err)
}

// Sentinel errors pattern
var ErrNotFound = fmt.Errorf("not found")
if errors.Is(err, ErrNotFound) { ... }
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

**Testing:** Use testify for assertions with mock-based dependency injection:
```go
func TestExample(t *testing.T) {
    // Use mocks from internal/repository/mocks/
    mockRepo := &mocks.MockRepertoireRepo{
        GetByIDFunc: func(id string) (*models.Repertoire, error) {
            return &models.Repertoire{ID: id, Color: "white"}, nil
        },
    }
    svc := NewRepertoireService(mockRepo)
    result, err := svc.GetRepertoire("some-uuid")
    require.NoError(t, err)
    assert.Equal(t, expected, result)
}
```

### TypeScript/React (Frontend)

**Imports:** External packages first, then relative imports:
```typescript
import { useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

import { useGameLoader } from './hooks/useGameLoader';
import { Button, Loading } from '../../shared/components/UI';
import type { GameAnalysis, MoveAnalysis } from '../../types';
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
type ChessColor = 'w' | 'b';
```

**React Patterns:** Functional components with explicit typing:
```typescript
export function GameAnalysisPage() {
  const [flipped, setFlipped] = useState(false);
  const { currentFEN, lastMove } = useFENComputed(game, currentMoveIndex);
  
  const handleAction = useCallback((move: MoveAnalysis) => {
    // handler logic
  }, [dependencies]);

  return <div>...</div>;
}
```

---

## Key Technologies

- **Backend:** Go 1.25, Echo v4, pgx v5, notnil/chess, testify
- **Frontend:** React 18, TypeScript 5, Vite 5, chess.js, zustand, axios
- **Database:** PostgreSQL 15+ with JSONB for tree storage
- **Architecture:** Repository pattern (backend), Zustand stores (frontend)

---

## Important Notes

- Use `chess.js` (frontend) and `notnil/chess` (backend) for move validation
- Store full FEN string for each node in the repertoire tree
- Multiple repertoires per color supported via POST `/api/repertoires`
- CORS configured for `http://localhost:5173` only
- All API endpoints return JSON; errors use `{"error": "message"}` format
- Transpositions are NOT automatically merged in the tree
- Game analyses require a `repertoireId` parameter to specify which repertoire to check
- Backend uses dependency injection with interfaces (`RepertoireRepository`, `AnalysisRepository`, `VideoRepository`)
- Sentinel errors: `repository.ErrRepertoireNotFound`, `repository.ErrAnalysisNotFound`, `repository.ErrVideoImportNotFound`
- YouTube video import: pipeline `yt-dlp` -> `ffmpeg` -> GoCV recognition (`internal/recognition/`) -> Go tree builder
- Video import uses SSE (`text/event-stream`) for real-time progress
- `TreeBuilderService` transforms FEN sequences into repertoire trees with backtracking detection
- Config fields `YtdlpPath`, `FfmpegPath` for external tool paths (env vars)
- Frontend feature: `features/video-import/` for preview page, `features/analyse-tab/` for YouTube import UI
- Frontend route: `/video-import/:id/review` for video repertoire preview
