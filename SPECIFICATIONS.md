# Kumquat — Technical Specifications

What the running app does, checked against the code on 2026-11-24. When this document and the code disagree,
the code wins: fix this document in the same PR.

The v1 (JSONB repertoires, PGN import, sync, training, dashboard, explore, email/password sign-in) was removed on
2026-11-17 and 2026-11-22; see git history before #262 for its spec.

## 1. Where things are documented

| Topic | Source of truth |
| --- | --- |
| Product decisions of the v2 (screens, thresholds, what comes first, what was rejected) | [`frontend/src/features/openings/README.md`](frontend/src/features/openings/README.md) |
| Domain vocabulary (repertoire, game check, addition, weak opening, worked line…) | [`CONTEXT.md`](CONTEXT.md) |
| Commands, conventions, traps, auth and rate-limit summary | [`CLAUDE.md`](CLAUDE.md) |
| Setup, project tree, deployment, infrastructure security | [`README.md`](README.md) |
| HTTP routes, DB schema, configuration, external calls | this document |

## 2. Overview

Kumquat builds a player's opening repertoire from their own Lichess games and trains it. The server imports and
stores the games and the player's decisions; everything else (opening tree, repertoire, game checks, weak openings,
review schedule, practice) is computed in the browser from those two inputs (`frontend/src/features/openings/domain/`).

- **Signed-in player**: games come from `GET /api/v2/games`, decisions from `GET /api/v2/state` and are written back
  with `PUT /api/v2/state/:key`.
- **Demo** (signed-out "Try it on a sample player"): PMG's fixture games replayed day by day, decisions in
  `localStorage` under `kumquat.v2.<key>`. Nothing touches the server.

### 2.1 Pages (`frontend/src/App.tsx`)

| Production | Dev only | Page |
| --- | --- | --- |
| `/v2/home` | `/dev/home` | Home: what waits (hero card + rows), sign-in, first import |
| `/v2/tree` | `/dev/tree` | Repertoire tree; tasks via `?task=check` / `?task=weak&side=…&line=…` |
| `/v2/review` | `/dev/review` | Review session (spaced repetition) |
| `/v2/practice` | `/dev/practice` | Practice game against the explorer (`?side=w\|b&line=…`) |
| `/v2/openings` | `/dev/flame-graph` | Openings: flame graph and priorities (computer view, reached from the ⋯ menu) |
| — | `/dev/games` | Games: game checks day by day (dev tool) |

Any other path (`/`, old v1 URLs, `/login` after OAuth) redirects to Home, keeping its query string. `/dev/*` routes
are not built in production.

## 3. HTTP API (`backend/main.go`)

All JSON. Errors are `{"error": "message"}`, sometimes with a machine-readable `"code"`. Colours on the wire are
`"white"` / `"black"` (the frontend uses `'w'` / `'b'`).

| Method | Path | Auth | Rate limit (per IP) | Does |
| --- | --- | --- | --- | --- |
| GET | `/api/health` | — | global | `{"status":"ok"}`, or `"degraded"` (503) when Postgres does not answer |
| GET | `/api/explorer/:database` | optional | global | Lichess explorer relay, `lichess` or `masters` (§3.3) |
| GET | `/api/auth/lichess/login` | — | auth | Starts Lichess OAuth (PKCE); `?next=` a local path to come back to |
| GET | `/api/auth/lichess/callback` | — | auth | Ends OAuth: sign-in, or account deletion (§3.4) |
| POST | `/api/auth/refresh` | refresh cookie | auth | Rotates the refresh cookie, returns a new access token |
| POST | `/api/auth/logout` | refresh cookie | auth | Revokes the refresh cookie |
| GET | `/api/auth/me` | JWT | global | The signed-in user, with a derived `lichessLinked` boolean (never the token) |
| POST | `/api/auth/account/deletion` | JWT | global | Deletes the account (§3.4) |
| POST | `/api/v2/games/import` | JWT | import | Starts the game import, 202 with its state (§3.1) |
| GET | `/api/v2/games/import` | JWT | global | State of the last import, `{"status":"none"}` if never run |
| GET | `/api/v2/games` | JWT | global | `{"games": [...]}`, every imported game |
| GET | `/api/v2/state` | JWT | global | `{"state": {key: value, ...}}`, `{}` when nothing is stored |
| PUT | `/api/v2/state/:key` | JWT | global | Replaces one key (§3.2), 204 |

