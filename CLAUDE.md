# CLAUDE.md

Kumquat — chess repertoire builder & trainer. Live: https://kumquatchess.com

## The app is v2

The app lives in `frontend/src/features/openings/` (published under `/v2/`, `/` redirects to `/v2/home`; see its
`README.md`). The v1 (JSONB repertoires, PGN import, sync, training, dashboard, explore) was removed on
2026-11-17; the first production deploy after it exported the whole database to `backups/v1-final.sql.gz` on the
server before the backend dropped the v1 tables. Backend: auth (Lichess OAuth only; email/password removed on 2026-11-22, its columns dropped on 2026-11-25 after an export to `backups/legacy-auth-final.sql.gz`, account deletion confirmed by a Lichess round-trip, `POST /api/auth/account/deletion`), the explorer relay
`/api/explorer/*` and its Postgres cache, and the v2 routes `/api/v2/games*` (Lichess and Chess.com import) and `/api/v2/state*`
(the player's decisions).

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

Dev services: frontend 5173, backend 8080, Postgres 5432, Prometheus 9091, Grafana 3000.

Narrower loops:

```bash
cd backend  && air                                            # hot reload (.air.toml)
cd backend  && go test -v -run TestName ./internal/services/  # one test
cd frontend && npx vitest run -t "test name"
```

## Stack

**Frontend** React 19 · TypeScript 6 · Vite 8 · Tailwind 4 · Zustand · chess.js · D3 · Framer Motion · Vitest 4
**Backend** Go 1.26 module, built and run on Go 1.27 (CI, images) · Echo **v5** · pgx v5 · notnil/chess · golang-jwt v5 · testify · testcontainers
**Data** PostgreSQL 17 (schema created by the backend at boot, `internal/repository/db.go`)
**Engine** Stockfish 18 NNUE lite WASM, vendored in `frontend/public/stockfish-18-lite.{js,wasm}`

## Layout

- `backend/` — `main.go` wires dependencies and routes; `config/` (env + `limits.go`); `internal/{handlers,middleware,models,repository,services,testhelpers}` plus `crypto` (cookie sealing); `tests/integration/`. Module `github.com/kumquat/backend`.
- `frontend/src/` — `features/openings/` (the app), `shared/` (opening names, piece SVGs, error boundary), `stores/authStore`, `services/` (`api.ts`, `stockfishConfig.ts`), `types/`.
- `monitoring/`, `scripts/`.

## Conventions worth knowing

These are the project-specific ones; the rest is idiomatic Go / React.

- **Handlers are closures**: `func XxxHandler(svc services.XxxInterface) echo.HandlerFunc`.
- **Mocks are hand-written** with `XxxFunc` fields (`internal/repository/mocks/`, `internal/services/mocks/`), not generated.
- **Sentinel errors** live in `internal/repository/errors.go` and at the top of service files; wrap with `%w`, test with `errors.Is`.
- **No Prettier** on the frontend — formatting is by convention (2 spaces, semicolons, ~100 cols).
- **Named exports**, never default. Lazy routes via `React.lazy(() => import(…).then(m => ({ default: m.Name })))`.
- Go test names: `TestServiceName_MethodName_Scenario`. Frontend test names are sentences (see below).

## What to test (v2, `frontend/src/features/openings`)

A test exists to catch a bug in code the agent did not read, not to restate the code.

1. **Test rules, not screens.** Every product decision (a threshold, an order, what comes first, when something comes back) lives in a pure function with its test; the component only renders. Example: `home/hero.ts`.
2. **One test = one sentence PMG would sign**, in `CONTEXT.md` vocabulary ("an opponent move off the repertoire comes back to settle only when it repeats"). If the sentence says nothing PMG cares about, don't write the test.
3. **A failing test means a bug or a changed rule.** A changed rule changes its test in the same commit and the summary says so ("rule changed: …"). If the only fix is updating the expected value while the rule did not change, delete the test instead of fixing it.
4. **No page or component tests while v2 is a POC**: they pin exact copy, figures from the fixture and DOM structure, which change with every UI pass. Screens are checked in the browser (playwright, 390 px too). Exception: an interaction that cannot leave the component (building a line with the keyboard) — one test per path, queried by role.
5. **One guard on PMG's real games** (`playedGamesFixture`) per major rule, e.g. the Morra and the Philidor ranked first in `priorities.test.ts`: it catches a threshold invented examples never hit. These are the only tests allowed to assert fixture figures.
6. **Deleted code takes its tests with it**, and code only its own tests call is dead: delete both.

## Traps

- **Color values differ across the wire**: backend JSON uses `"white"/"black"`, the frontend uses `'w'/'b'` for chess.js.
- **Never trust raw SAN** — validate through `notnil/chess` (Go) or `chess.js` (frontend).
- Positions are stored as **full FEN**; comparing two positions for transposition means ignoring the clock fields.
- API errors are always `{"error": "message"}`.
- A game's `id` on the frontend (`CheckedGame.id`) is its rank in `GET /api/v2/games` (ordered by day, then arrival `seq`): older Chess.com games arriving later shift it. Anything stored across loads keys on `CheckedGame.key` (`source:id`, the rank for the demo).

## Auth & middleware

- Sign-in is Lichess OAuth only. Access JWT 15 min, held in memory only. Refresh token in an httpOnly cookie, 30 days, single-use rotation; replaying a used one revokes all the user's refresh tokens.
- Lichess OAuth uses PKCE; cookie encryption via HKDF.
- Rate limits per IP, in-memory: global 100/min (burst 20), auth endpoints (Lichess OAuth, refresh, logout) 20/min (burst 10), starting a game import 6/min (burst 3). In production nginx (`frontend/nginx.prod.conf`) is stricter on all of `/api/auth/`: 5/min (burst 5), `/me` and `/refresh` included. Identity comes from `RealIP()` — see the deployment note in `.env.example` before putting a proxy in front.
- Body limit 10MB. CORS origins from `CORS_ALLOWED_ORIGINS` (a `*` panics at boot: credentials are enabled).
- Prometheus metrics on a separate port (9090 in-container), middleware prefix `kumquat`.

## Docs

- `CONTEXT.md` — domain glossary. Use its vocabulary when naming things; add to it when a term gets sharpened.
- `SPECIFICATIONS.md` — technical reference checked against the code: HTTP routes, DB schema, configuration, calls to Lichess. Product decisions stay in the openings `README.md`.
- `README.md` — setup and deployment.
- `docs/competitors.md` — what similar apps do (2026-11 survey) and the ideas it gave, with sources.

## Issue tracker

GitHub Issues on `Piemme99/TreeChess`, via `gh`. Triage labels: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`.

## Workflow

- **Run `make test` before committing.** Don't commit on red.
- Work on a branch, never commit directly on `main`; integration happens through squashed PRs.
- **Every push to `main` deploys to production** once its CI is green (`ci.yml` → `deploy.yml`). Roll back by running
  the Deploy workflow by hand with an earlier commit.
- On `agent/*` branches (AFK sessions): commit before emitting the completion signal.

## Autonomy & reporting

- **Decide by default.** When the code, `CONTEXT.md` or a convention points to a reasonable answer, take it, list it in one line in the final summary, and keep going.
- **Stop only for decisions that are genuinely PMG's**: product/UX direction, irreversible or outward-facing actions. Before stopping, finish everything that doesn't depend on the answer.
- **Questions are short and answerable in one word.** This overrides the 4-part question format of the global instructions: context in 1-2 sentences with a named example (file, function, test), your recommendation and why, the alternative and its cost in one line, then the question alone at the end ("OK?", "A or B?"). Never an open question.
- **End every reply with the suggested next step.**
- **Be concise.** The final reply should fit a phone screen: outcome first, then verified / not verified, then decisions taken, then the next step. No narration of the investigation, no restating the diff.
