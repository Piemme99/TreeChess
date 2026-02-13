# Kumquat

**[kumquatchess.com](https://kumquatchess.com)**

Interactive chess opening repertoire builder with tree visualization and game analysis.

Build, visualize, and manage your chess opening repertoire. Import games from Lichess, Chess.com, or PGN files, analyze them against your repertoire, and identify gaps in your preparation.

## A Note on Origins

This project started as a vibe coding experiment that I decided to see through and make publicly available. If you run into any bugs or issues, please don't hesitate to report them -- feedback is always welcome!

## Features

- Visual repertoire tree editor with D3-based interactive tree rendering (pan/zoom, tidy/radial layouts)
- Multiple repertoires per color (max 50), with categories for organization
- Import games from Lichess, Chess.com, or PGN files with fingerprint-based deduplication
- Import Lichess studies as repertoires (selective chapter import, comments, arrows/highlights)
- Analyze games against your repertoire to find deviations and score adherence
- Dashboard with aggregate stats (win rate, coverage, error rate), per-repertoire breakdowns, opponent gaps, and branch performance
- Training modes: repertoire drill (play through your lines) and explorer training (compare against Lichess opening explorer)
- Opening insights powered by Lichess Explorer API (detect recurring mistakes)
- Browser-side Stockfish WASM engine for real-time position evaluation
- Explore and import public repertoires from other users
- Auto-sync games from Lichess and Chess.com on login
- Starter repertoire templates for onboarding new users
- Repertoire operations: merge, extract subtree, auto-merge transpositions, branch naming/coloring, main line marking

## Quick Start

### Prerequisites

- Docker and Docker Compose
- OR: Go 1.25+, Node.js 18+, PostgreSQL 17+

### Running with Docker (Recommended)

```bash
make dev
```

Or without Make:

```bash
docker-compose up --build
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:8080
- Mailhog Web UI: http://localhost:8025
- Grafana: http://localhost:3000

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

### Make Commands

**Development:**

| Command | Action |
|---------|--------|
| `make dev` | Build and start all containers (detached) |
| `make build` | Build images without starting |
| `make stop` | Stop all containers |
| `make delete` | Stop all and delete database volume |
| `make logs` | Follow container logs |
| `make restart` | Full stop + rebuild + start |

**Production:**

| Command | Action |
|---------|--------|
| `make prod` | Build and start production containers |
| `make prod-stop` | Stop production containers |
| `make prod-logs` | Follow production logs |
| `make prod-restart` | Full prod stop + rebuild + start |
| `make prod-init-ssl` | Initialize Let's Encrypt SSL (requires DOMAIN and EMAIL) |
| `make prod-renew-ssl` | Dry-run SSL certificate renewal |
| `make prod-backup` | Run database backup script |
| `make prod-install-backup-cron` | Install automatic backup cron job |

## API Endpoints

### Auth (rate-limited: 10 req/min)

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/auth/register | Register a new account |
| POST | /api/auth/login | Login (returns JWT + refresh cookie) |
| POST | /api/auth/refresh | Refresh access token (httpOnly cookie) |
| POST | /api/auth/logout | Logout (revokes refresh token) |
| POST | /api/auth/forgot-password | Request password reset |
| POST | /api/auth/reset-password | Reset password with token |
| GET | /api/auth/lichess/login | Lichess OAuth login redirect |
| GET | /api/auth/lichess/callback | Lichess OAuth callback |

### Auth (protected)

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/auth/me | Get current user |
| PUT | /api/auth/profile | Update profile (usernames, preferences) |
| POST | /api/auth/change-password | Change password |
| GET | /api/auth/has-password | Check if user has a password set |
| DELETE | /api/auth/account | Delete account |

### Repertoires

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/repertoires | List all repertoires |
| POST | /api/repertoires | Create new repertoire |
| GET | /api/repertoires/:id | Get repertoire with full tree |
| PATCH | /api/repertoires/:id | Rename repertoire |
| DELETE | /api/repertoires/:id | Delete repertoire |
| GET | /api/repertoires/templates | List starter templates |
| POST | /api/repertoires/seed | Seed from templates |
| POST | /api/repertoires/:id/nodes | Add node to tree |
| DELETE | /api/repertoires/:id/nodes/:nodeId | Delete node from tree |
| PATCH | /api/repertoires/:id/nodes/:nodeId/comment | Update node comment |
| PATCH | /api/repertoires/:id/nodes/:nodeId/branch-name | Set branch name |
| PATCH | /api/repertoires/:id/nodes/:nodeId/branch-color | Set branch color |
| POST | /api/repertoires/:id/nodes/:nodeId/toggle-collapsed | Toggle node collapsed |
| POST | /api/repertoires/:id/nodes/:nodeId/expand-to | Expand all ancestors |
| POST | /api/repertoires/:id/nodes/:nodeId/set-main-line | Mark as main line |
| POST | /api/repertoires/:id/clear-main-line | Clear main line marking |
| POST | /api/repertoires/merge | Merge multiple repertoires |
| POST | /api/repertoires/:id/extract | Extract subtree into new repertoire |
| POST | /api/repertoires/:id/merge-transpositions | Auto-merge transpositions |
| PATCH | /api/repertoires/:id/category | Assign to category |
| PATCH | /api/repertoires/:id/visibility | Set public/private visibility |

### Categories

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/categories | List categories |
| POST | /api/categories | Create category |
| GET | /api/categories/:id | Get category with repertoires |
| PATCH | /api/categories/:id | Rename category |
| DELETE | /api/categories/:id | Delete category |

### Explore (public repertoires)

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/explore/repertoires | List public repertoires |
| GET | /api/explore/repertoires/:id | Get public repertoire |
| POST | /api/explore/repertoires/:id/import | Import a public repertoire |

### Import & Analysis

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/imports | Upload PGN file |
| POST | /api/imports/lichess | Import from Lichess API |
| POST | /api/imports/chesscom | Import from Chess.com API |
| POST | /api/imports/validate-pgn | Validate PGN data |
| POST | /api/imports/validate-move | Validate a single move |
| GET | /api/imports/legal-moves | Get legal moves for a position |
| GET | /api/analyses | List all analyses |
| GET | /api/analyses/:id | Get analysis details |
| DELETE | /api/analyses/:id | Delete analysis |

### Studies (Lichess)

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/studies/preview | Preview a Lichess study |
| POST | /api/studies/import | Import study chapters as repertoires |
| GET | /api/studies/browse | Browse/search Lichess studies |
| GET | /api/studies/topics | Get popular study topics |

### Games

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/games | Get paginated games list (filters: timeClass, repertoire, source) |
| GET | /api/games/insights | Get opening insights (recurring mistakes) |
| POST | /api/games/insights/dismiss | Dismiss a recurring mistake |
| GET | /api/games/repertoires | Get distinct repertoires used in games |
| POST | /api/games/reanalyze-all | Reanalyze all games against current repertoires |
| DELETE | /api/games/:analysisId/:gameIndex | Delete a specific game |
| POST | /api/games/bulk-delete | Bulk delete games |
| POST | /api/games/:analysisId/:gameIndex/reanalyze | Reanalyze single game |
| POST | /api/games/:analysisId/:gameIndex/view | Mark game as viewed |

### Dashboard

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/dashboard/stats | Get dashboard stats |
| POST | /api/dashboard/gaps/dismiss | Dismiss an opponent gap |

### Training & Sync

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/training/analyze | Analyze move sequence against repertoires |
| POST | /api/sync | Sync games from Lichess + Chess.com |

### Other

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/health | Health check |
| GET | /metrics | Prometheus metrics (port 9090) |

## Project Structure

```
kumquat/
├── backend/                  # Go API server
│   ├── main.go
│   ├── config/               # Environment config + application limits
│   ├── internal/
│   │   ├── handlers/         # HTTP handlers (auth, repertoire, import, dashboard, etc.)
│   │   ├── middleware/        # JWT auth middleware
│   │   ├── models/           # Data structures
│   │   ├── repository/       # Database access (interfaces + pgx + mocks)
│   │   ├── services/         # Business logic
│   │   └── testhelpers/      # Test utilities (testcontainers, seeds)
│   └── tests/integration/    # Integration tests
├── frontend/                 # React application
│   ├── nginx.conf            # Nginx config (dev)
│   ├── nginx.prod.conf       # Nginx config (production, TLS)
│   └── src/
│       ├── features/         # Feature modules (auth, dashboard, repertoire, training, etc.)
│       ├── services/         # API client & Stockfish WASM bridge
│       ├── shared/           # Shared components, hooks, utils
│       ├── stores/           # Zustand state stores
│       └── types/            # TypeScript types
├── migrations/               # SQL schema migrations
├── monitoring/               # Prometheus + Grafana configs
├── scripts/                  # Backup, restore, SSL init scripts
├── testdata/                 # Sample PGNs and repertoire seeds
├── docker-compose.yml        # Development
└── docker-compose.prod.yml   # Production (TLS, monitoring, isolated networks)
```

## Tech Stack

- **Frontend:** React 18, TypeScript 5, Vite 5, Tailwind CSS 4, chess.js, Zustand, Axios, D3, Framer Motion
- **Backend:** Go 1.25, Echo v4, pgx v5, notnil/chess, golang-jwt/jwt v5
- **Database:** PostgreSQL 17 with JSONB tree storage
- **Monitoring:** Prometheus + Grafana dashboards
- **Dev tools:** Mailhog (email testing), Air (Go hot reload), Vitest (frontend testing), testcontainers (integration tests)

## Security

### Authentication

- **Short-lived JWTs** (15 min) stored in memory (not localStorage) to limit XSS exposure
- **Refresh token rotation** via httpOnly cookies (30-day lifetime, single-use) with automatic 401 retry and request queuing on the frontend
- **Lichess OAuth** via PKCE flow; cookie encryption key derived via HKDF
- Auth and OAuth routes share a strict rate limit (10 req/min)
- All refresh tokens are revoked on password change or reset
- Error responses are sanitized -- internal error details are never sent to clients
- Security headers: `Permissions-Policy`, `X-Content-Type-Options`, `X-Frame-Options`, `X-XSS-Protection`, `Referrer-Policy`, `HSTS`, `CSP`

### Infrastructure

- **Nginx runs as non-root** in production (`nginxinc/nginx-unprivileged`), limiting the blast radius of container escapes
- **Database connection uses `sslmode=prefer`** in production for defense-in-depth encryption between backend and PostgreSQL
- **PostgreSQL port bound to `127.0.0.1`** in development, preventing exposure to the local network
- Docker networks isolate services: `backend-net` (backend + DB), `frontend-net` (frontend + backend), `monitor-net` (metrics)
- Resource limits on all production containers
- Automated database backups with cron support

## License

Kumquat is licensed under the [GNU Affero General Public License v3.0](LICENSE).

This means you are free to use, modify, and distribute this software, provided that any modified version you deploy as a network service also makes its source code available under the same license. See [LICENSE](LICENSE) for the full text.