Rate limits are in-memory, keyed on the client IP from `RealIP()` (trusted proxy hops only): global 100/min
(burst 20), auth 20/min (burst 10), import 6/min (burst 3, Home starts an import on every load). In production
nginx adds 10 req/s (burst 20) on `/api/` and 5/min (burst 5) on all of `/api/auth/` (`frontend/nginx.prod.conf`).
JWT routes run under a 30 s request timeout, except `POST /api/v2/games/import`. Body limit 10 MB.

### 3.1 Game import (`internal/services/played_game_import.go`)

- Needs a Lichess-linked account (`lichess_username` and a stored token), else 403 `code: "lichess_sign_in"`.
- Runs in the background (20 min budget), detached from the request: leaving the page does not stop it. A second
  start while one is running returns the running state; a `running` import with no progress for 5 min reads as
  `failed` ("the import stopped before the end") and can be restarted.
- Reads `GET https://lichess.org/api/games/user/{username}` (NDJSON, `perfType=blitz,rapid,classical`, finished
  games, oldest first) with the player's token. The first import reads everything; the next ones read from the day
  before the most recent stored game, duplicates dropped by the primary key.
- Keeps a game only if it is standard chess, blitz/rapid/classical, finished, played by that username, and its first
  80 plies replay legally through `notnil/chess`. Stored: colour, those plies as space-separated SAN, score (1, ½, 0
  for the player), the player's rating, the day of the last move (UTC). Saved by batches of 100; `imported` grows as
  they land.
- Import state: `{status: "running"|"done"|"failed", imported, error?, startedAt, finishedAt?, firstDoneAt?}`.
  `firstDoneAt` is the end of the first successful import: the repertoire is born that day and later imports do not
  move it.
- `GET /api/v2/games` returns games ordered by `played_at`, then arrival `seq`. Each is
  `{id, color, moves, score, rating?, playedAt}` with `id` the Lichess game id; the frontend then keys decisions on
  the game's **rank** in that list, so the order must never change.

### 3.2 Player state (`internal/handlers/player_state.go`)

One JSON value per key, per user, in `player_state.state`. Accepted keys: `additions`, `ignored-checks`,
`kept-moves`, `removals`, `review`, `worked` (any other is 400). The body must be valid JSON and at most 1 MiB
(413 beyond). A PUT replaces that key only (`state || jsonb_build_object(key, value)`), so two pages writing two keys
do not overwrite each other. What each value means is in the openings README.

The frontend (`workshop/storage.ts`) writes 300 ms after a change, retries up to 3 times, and flushes pending writes
with a `keepalive` fetch on `pagehide`.

### 3.3 Explorer relay (`internal/handlers/explorer_proxy.go`)

Forwards `GET {LICHESS_EXPLORER_BASE_URL}/{lichess|masters}` with the signed-in user's Lichess token (Lichess requires
one for every database since November 2026). Only known parameters pass, from closed lists: `fen` (validated),
`variant=standard`, `moves`/`topGames`/`recentGames` (0–30), and for `lichess` only `speeds` and `ratings` (deduplicated
and sorted). Responses are cached in `opening_explorer_cache` for `LICHESS_EXPLORER_CACHE_TTL_HOURS` (7 days by
default), keyed on the parameters with the FEN's clock fields dropped, and shared by all users.

- Cache hit: served to anyone, signed in or not.
- Miss without a session: 403 `lichess_sign_in`; signed in without a Lichess token: 403 `lichess_not_linked`.
- Upstream 429: 429 `rate_limited` with `retryAfterSeconds`; token rejected: 403 `lichess_token_invalid`; Lichess
  down: 502 `upstream_unavailable` or `upstream_error`.

In dev without a backend, `VITE_LICHESS_TOKEN` in `frontend/.env.local` lets the frontend query Lichess directly.

### 3.4 Authentication and account deletion

Lichess OAuth only (`internal/handlers/oauth.go`, `internal/services/oauth_service.go`), PKCE, scope `study:read`.
The OAuth state and code verifier travel in an `oauth_state` cookie (10 min, path `/api/auth/lichess`), AES-GCM
sealed with a key derived by HKDF from `JWT_SECRET`. The callback finds or creates the user by
`(oauth_provider, oauth_id)` and stores the Lichess access token, encrypted at rest with another HKDF-derived key
(tokens stored in clear before that are encrypted at boot by `EncryptLegacyLichessTokens`). The access token never
appears in the redirect: the callback sets the refresh cookie and redirects to `FRONTEND_URL` + `next`, or to
`/login` (`?new=1` for a new account; `?error=…` on failure), which the frontend routes to Home.

- **Access JWT**: HS256, 15 min by default, kept in memory only (`frontend/src/services/api.ts`); a 401 triggers one
  coalesced refresh.
