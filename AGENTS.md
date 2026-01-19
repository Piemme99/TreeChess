# TreeChess - Guide for Coding Agents

This document provides guidelines for agents working on the TreeChess project.

## Project Structure

```
treechess/
├── backend/          # Go + Echo
│   ├── main.go
│   ├── config/
│   ├── internal/
│   │   ├── handlers/
│   │   ├── middleware/
│   │   ├── models/
│   │   ├── repository/
│   │   └── services/
│   └── go.mod
├── frontend/         # React + TypeScript
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

### Frontend (React + TypeScript + Vite)

```bash
cd frontend

# Install dependencies
npm install

# Start development server with hot reload
npm run dev

# Build for production
npm run build

# Run linting
npm run lint

# Fix linting errors automatically
npm run lint -- --fix

# Type check only
tsc --noEmit
```

### Backend (Go + Echo)

```bash
cd backend

# Download dependencies
go mod download

# Run with hot reload (requires air)
air

# Build binary
go build -o server .

# Run tests
go test ./...

# Run tests with coverage
go test -coverprofile=coverage.out ./...
go tool cover -html=coverage.out -o coverage.html

# Run single test
go test -run TestName ./...

# Run tests in specific package
go test ./internal/handlers/

# Lint with golangci-lint (if installed)
golangci-lint run
golangci-lint run ./...
```

### Docker

```bash
# Build and start all services
docker-compose up --build

# Start in background
docker-compose up -d

# View logs
docker-compose logs -f

# Stop all services
docker-compose down
```

---

## Code Style Guidelines

### Go (Backend)

**Imports**
```go
import (
    "context"
    "encoding/json"
    "net/http"
    "time"

    "github.com/labstack/echo/v4"
    "github.com/labstack/echo/v4/middleware"
)
```

**Naming**
- Packages: lowercase, simple (e.g., `repository`, `handlers`)
- Exported types/functions: PascalCase (e.g., `RepertoireService`)
- Unexported: camelCase (e.g., `getByID`)
- Constants: PascalCase (e.g., `DefaultPort`)
- Error variables: prefix `Err` (e.g., `ErrNotFound`)
- Interfaces: suffixed with -er if possible (e.g., `Repository`)

**Formatting**
- Indent with tabs
- Line length: no strict limit, use 100 chars as guideline
- Always use semicolons in declarations
- Group related imports

**Error Handling**
```go
// BAD: Ignoring errors
_ = something()

// GOOD: Handle or explicitly ignore
if err := doSomething(); err != nil {
    return fmt.Errorf("failed to do something: %w", err)
}

// GOOD: Wrap errors with context
if err := row.Scan(&id); err != nil {
    return fmt.Errorf("failed to scan row: %w", err)
}
```

**Types**
```go
// Use struct for data
type User struct {
    ID    int64  `json:"id"`
    Email string `json:"email"`
}

// Use interface for behavior
type Repository interface {
    Get(id string) (*User, error)
}

// Use specific types, not interface{}
func handleRequest(w http.ResponseWriter, r *http.Request) {
    // NOT: var w http.ResponseWriter
}
```

### TypeScript/React (Frontend)

**Imports**
```typescript
// External imports first, then relative
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

import { api } from '../services/api';
import { useRepertoireStore } from '../stores/repertoireStore';
import './Component.css';
```

**Naming**
- Components: PascalCase (e.g., `ChessBoard`, `RepertoireTree`)
- Hooks: camelCase with `use` prefix (e.g., `useRepertoire`)
- Variables/functions: camelCase (e.g., `moveNumber`, `handleSubmit`)
- Constants: SCREAMING_SNAKE_CASE (e.g., `DEFAULT_PORT`)
- Interfaces: PascalCase (e.g., `RepertoireNode`)
- Types: PascalCase (e.g., `Color`)

**Formatting**
- Use 2 spaces for indentation
- Semicolons: always
- Line length: 100 characters max
- Braces on same line

**Type Definitions**
```typescript
// Interfaces for objects
interface RepertoireNode {
  id: string;
  fen: string;
  move: string | null;
  children: RepertoireNode[];
}

// Types for unions/primitives
type Color = 'w' | 'b';

// Props interface
interface Props {
  fen: string;
  onMove?: (move: string) => void;
}

// Use interfaces for objects, types for unions
```

**Error Handling**
```typescript
// BAD: Silent catch
try {
  await api.getData();
} catch (e) {
  // nothing
}

// GOOD: Handle or log
try {
  await api.getData();
} catch (error) {
  console.error('Failed to get data:', error);
  throw new Error('Data fetch failed');
}

// Use error boundaries for React components
```

**React Patterns**
```typescript
// Use functional components
function ChessBoard({ fen, onMove }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  
  return <div>{/* component */}</div>;
}

// Use Zustand for state management
const store = useRepertoireStore();
const { repertoire, addNode } = store;
```

---

## Key Technologies

- **Backend**: Go 1.21, Echo v4, pgx
- **Frontend**: React 18, TypeScript 5, Vite 5
- **State**: Zustand (frontend), Repository pattern (backend)
- **Database**: PostgreSQL with JSONB
- **Chess Logic**: chess.js

---

## Important Notes

- Always use `chess.js` for move validation (never trust SAN input directly)
- Store full FEN string for each node in the repertoire tree
- Use JSONB in PostgreSQL for flexible tree storage
- CORS is configured to allow `http://localhost:5173` only
- All API endpoints return JSON responses
