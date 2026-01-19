# Epic 1: Infrastructure

**Objective:** Set up project structure, Docker environment, and database migrations

**Status:** Not Started  
**Dependencies:** None

---

## 1. Objective

Create a fully functional local development environment with:
- Docker Compose (PostgreSQL + Backend + Frontend)
- Go project scaffold with modules
- npm project scaffold with TypeScript
- Database schema with migrations
- Hot reload for both frontend and backend

---

## 2. Definition of Done

- [ ] Docker Compose starts all 3 services successfully
- [ ] PostgreSQL is accessible and initialized with schema
- [ ] Frontend runs at http://localhost:5173
- [ ] Backend runs at http://localhost:8080
- [ ] Backend hot reload works (compile-daemon)
- [ ] Frontend hot reload works (Vite HMR)
- [ ] API health check returns 200

---

## 3. Tasks

### 3.1 Directory Structure

Create the following structure:

```
treechess/
├── cmd/server/
│   └── main.go
├── src/
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── migrations/
│   └── 001_init.sql
├── docker-compose.yml
├── Dockerfile.backend
├── Dockerfile.frontend
├── .dockerignore
├── go.mod
├── package.json
├── tsconfig.json
├── vite.config.ts
└── .env.example
```

### 3.2 Backend Setup

**File: `go.mod`**

```go
module github.com/treechess/backend

go 1.21

require (
    github.com/jackc/pgx/v5 v5.5.1
    github.com/labstack/echo/v4 v4.11.4
)
```

**File: `cmd/server/main.go`**

```go
package main

import (
    "fmt"
    "log"
    "net/http"
    "os"

    "github.com/labstack/echo/v4"
)

func main() {
    e := echo.New()
    
    e.GET("/api/health", func(c echo.Context) error {
        return c.JSON(http.StatusOK, map[string]string{
            "status": "ok",
        })
    })
    
    port := os.Getenv("PORT")
    if port == "" {
        port = "8080"
    }
    
    log.Printf("Starting server on :%s", port)
    if err := e.Start(":" + port); err != nil {
        log.Fatal(err)
    }
}
```

### 3.3 Frontend Setup

**File: `package.json`**

```json
{
  "name": "treechess-frontend",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "lint": "eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "chess.js": "^1.0.0-beta.0",
    "zustand": "^4.5.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.43",
    "@types/react-dom": "^18.2.17",
    "@typescript-eslint/eslint-plugin": "^6.14.0",
    "@typescript-eslint/parser": "^6.14.0",
    "@vitejs/plugin-react": "^4.2.1",
    "eslint": "^8.55.0",
    "eslint-plugin-react-hooks": "^4.6.0",
    "eslint-plugin-react-refresh": "^0.4.5",
    "typescript": "^5.2.2",
    "vite": "^5.0.8"
  }
}
```

**File: `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

**File: `vite.config.ts`**

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
  },
})
```

### 3.4 Database Schema

**File: `migrations/001_init.sql`**

```sql
-- Create repertoires table
CREATE TABLE IF NOT EXISTS repertoires (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    color VARCHAR(5) NOT NULL CHECK (color IN ('white', 'black')),
    tree_data JSONB NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{"totalNodes": 0, "totalMoves": 0, "deepestDepth": 0}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT one_repertoire_per_color UNIQUE (color)
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_repertoires_color ON repertoires(color);
CREATE INDEX IF NOT EXISTS idx_repertoires_updated ON repertoires(updated_at DESC);
```

### 3.5 Docker Configuration

**File: `docker-compose.yml`**

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: treechess
      POSTGRES_PASSWORD: treechess
      POSTGRES_DB: treechess
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U treechess -d treechess"]
      interval: 5s
      timeout: 5s
      retries: 5

  backend:
    build:
      context: .
      dockerfile: Dockerfile.backend
    volumes:
      - ./cmd/server:/app
    ports:
      - "8080:8080"
    environment:
      DATABASE_URL: postgres://treechess:treechess@postgres:5432/treechess?sslmode=disable
      PORT: "8080"
    depends_on:
      postgres:
        condition: service_healthy

  frontend:
    build:
      context: .
      dockerfile: Dockerfile.frontend
    volumes:
      - ./src:/app/src
    ports:
      - "5173:5173"
    environment:
      VITE_API_URL: http://localhost:8080
    depends_on:
      - backend

volumes:
  postgres_data:
```

**File: `Dockerfile.backend`**

```dockerfile
FROM golang:1.21-alpine

WORKDIR /app

RUN apk add --no-cache git
RUN go install github.com/githubnemo/compile-daemon@latest

COPY go.mod go.sum ./
RUN go mod download

EXPOSE 8080

CMD ["compile-daemon", "--build=go build -o /app/server ./cmd/server", "--run=/app/server", "--watch=/app", "--exclude-dir=.git"]
```

**File: `Dockerfile.frontend`**

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host"]
```

**File: `.dockerignore`**

```
node_modules
.git
*.log
```

### 3.6 Environment Example

**File: `.env.example`**

```env
DATABASE_URL=postgres://treechess:treechess@localhost:5432/treechess?sslmode=disable
PORT=8080
```

---

## 4. Commands

### 4.1 Start with Docker

```bash
# Build and start all services
docker-compose up --build

# Start in background
docker-compose up -d

# Stop all services
docker-compose down

# Stop and delete database volume
docker-compose down -v
```

### 4.2 Start Locally (without Docker)

**Backend:**
```bash
cd cmd/server
go mod download
air  # Requires air installed
```

**Frontend:**
```bash
cd src
npm install
npm run dev
```

---

## 5. Verification Steps

1. Run `docker-compose up --build`
2. Wait for all services to be healthy
3. Visit http://localhost:5173 - should see React app
4. Visit http://localhost:8080/api/health - should return `{"status":"ok"}`
5. Test backend hot reload: edit `cmd/server/main.go`, changes should recompile automatically
6. Test frontend hot reload: edit `src/App.tsx`, changes should appear immediately

---

## 6. Dependencies to Other Epics

This epic creates the foundation for all other epics:
- Backend API (Epic 2) depends on this
- Frontend Core (Epic 4) depends on this
- All subsequent epics depend on either backend or frontend

---

## 7. Notes

### 7.1 Air Installation (for local development)

```bash
curl -sSf https://raw.githubusercontent.com/cosmtrek/air/master/install.sh | sh -s -- -b $(go env GOPATH)/bin
```

### 7.2 Node Modules

The frontend `node_modules` should NOT be committed to git. Add to `.gitignore`:

```
node_modules
dist
.env
```

### 7.3 PostgreSQL Health Check

The health check ensures the backend only starts after PostgreSQL is ready to accept connections.
