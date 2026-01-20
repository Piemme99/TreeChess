# Epic 1: Infrastructure

**Objective:** Set up project structure, Docker environment, and database migrations for local development.

---

## Definition of Done

- [ ] Docker Compose starts all 3 services successfully
- [ ] PostgreSQL is accessible and initialized with schema
- [ ] Frontend runs at http://localhost:5173
- [ ] Backend runs at http://localhost:8080
- [ ] Backend hot reload works (air)
- [ ] Frontend hot reload works (Vite HMR)
- [ ] API health check returns 200

---

## Tickets

### INFRA-001: Create Docker Compose configuration
**Description:** Create docker-compose.yml with postgres, backend, and frontend services.
**Acceptance:**
- [ ] PostgreSQL 15 service with healthcheck
- [ ] Backend Go service with hot reload
- [ ] Frontend React service with hot reload
- [ ] Services communicate via internal network
- [ ] Ports 5432, 8080, 5173 exposed
**Dependencies:** None

### INFRA-002: Setup backend Go project
**Description:** Initialize Go module with Echo and pgx dependencies.
**Acceptance:**
- [ ] go.mod created with go 1.21
- [ ] Echo v4 imported
- [ ] pgx v5 imported
- [ ] UUID library imported
**Dependencies:** None

### INFRA-003: Setup frontend React project
**Description:** Initialize Vite project with TypeScript, React, and dependencies.
**Acceptance:**
- [ ] package.json with React 18, TypeScript 5, Vite 5
- [ ] chess.js imported
- [ ] zustand imported
- [ ] react-router-dom imported
- [ ] vite.config.ts configured
**Dependencies:** None

### INFRA-004: Create database schema migration
**Description:** Create SQL migration for repertoires table.
**Acceptance:**
- [ ] repertoires table with UUID primary key
- [ ] color column (white/black) with unique constraint
- [ ] tree_data JSONB column
- [ ] metadata JSONB column with defaults
- [ ] created_at and updated_at timestamps
- [ ] Indexes on color and updated_at
**Dependencies:** None

### INFRA-005: Create backend Dockerfile
**Description:** Create Docker image for backend with hot reload support.
**Acceptance:**
- [ ] Based on golang:1.21-alpine
- [ ] Air installed for hot reload
- [ ] Exposes port 8080
- [ ] Mounts backend directory
- [ ] Runs with proper environment variables
**Dependencies:** INFRA-002, INFRA-004

### INFRA-006: Create frontend Dockerfile
**Description:** Create Docker image for frontend dev server.
**Acceptance:**
- [ ] Based on node:18-alpine
- [ ] npm install runs during build
- [ ] Exposes port 5173
- [ ] Runs npm run dev with host flag
- [ ] Mounts src directory for hot reload
**Dependencies:** INFRA-003

---

## Directory Structure

```
treechess/
├── backend/
│   ├── Dockerfile
│   ├── main.go
│   ├── go.mod
│   └── .air.toml
├── frontend/
│   ├── Dockerfile
│   ├── package.json
│   ├── vite.config.ts
│   └── src/
├── migrations/
│   └── 001_init.sql
├── docker-compose.yml
└── .dockerignore
```

---

## Dependencies to Other Epics

All subsequent epics depend on this epic being complete.
