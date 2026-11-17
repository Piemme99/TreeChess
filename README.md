# Kumquat

**[kumquatchess.com](https://kumquatchess.com)**

Build your chess opening repertoire from your own games, check your games against it, and review it.

Sign in with Lichess: your blitz, rapid and classical games are imported, your repertoire is drawn from the
moves you play, and the app shows where you lose points. After each session of games it asks only what needs a
decision; a spaced-repetition review keeps the lines in memory. The screens and their rules are described in
`frontend/src/features/openings/README.md`; the vocabulary in `CONTEXT.md`.

## A Note on Origins

This project started as a vibe coding experiment that I decided to see through and make publicly available. If you run into any bugs or issues, please don't hesitate to report them, feedback is always welcome!

## Features

- Lichess sign-in (OAuth PKCE); games imported server-side, new ones fetched at each visit
- Repertoire created from your habits, shown as a tree; weak openings ranked by points lost
- Check: each game that left the repertoire, judged by the engine, settled one decision at a time
- Review: lines played against the app, spaced repetition seeded from your habits
- Lichess opening explorer (relayed with your account) and browser-side Stockfish WASM
- A demo on a sample player's games, replayed day by day, without an account

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

**Testing & Linting:**

| Command | Action |
|---------|--------|
| `make test` | Run all tests (frontend + backend) |
| `make test-frontend` | Vitest only |
| `make test-backend` | Go unit tests only |
| `make test-integration` | Go integration tests (requires Docker) |
| `make lint` | Run all linters (frontend + backend) |
| `make lint-frontend` | ESLint + TypeScript check |
| `make lint-backend` | go vet + golangci-lint |

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

**Production (GHCR images, used by CD pipeline):**

| Command | Action |
|---------|--------|
| `make prod-deploy` | Start production with pre-built GHCR images |
| `make prod-deploy-stop` | Stop GHCR production containers |
| `make prod-deploy-logs` | Follow GHCR production logs |

## Project Structure

```
kumquat/
├── .github/                  # CI/CD workflows (ci.yml, deploy.yml) + Dependabot
├── backend/                  # Go API server
│   ├── main.go
│   ├── config/               # Environment config + application limits
│   ├── internal/
│   │   ├── handlers/         # HTTP handlers (auth, OAuth, explorer relay, v2 games and state, health)
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
│       ├── features/openings # The app: Home, repertoire tree, Check, Review (see its README)
│       ├── services/         # API client & Stockfish WASM bridge
│       ├── shared/           # Shared components, hooks, utils
│       ├── stores/           # Zustand state stores
│       ├── test/             # Test utilities and setup
│       └── types/            # TypeScript types
├── monitoring/               # Prometheus + Grafana configs
├── postgres/                 # Custom PostgreSQL configuration
├── scripts/                  # Backup, restore, SSL init scripts
├── docker-compose.yml        # Development
├── docker-compose.prod.yml   # Production (TLS, monitoring, isolated networks)
└── docker-compose.prod.ghcr.yml  # Production with pre-built GHCR images (CD pipeline)
```

## Tech Stack

- **Frontend:** React 19, TypeScript 5, Vite 5, Tailwind CSS 4, chess.js, Zustand, Axios, D3, Framer Motion
- **Backend:** Go 1.25, Echo v4, pgx v5, notnil/chess, golang-jwt/jwt v5, testify
- **Database:** PostgreSQL 17
- **Monitoring:** Prometheus + Grafana dashboards
- **Testing:** Vitest + Testing Library (frontend), Go testing + testify + testcontainers (backend)
- **Dev tools:** Mailhog (email testing), Air (Go hot reload)

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
