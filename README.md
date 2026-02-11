# TreeChess

Interactive chess opening repertoire builder with tree visualization and game analysis.

Build, visualize, and manage your chess opening repertoire. Import games from Lichess or PGN files, analyze them against your repertoire, and identify gaps in your preparation.

## Features

- Visual repertoire tree editor for white and black openings
- Import games directly from Lichess by username
- Upload and analyze PGN files
- Compare your games against your repertoire to find deviations
- Track which lines you know and which need work

## Quick Start

### Prerequisites

- Docker and Docker Compose
- OR: Go 1.25+, Node.js 18+, PostgreSQL 15+

### Running with Docker (Recommended)

```bash
docker-compose up --build
```

- Frontend: http://localhost:5173
- Backend: http://localhost:8080

### Running Locally

**Backend:**
```bash
cd backend
go mod download
air              # Hot reload dev server
# OR: go run main.go
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/health | Health check |
| POST | /api/auth/register | Register a new account |
| POST | /api/auth/login | Login (returns JWT + refresh cookie) |
| POST | /api/auth/refresh | Refresh access token (httpOnly cookie) |
| POST | /api/auth/logout | Logout (revokes refresh token) |
| POST | /api/auth/forgot-password | Request password reset |
| POST | /api/auth/reset-password | Reset password with token |
| GET | /api/auth/lichess/login | Lichess OAuth login redirect |
| GET | /api/auth/lichess/callback | Lichess OAuth callback |
| GET | /api/repertoire/:color | Get repertoire tree (white/black) |
| POST | /api/repertoire/:color/node | Add move to repertoire |
| DELETE | /api/repertoire/:color/node/:id | Delete node from repertoire |
| POST | /api/imports | Upload PGN for analysis |
| POST | /api/imports/lichess | Import games from Lichess |
| GET | /api/analyses | List all analyses |
| GET | /api/analyses/:id | Get analysis details |
| GET | /api/games | List all imported games |

## Project Structure

```
treechess/
├── backend/              # Go API server
│   ├── main.go
│   ├── config/
│   └── internal/
│       ├── handlers/     # HTTP handlers
│       ├── middleware/    # Auth & security middleware
│       ├── models/       # Data structures
│       ├── repository/   # Database access (interfaces + pgx)
│       └── services/     # Business logic
├── frontend/             # React application
│   ├── nginx.conf        # Nginx config (dev/default)
│   ├── nginx.prod.conf   # Nginx config (production, TLS)
│   └── src/
│       ├── features/     # Feature modules
│       ├── services/     # API client & auth
│       ├── shared/       # Shared components
│       ├── stores/       # Zustand state
│       └── types/        # TypeScript types
├── docker-compose.yml      # Development
└── docker-compose.prod.yml # Production (TLS, monitoring, isolated networks)
```

## Tech Stack

- **Frontend:** React 18, TypeScript 5, Vite 5, chess.js, Zustand
- **Backend:** Go 1.25, Echo v4, pgx v5, notnil/chess
- **Database:** PostgreSQL 15+ with JSONB storage

## Security

### Authentication

- **Short-lived JWTs** (15 min) stored in memory (not localStorage) to limit XSS exposure
- **Refresh token rotation** via httpOnly cookies (30-day lifetime, single-use) with automatic 401 retry and request queuing on the frontend
- OAuth cookie encryption key derived via HKDF
- Auth and OAuth routes share a strict rate limit (10 req/min)
- All refresh tokens are revoked on password change or reset
- Error responses are sanitized — internal error details are never sent to clients
- Security headers: `Permissions-Policy`, `X-Content-Type-Options`, `X-Frame-Options`, `X-XSS-Protection`

### Infrastructure

- **Nginx runs as non-root** in production (`nginxinc/nginx-unprivileged`), limiting the blast radius of container escapes
- **Database connection uses `sslmode=prefer`** in production for defense-in-depth encryption between backend and PostgreSQL
- **PostgreSQL port bound to `127.0.0.1`** in development, preventing exposure to the local network
- Docker networks isolate services: `backend-net` (backend + DB), `frontend-net` (frontend + backend), `monitor-net` (metrics)

## License

TreeChess is licensed under the [GNU Affero General Public License v3.0](LICENSE).

This means you are free to use, modify, and distribute this software, provided that any modified version you deploy as a network service also makes its source code available under the same license. See [LICENSE](LICENSE) for the full text.
