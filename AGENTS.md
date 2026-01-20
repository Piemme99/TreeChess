# TreeChess - Guide for Coding Agents

## Project Structure

```
treechess/
├── backend/          # Go 1.21 + Echo v4 + pgx
│   ├── main.go
│   ├── config/
│   ├── internal/
│   │   ├── handlers/
│   │   ├── middleware/
│   │   ├── models/
│   │   ├── repository/
│   │   └── services/
│   └── go.mod
├── frontend/         # React 18 + TypeScript 5 + Vite 5
│   ├── src/
│   │   ├── components/
│   │   ├── stores/
│   │   ├── types/
│   │   └── utils/
│   ├── package.json
│   └── vite.config.ts
└── docker-compose.yml
```

---

## Build, Lint, and Test Commands

### Frontend

```bash
cd frontend
npm install                    # Install dependencies
npm run dev                    # Dev server (hot reload)
npm run build                  # Build for production
npm run lint; npm run lint -- --fix   # Linting + auto-fix
tsc --noEmit                  # Type check only
```

### Backend

```bash
cd backend
go mod download               # Dependencies
air                           # Run with hot reload
go build -o server .          # Build binary

# Run a SINGLE test
go test -run TestName ./internal/handlers/           # By name
go test -run "TestName|TestOther" ./internal/        # Multiple patterns
go test -v ./internal/repository/                    # Verbose, specific package
go test ./...                                        # All tests

# Coverage
go test -coverprofile=coverage.out ./... && go tool cover -html=coverage.out -o coverage.html

# Linting
golangci-lint run ./...
golangci-lint run ./internal/handlers/
```

### Docker

```bash
docker-compose up --build    # Build and start all
docker-compose up -d         # Background
docker-compose logs -f       # Follow logs
docker-compose down          # Stop all
```

---

## Code Style Guidelines

### Go (Backend)

**Imports:** Group stdlib, third-party, internal.

```go
import (
    "context"
    "encoding/json"
    "net/http"
    "time"

    "github.com/labstack/echo/v4"
    "github.com/labstack/echo/v4/middleware"
    "github.com/jackc/pgx/v5/pgxpool"
    "github.com/google/uuid"

    "treechess/internal/models"
)
```

**Naming:**
- Packages: lowercase (`repository`, `handlers`)
- Exported: PascalCase (`RepertoireService`)
- Unexported: camelCase (`getByID`)
- Errors: prefix `Err` (`ErrNotFound`)
- Interfaces: suffixed `-er` (`Repository`)

**Error Handling:**
```go
if err := doSomething(); err != nil {
    return fmt.Errorf("failed to do something: %w", err)
}
```

**Types:**
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
    MoveNumber  int               `json:"moveNumber"`
    ColorToMove Color             `json:"colorToMove"`
    ParentID    *string           `json:"parentId,omitempty"`
    Children    []*RepertoireNode `json:"children"`
}
```

### TypeScript/React (Frontend)

**Imports:** External first, then relative.

```typescript
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import { api } from '../services/api';
import { useRepertoireStore } from '../stores/repertoireStore';
import { RepertoireNode } from '../types';
```

**Naming:**
- Components: PascalCase (`ChessBoard`, `RepertoireTree`)
- Hooks: `use` prefix (`useRepertoire`)
- Variables/functions: camelCase
- Constants: SCREAMING_SNAKE_CASE
- Interfaces/Types: PascalCase

**Formatting:** 2 spaces, always semicolons, 100 char limit.

**Types:**
```typescript
interface RepertoireNode {
  id: string;
  fen: string;
  move: string | null;
  moveNumber: number;
  colorToMove: 'w' | 'b';
  parentId: string | null;
  children: RepertoireNode[];
}

type Color = 'w' | 'b';
```

**Error Handling:**
```typescript
try {
  await api.getData();
} catch (error) {
  console.error('Failed to get data:', error);
  throw new Error('Data fetch failed');
}
```

**React Patterns:**
```typescript
function ChessBoard({ fen, onMove }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  return <div>{/* component */}</div>;
}
```

---

## Key Technologies

- **Backend:** Go 1.21, Echo v4, pgx v5, notnil/chess
- **Frontend:** React 18, TypeScript 5, Vite 5, chess.js, zustand
- **Database:** PostgreSQL 15+ with JSONB
- **State:** Repository pattern (backend), Zustand (frontend)

---

## Important Notes

- Use `chess.js` for move validation (never trust SAN input directly)
- Store full FEN string for each node in the repertoire tree
- Use JSONB in PostgreSQL for flexible tree storage
- Transpositions are NOT merged automatically
- CORS allows `http://localhost:5173` only
- All API endpoints return JSON responses
- Repertoires are auto-created at startup (no POST /api/repertoire)
- Analyses require a `color` parameter to know which repertoire to analyze against