- **Refresh token**: `refresh_token` cookie, httpOnly, `SameSite=Strict`, path `/api/auth`, 30 days, stored hashed.
  Single use: a rotated token is marked `consumed`; presenting a consumed one revokes all the user's refresh tokens.
- **Account deletion** (`POST /api/auth/account/deletion`, body `{"username": "<typed username>"}`, must match):
  - a Lichess account answers `{"redirect": "<Lichess URL>"}`; the account is deleted only when the callback
    authenticates the Lichess account linked to it, then redirects to `/v2/home?deleted=1` (else
    `/v2/home?deletion=failed`). A stolen access JWT alone deletes nothing.
  - an old account without Lichess (email era) is deleted on proof of a valid, unconsumed refresh cookie (204), else
    403.
  - Deleting a user cascades to every table holding their data.

### 3.5 Background work

`CleanupService` runs every `CLEANUP_INTERVAL_MINUTES` (60 by default): deletes expired refresh tokens and expired
explorer cache rows. Game imports run in their own goroutines (§3.1).

## 4. Database (`backend/internal/repository/db.go`)

PostgreSQL 17. No migration files: `runMigrations()` runs a list of idempotent statements at every boot, under
advisory lock `1001` so two instances do not race. To change the schema, append a statement there. The effective
schema after boot:

```sql
CREATE TABLE users (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username              VARCHAR(50) NOT NULL UNIQUE,
    password_hash         VARCHAR(255),                      -- legacy
    oauth_provider        VARCHAR(20),
    oauth_id              VARCHAR(255),
    created_at            TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    lichess_username      VARCHAR(50),
    chesscom_username     VARCHAR(50),                       -- legacy
    last_lichess_sync_at  TIMESTAMP WITH TIME ZONE,          -- legacy
    last_chesscom_sync_at TIMESTAMP WITH TIME ZONE,          -- legacy
    lichess_access_token  TEXT,                              -- encrypted (AES-GCM)
    time_format_prefs     TEXT[] DEFAULT '{}',               -- legacy
    email                 VARCHAR(255),                      -- legacy
    password_changed_at   TIMESTAMP WITH TIME ZONE,          -- legacy
    UNIQUE (oauth_provider, oauth_id)
);
CREATE UNIQUE INDEX idx_users_email ON users(email) WHERE email IS NOT NULL;

-- legacy
CREATE TABLE password_reset_tokens (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at    TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX idx_password_reset_tokens_user    ON password_reset_tokens(user_id);
CREATE INDEX idx_password_reset_tokens_hash    ON password_reset_tokens(token_hash);
CREATE INDEX idx_password_reset_tokens_expires ON password_reset_tokens(expires_at);

CREATE TABLE refresh_tokens (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    consumed   BOOLEAN NOT NULL DEFAULT false
);
CREATE INDEX idx_refresh_tokens_user    ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_hash    ON refresh_tokens(token_hash);
CREATE INDEX idx_refresh_tokens_expires ON refresh_tokens(expires_at);

CREATE TABLE opening_explorer_cache (
    cache_key  TEXT PRIMARY KEY,
    response   JSONB NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_opening_explorer_cache_expires ON opening_explorer_cache(expires_at);

CREATE TABLE played_games (
    user_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    source    VARCHAR(20) NOT NULL,          -- 'lichess'
    source_id VARCHAR(40) NOT NULL,          -- Lichess game id
    color     VARCHAR(5) NOT NULL,           -- 'white' | 'black'
    moves     TEXT NOT NULL,                 -- up to 80 SAN plies, space-separated
    score     REAL NOT NULL,                 -- 1, 0.5, 0 for the player
    rating    INTEGER,
    played_at DATE NOT NULL,
    seq       BIGSERIAL,                     -- arrival order, keeps ranks stable
    PRIMARY KEY (user_id, source, source_id)
);

CREATE TABLE played_game_imports (
    user_id       UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    status        VARCHAR(10) NOT NULL,      -- 'running' | 'done' | 'failed'
    imported      INTEGER NOT NULL DEFAULT 0,
    error         TEXT,
    started_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at   TIMESTAMPTZ,
    first_done_at TIMESTAMPTZ                -- backfilled from finished_at for existing 'done' rows
);

CREATE TABLE player_state (
    user_id    UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    state      JSONB NOT NULL DEFAULT '{}',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Legacy columns and table, kept on purpose.** They served email/password sign-in and the v1 sync, both removed.
Nothing in the app writes them any more; they stay so that nothing is destroyed in production. Precisely:
`password_hash`, `password_changed_at` and `password_reset_tokens` are neither read nor written (reset tokens still go
with the account by cascade). `email`, `chesscom_username`, `last_lichess_sync_at`, `last_chesscom_sync_at` and
`time_format_prefs` are still selected into the `User` model (`user_repo.go`) and so echoed by `GET /api/auth/me`
when set, but no screen uses them. `oauth_provider = 'lichess'` with an `oauth_id` is what makes an account a Lichess
account (§3.4).

**Dropped at boot**: the v1 tables `games`, `viewed_games`, `engine_evals`, `game_fingerprints`,
`dismissed_mistakes`, `dismissed_gaps`, `analyses`, `repertoires`, `categories`, and the function
`check_repertoire_limit()`. The first production deploy after #262 exported the whole database to
`backups/v1-final.sql.gz` on the server before that.

## 5. Engine and other calls from the browser

- **Stockfish 18 NNUE lite**, WASM, vendored in `frontend/public/stockfish-18-lite.{js,wasm}`, run in a dedicated Web
  Worker (`features/openings/line/engine.ts`, `services/stockfishConfig.ts`). Threads: up to 4 on desktop (cores − 1),
  1 on mobile (2 with ≥ 6 cores). Multi-threading needs `SharedArrayBuffer`, hence the COOP/COEP headers set in
  `vite.config.ts` and `nginx.prod.conf`. Evaluations are cached in memory by `depth|fen`; nothing is stored.
- **Lichess cloud eval** (`https://lichess.org/api/cloud-eval`, `multiPv=1`) is asked first for every position;
  Stockfish runs only when Lichess does not know it. After a 429 the cloud is skipped for 60 s.
