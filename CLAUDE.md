# CLAUDE.md

Kumquat — chess repertoire builder & trainer. Live: https://kumquatchess.com

## Commands

Everything day-to-day goes through the root `Makefile`:

```bash
make dev                # build + start dev containers (detached)
make stop | delete | logs | restart
make test               # frontend (Vitest) + backend (go test) unit tests
make test-integration   # Go integration tests — needs Docker, testcontainers, -timeout 300s
make lint               # ESLint + tsc --noEmit + go vet + golangci-lint
make install-hooks      # installs scripts/pre-push (runs the lint suite before every push)
```

`make prod*` targets handle production (compose, SSL, backups) — `grep '^[a-z-]*:' Makefile` for the list.
Prod reads `.env.production`, not `.env`.

Dev services: frontend 5173, backend 8080, Postgres 5432, Mailhog SMTP 1025 / UI 8025, Prometheus 9091, Grafana 3000.

Narrower loops:

```bash
cd backend  && air                                            # hot reload (.air.toml)
cd backend  && go test -v -run TestName ./internal/services/  # one test
cd frontend && npx vitest run -t "test name"
```

## Stack

**Frontend** React 19 · TypeScript 6 · Vite 8 · Tailwind 4 · Zustand · chess.js · D3 · Framer Motion · Vitest 4
**Backend** Go 1.25 · Echo **v5** · pgx v5 · notnil/chess · golang-jwt v5 · testify · testcontainers
**Data** PostgreSQL 17, repertoire trees stored as JSONB
**Engine** Stockfish 18 NNUE lite WASM, vendored in `frontend/public/stockfish-18-lite.{js,wasm}`

## Layout

- `backend/` — `main.go` wires dependencies and routes; `config/` (env + `limits.go`); `internal/{handlers,middleware,models,repository,services,testhelpers}`; `tests/integration/`. Module `github.com/kumquat/backend`.
- `frontend/src/` — `features/` (one folder per screen), `shared/`, `stores/`, `services/` (`api.ts`, `stockfish.ts`), `types/`.
- `migrations/`, `monitoring/`, `scripts/`, `testdata/`.

## Conventions worth knowing

These are the project-specific ones; the rest is idiomatic Go / React.

- **Handlers are closures**: `func XxxHandler(svc services.XxxInterface) echo.HandlerFunc`.
- **Mocks are hand-written** with `XxxFunc` fields (`internal/repository/mocks/`, `internal/services/mocks/`), not generated.
- **Sentinel errors** live in `internal/repository/errors.go` and at the top of service files; wrap with `%w`, test with `errors.Is`.
- **No Prettier** on the frontend — formatting is by convention (2 spaces, semicolons, ~100 cols).
- **Named exports**, never default. Lazy routes via `React.lazy(() => import(…).then(m => ({ default: m.Name })))`.
- Test names: `TestServiceName_MethodName_Scenario`.

## Traps

- **Color values differ across the wire**: backend JSON uses `"white"/"black"`, the frontend uses `'w'/'b'` for chess.js.
- **Never trust raw SAN** — validate through `notnil/chess` (Go) or `chess.js` (frontend).
- Positions are stored as **full FEN**; comparing two positions for transposition means ignoring the clock fields.
- Transpositions are merged on demand via `POST /api/repertoires/:id/merge-transpositions`.
- Duplicate imports are blocked by `PostgresFingerprintRepo`, not by a unique constraint on the game.
- Every tree mutation enqueues a debounced re-analysis (`ReanalysisQueue`) — results change *after* the write returns.
- API errors are always `{"error": "message"}`.
- Limits are centralised in `config/limits.go` (50 repertoires, 10MB PGN, 5000 games/import, 100 games/page…).

## Auth & middleware

- Access JWT 15 min, held in memory only. Refresh token in an httpOnly cookie, 30 days, single-use rotation. All refresh tokens are revoked on password change/reset.
- Lichess OAuth uses PKCE; cookie encryption via HKDF.
- Three rate-limit tiers, per IP, in-memory: global 100/min (burst 20), auth endpoints 20/min (burst 10), heavy operations 5/min (burst 3). Identity comes from `RealIP()` — see the deployment note in `.env.example` before putting a proxy in front.
- Body limit 10MB. CORS origins from `CORS_ALLOWED_ORIGINS` (a `*` panics at boot: credentials are enabled).
- Prometheus metrics on a separate port (9090 in-container), middleware prefix `kumquat`.

## UI conventions

**Control placement (toolbar vs tree-view):** controls that *mutate the repertoire* (CRUD, metadata, extract) live on the repertoire toolbar. Controls that *mutate the tree view* (navigation, zoom, display mode) live inside the tree-view component. Keep navigation visually separate from repertoire actions.

## Docs

- `CONTEXT.md` — domain glossary. Use its vocabulary when naming things; add to it when a term gets sharpened. `docs/adr/` holds architecture decisions; flag it explicitly when a change contradicts one.
- `SPECIFICATIONS.md` — full functional/technical spec (long; grep it, don't read it whole).
- `README.md` — setup and deployment.

## Issue tracker

GitHub Issues on `Piemme99/TreeChess`, via `gh`. Triage labels: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`.

## Workflow

- **Run `make test` before committing.** Don't commit on red.
- Work on a branch, never commit directly on `main`; integration happens through squashed PRs.
- On `agent/*` branches (AFK sessions): commit before emitting the completion signal.