- **Lichess analysis board** links (`https://lichess.org/analysis/pgn/…`) open a game or a line for deeper study.
  Never chess.com.
- Opening names come from the bundled `lichess-org/chess-openings` dataset (`shared/data/openings.json`).

## 6. Configuration (`backend/config/config.go`)

The backend loads `../.env` if present (production reads `.env.production`, see `README.md`).

| Variable | Default | Notes |
| --- | --- | --- |
| `ENVIRONMENT` | `development` | `production` switches to JSON logs, forces Secure cookies, enforces the secret length |
| `DATABASE_URL` | — (required) | `sslmode=prefer` in the production compose files |
| `JWT_SECRET` | — (required) | ≥ 32 bytes in production (boot fails otherwise); also seeds the HKDF keys |
| `JWT_EXPIRY_MINUTES` | 15 | Access token lifetime; takes precedence over `JWT_EXPIRY_HOURS` |
| `JWT_EXPIRY_HOURS` | — | Legacy override, used only when `JWT_EXPIRY_MINUTES` is unset |
| `PORT` | 8080 | API port |
| `METRICS_PORT` | 9090 | Prometheus `/metrics`, separate server, not exposed publicly |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:5173` | Comma-separated; a `*` panics at boot (credentials are on) |
| `FRONTEND_URL` | `http://localhost:5173` | Base of OAuth redirects |
| `LICHESS_CLIENT_ID` | — | OAuth client id |
| `OAUTH_CALLBACK_URL` | `http://localhost:{PORT}/api/auth/lichess/callback` | |
| `SECURE_COOKIES` | `false` | Ignored (always on) in production |
| `LICHESS_EXPLORER_BASE_URL` | `https://explorer.lichess.org` | |
| `LICHESS_EXPLORER_CACHE_TTL_HOURS` | 168 | |
| `CLEANUP_INTERVAL_MINUTES` | 60 | |

Frontend: `VITE_API_URL` (default `/api`), `VITE_LICHESS_TOKEN` (dev only, §3.3).

## 7. Server behaviour worth knowing

- **Logs**: `log/slog`, text at debug level in development, JSON at info level in production, to stdout.
- **Security headers** on every API response (`securityHeaders` in `main.go`): nosniff, `X-Frame-Options: DENY`,
  `Referrer-Policy`, HSTS, a strict CSP, `Permissions-Policy`. nginx sets its own for the static app.
- **Timeouts**: read 10 s (headers 5 s), write 120 s, idle 60 s; graceful shutdown 10 s, the cleanup worker joined
  before the DB pool closes.
- **DB pool**: 2 to 20 connections, 5 s per query (`config/limits.go`), 10 s for an account deletion, 30 s for the
  boot migrations.
- **Metrics**: Echo Prometheus middleware, prefix `kumquat`; Prometheus and Grafana in `monitoring/`.
