# TreeChess - Technical and Functional Specifications

**Version:** 9.0
**Date:** February 4, 2026
**Status:** Draft

---

## 1. Context and Vision

### 1.1 Problem Statement

Amateur chess players (below 2000 ELO) face significant challenges in learning and memorizing their opening repertoires. Existing tools (Lichess, Chess.com, books) offer either static repertoires or analysis tools, but none allow building a personalized repertoire interactively while automatically enriching it from one's own games.

### 1.2 Proposed Solution

TreeChess is a web application that enables players to create, visualize, and enrich their opening repertoire as an interactive tree. The user builds their repertoire move by move, then imports games to identify gaps and automatically complete missing branches.

### 1.3 Value Proposition

- **Personalization**: The user keeps only the lines they want to learn
- **Incremental Growth**: The tree grows naturally with each imported game
- **Intuitive Visualization**: GitHub-style representation of opening possibilities
- **Active Review**: Replaying branches to memorize sequences

---

## 2. Project Objectives

### 2.1 Current State

TreeChess is a multi-user web application allowing players to create, visualize, and enrich their opening repertoires. The following is implemented:

- **Authentication**: Local registration + OAuth Lichess
- **Multiple repertoires**: Up to 50 per user, multiple per color
- **Categories**: Organize repertoires into named categories (e.g., "White Openings", "Aggressive Lines")
- **Import sources**: PGN file upload, Lichess API, Chess.com API, Lichess Study import
- **Sync**: Automatic sync of recent games from Lichess/Chess.com
- **Analysis**: Game-by-game comparison against repertoire trees
- **Engine**: Stockfish WebAssembly for position evaluation
- **Repertoire templates**: Pre-built opening trees (Sicilian, Italian, etc.)
- **Repertoire operations**: Merge multiple repertoires, extract subtrees into new repertoires
- **Insights**: Engine-powered opening mistake detection and analysis

**Tech Stack:**

- Frontend: React 18 + TypeScript + Vite
- Backend: Go 1.25 + Echo
- Database: PostgreSQL 17 + pgx
- State: Zustand
- Engine: Stockfish.js (WebAssembly)

### 2.2 Features Not Yet Implemented

- Training mode with quiz and spaced repetition
- Main line vs sideline visualization
- Repertoire PGN export
- Progress statistics
- Comments on positions (backend supports, UI pending)
- Production deployment

---

## 3. Functional Specifications

### 3.1 Repertoire Management

#### REQ-001: Repertoire Creation

Users create repertoires explicitly via `POST /api/repertoires` with a name and color. On first login, the onboarding flow offers template-based creation (e.g., Sicilian Defense, Italian Game).

Each repertoire tree starts with the initial position (FEN: `rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -`).

#### REQ-002: Active Repertoire Selection

The user can switch between repertoires via a selector. The displayed tree corresponds to the selected repertoire.

#### REQ-003: Data Persistence (PostgreSQL)

Data is stored in a PostgreSQL database. See section 4.2 for the full schema.

#### REQ-004: Multiple Repertoires per Color

Users can create up to 50 repertoires total, multiple per color. Each repertoire has a name and color. A trigger enforces the 50-repertoire limit per user.

#### REQ-005: Repertoire Categories (Implemented)

Users can organize repertoires into named categories:
- Create categories with name and color
- Assign repertoires to categories
- Repertoires display grouped by category in the UI
- Maximum 50 categories per user
- Cascade delete: deleting a category removes all its repertoires

#### REQ-006: Merge Repertoires (Implemented)

Users can merge multiple repertoires of the same color into a single new repertoire:
- Select 2+ repertoires to merge
- All source repertoires are deleted after merge
- New repertoire contains combined tree structure
- Move conflicts resolved by keeping both branches

#### REQ-007: Extract Subtree (Implemented)

Users can extract a branch from a repertoire into a new standalone repertoire:
- Select any non-root node in a repertoire
- Creates new repertoire with the subtree from that node
- Original repertoire has the branch removed (pruned)
- Both repertoires are returned

---

### 3.2 PGN Import

#### REQ-010: PGN File Import

The user can upload a PGN file via a file selector interface. The file can contain one or more games.

#### REQ-011: PGN Parsing

The backend parses the following PGN elements:

- Headers: `[Event]`, `[Site]`, `[Date]`, `[Round]`, `[White]`, `[Black]`, `[Result]`, `[ECO]`, `[Termination]`
- Moves: Move sequence in Standard Algebraic Notation (SAN)

#### REQ-012: Comments Exclusion

Comments `{}` and variations `()` are ignored during parsing.

#### REQ-013: PGN Format Validation

If the file is not valid PGN, display an explicit error message with the problematic line.

---

### 3.3 Lichess Study Import (Implemented)

#### REQ-015: Study Import

Users can import chapters from Lichess studies as repertoires:
- Paste a Lichess study URL
- System fetches study metadata (name, chapters)
- User selects which chapters to import
- Each chapter becomes a separate repertoire
- Optional: Merge all chapters into a single repertoire
- Optional: Create a category and assign imported repertoires to it

#### REQ-016: Study Import Validation

- Studies with custom starting positions are rejected
- Private studies require authentication
- Invalid study URLs return clear error messages

---

### 3.4 Repertoire Comparison

#### REQ-020: Automatic Move Matching

For each imported game, the backend compares each move with the corresponding repertoire (White moves for White repertoire, Black moves for Black repertoire).

#### REQ-021: "Repertoire Followed" Definition

A move is considered "in the repertoire" if a corresponding outgoing edge exists from the current node in the user's tree.

#### REQ-022: Divergence Classification

Three cases during import:

| Case | Condition                             | Action                              |
| ---- | ------------------------------------- | ----------------------------------- |
| A    | User's move exists in tree            | Mark as "OK"                        |
| B    | User's move doesn't exist             | Mark as "Error - out of repertoire" |
| C    | Opponent's move doesn't exist in tree | Mark as "New line possible"         |

#### REQ-023: Post-Import Summary

After processing a PGN file, display a summary:

- Number of games analyzed
- Moves in repertoire (green)
- Moves out of repertoire (orange)
- New lines detected (blue)

---

### 3.5 Repertoire Enrichment

#### REQ-030: Manual Move Addition

From a divergence (case B or C), the user can add moves to the repertoire via:

- Manual input on the board (click piece, select target square)
- SAN notation in a text field

#### REQ-031: Unique Response Constraint

For a given opponent move, the user can record ONLY ONE response. If a response already exists, it is automatically proposed.

#### REQ-032: Sequence Addition

The user can add multiple consecutive moves (1-3 moves typically) to define a new variation.

#### REQ-033: Move Validation

Every added move must be legal according to chess rules. Use `chess.js` for validation before sending to backend.

---

### 3.6 Tree Visualization

#### REQ-040: GitHub-Style Representation

The tree is displayed as a Git commit diagram:

- Nodes = positions after a move
- Edges = moves played
- Horizontal layout left to right (start → end)
- Diverging branches separate visually
- As branches move away from root, nodes become closer (densification)

#### REQ-041: Tree Navigation

- Zoom in/out via scroll wheel or controls
- Pan via drag and drop
- Click on node to center view and update board

#### REQ-042: Move Display

Each node displays:

- The SAN move (e.g., "e4", "Nf3", "O-O")

#### REQ-043: Node Colors

- Root: Black
- All nodes: Same style for MVP

---

### 3.7 Stockfish Engine Analysis

#### REQ-050: Engine Integration

The application integrates Stockfish chess engine running in the browser via WebAssembly to provide real-time position analysis and move suggestions during repertoire editing.

#### REQ-051: Score Indicator

A score indicator is displayed above the chessboard showing the current position evaluation:

- For positive scores (advantage for White): displayed as "+1.5" (centipawns divided by 100)
- For negative scores (advantage for Black): displayed as "-1.5"
- For mate situations: displayed as "Mate in X" where X is the number of half-moves to mate
- During analysis: displayed as "Analyzing..."

The indicator uses color coding:

- Green: evaluation is favorable to the active color or score > -50 (good position)
- Red: score < -50 (poor position for White)

#### REQ-052: Best Move Highlight

The best move suggested by Stockfish is visually highlighted on the chessboard:

- Source square highlighted with blue border
- Target square highlighted with blue border
- Works via `customSquareStyles` in react-chessboard component

#### REQ-053: Top Moves Panel

A panel displays the top 3 best moves for the current position along with their evaluations:

- Move in SAN notation (e.g., "1. e4")
- Evaluation score formatted as "+0.8" or "-0.5"
- Analysis depth displayed (e.g., "Top Moves (depth 12)")

#### REQ-054: Analysis Configuration

Stockfish analysis uses the following default configuration:

- **Depth:** 12 (balance between speed and accuracy, ~500ms response time)
- **Architecture:** WebAssembly running in browser Web Worker
- **No persistence:** Evaluations are calculated on-demand per session
- **UCI Protocol:** Universal Chess Interface for communication with engine

#### REQ-055: Analysis Trigger

Stockfish analysis is automatically triggered:

- **Initial load:** When repertoire edit page is first opened
- **Position change:** After every move played or node selected
- **On demand:** Can be started/stopped manually

#### REQ-056: Visual Feedback During Analysis

While Stockfish is calculating, the UI provides visual feedback:

- Score indicator shows "Analyzing..." text
- Optional loading spinner or progress indicator
- No move highlights until analysis completes

#### REQ-057: UCI Response Parsing

The Stockfish service parses UCI protocol responses including:

- **info lines:** Extract depth, score (cp or mate), bestmove, and pv (principal variation)
- **bestmove lines:** Extract best move (from-to UCI format)
- **Score parsing:** Convert centipawns (cp = 1/100 pawn) to display format
- **PV extraction:** Parse principal variation for top 3 moves

Example UCI output to parse:

```text
info depth 12 score cp 150 pv e2e4 e7e5 Bf1c4 ...
bestmove e2e4 ponder e7e5
```

#### REQ-058: Memory Management

Stockfish runs in a Web Worker to avoid blocking the main thread:

- Worker initialization on repertoire edit page mount
- Worker cleanup on unmount
- Stop command sent when user navigates away or position changes mid-analysis
- Single worker instance per page

#### REQ-059: Error Handling

Engine analysis errors are handled gracefully:

- Worker initialization failure: Display error message, disable analysis features
- Timeout: Stop analysis after 5 seconds, show timeout indicator
- Invalid FEN: Skip analysis, continue with repertoire editing

---

### 3.8 Opening Insights (Implemented)

#### REQ-060: Opening Mistake Detection

The system analyzes imported games to detect recurring opening mistakes:
- Compares user's played moves against engine top moves at each position
- Calculates winrate drop for non-optimal moves
- Identifies positions where user consistently plays suboptimal moves
- Groups mistakes by FEN position and move

#### REQ-061: Mistake Scoring

Each mistake is scored by:
- **Winrate drop:** Difference between played move and best move winrates
- **Frequency:** How many times the mistake occurs
- **Final score:** Weighted combination of severity and frequency

#### REQ-062: Insights Dashboard

The insights page displays:
- Worst mistakes ranked by score
- Associated games for each mistake
- Best move suggestion
- Engine analysis progress indicator

---

### 3.9 Review Mode (V2)

**Note**: This feature is deferred to V2.

#### REQ-070: Branch Visualization

The user selects a node and accesses a dedicated view displaying:

- A board with the current position
- The move sequence from root node to selected node
- Previous/Next navigation to browse the sequence

#### REQ-071: Active Review

In review mode, the user can:

- Replay moves by playing them on the board
- Receive immediate feedback on wrong move
- Return to branch start

#### REQ-072: Position + Notation Display

ALWAYS display simultaneously:

- Board diagram with pieces
- SAN move notation in text format

---

### 3.10 Game Sync

#### REQ-080: Automatic Game Sync

Users can link their Lichess and/or Chess.com usernames via their profile (`PUT /api/auth/profile`). The sync endpoint (`POST /api/sync`) fetches recent games from both platforms and imports them automatically.

#### REQ-081: Sync Behavior

- Only fetches games played since the last sync (tracked per platform via `last_lichess_sync_at` / `last_chesscom_sync_at`)
- Imported games are parsed and analyzed against the user's repertoires
- Errors on one platform do not block the other
- Returns a `SyncResult` with counts of imported games and any errors

#### REQ-082: Platform Usernames

Users set their Lichess and Chess.com usernames in the profile page. These are validated against `^[a-zA-Z0-9_-]{1,50}$` before being accepted.

---

## 4. Data Model

### 4.1 Tree Structure (PostgreSQL JSONB)

```typescript
type Color = "w" | "b";
type MoveSAN = string;

interface RepertoireNode {
  id: string;
  fen: string;
  move: MoveSAN | null;
  moveNumber: number;
  colorToMove: Color;
  parentId: string | null;
  comment: string | null;
  branchName: string | null;
  collapsed: boolean;
  transpositionOf: string | null;
  children: RepertoireNode[];
}

interface RepertoireMetadata {
  totalNodes: number;
  totalMoves: number;
  deepestDepth: number;
  lastGameDate: string | null;
}
```

### 4.2 PostgreSQL Schema

The schema is managed via inline migrations in `repository/db.go`. The current state:

```sql
-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255),
    oauth_provider VARCHAR(20),
    oauth_id VARCHAR(255),
    lichess_username VARCHAR(50),
    chesscom_username VARCHAR(50),
    last_lichess_sync_at TIMESTAMP WITH TIME ZONE,
    last_chesscom_sync_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(oauth_provider, oauth_id)
);

-- Categories table
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    color VARCHAR(5) NOT NULL CHECK (color IN ('white', 'black')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Repertoires table (multiple per user, up to 50)
CREATE TABLE repertoires (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category_id UUID REFERENCES categories(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL DEFAULT 'Main Repertoire',
    color VARCHAR(5) NOT NULL CHECK (color IN ('white', 'black')),
    tree_data JSONB NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{"totalNodes": 0, "totalMoves": 0, "deepestDepth": 0}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Trigger: max 50 repertoires per user
CREATE TRIGGER repertoire_limit_trigger
    BEFORE INSERT ON repertoires
    FOR EACH ROW EXECUTE FUNCTION check_repertoire_limit();

-- Trigger: max 50 categories per user
CREATE TRIGGER category_limit_trigger
    BEFORE INSERT ON categories
    FOR EACH ROW EXECUTE FUNCTION check_category_limit();

-- Analyses table
CREATE TABLE analyses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    username VARCHAR(255) NOT NULL,
    filename VARCHAR(255) NOT NULL,
    game_count INTEGER NOT NULL,
    results JSONB NOT NULL,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Engine evaluations table (for insights)
CREATE TABLE engine_evals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    analysis_id UUID NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
    game_index INTEGER NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    evals JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Dismissed mistakes table
CREATE TABLE dismissed_mistakes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    fen_hash VARCHAR(64) NOT NULL,
    played_move VARCHAR(10) NOT NULL,
    dismissed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, fen_hash, played_move)
);

-- Performance indexes
CREATE INDEX idx_repertoires_user_id ON repertoires(user_id);
CREATE INDEX idx_repertoires_color ON repertoires(color);
CREATE INDEX idx_repertoires_category ON repertoires(category_id);
CREATE INDEX idx_repertoires_updated ON repertoires(updated_at DESC);
CREATE INDEX idx_repertoires_name ON repertoires(name);
CREATE INDEX idx_categories_user_id ON categories(user_id);
CREATE INDEX idx_categories_color ON categories(color);
CREATE INDEX idx_analyses_user_id ON analyses(user_id);
CREATE INDEX idx_analyses_username ON analyses(username);
CREATE INDEX idx_analyses_uploaded ON analyses(uploaded_at DESC);
CREATE INDEX idx_engine_evals_user_analysis ON engine_evals(user_id, analysis_id);
CREATE INDEX idx_engine_evals_status ON engine_evals(status);
```

### 4.3 JSONB Stored Structure

```json
{
  "id": "root-white",
  "fen": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -",
  "move": null,
  "moveNumber": 0,
  "colorToMove": "w",
  "children": [
    {
      "id": "e4",
      "fen": "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3",
      "move": "e4",
      "moveNumber": 1,
      "colorToMove": "b",
      "parentId": "root-white",
      "children": [
        {
          "id": "c5-sicilian",
          "fen": "rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq c6",
          "move": "c5",
          "moveNumber": 1,
          "colorToMove": "w",
          "parentId": "e4",
          "children": [
            {
              "id": "nf3",
              "fen": "rnbqkbnr/pp1ppppp/8/2p5/4P3/5N2/PPPP1PPP/RNBQKBNR b KQkq -",
              "move": "Nf3",
              "moveNumber": 2,
              "colorToMove": "b",
              "parentId": "c5-sicilian",
              "children": []
            }
          ]
        }
      ]
    }
  ]
}
```

### 4.4 PGN Analysis Result

```typescript
interface GameAnalysis {
  gameIndex: number;
  headers: PGNHeaders;
  moves: MoveAnalysis[];
}

interface MoveAnalysis {
  plyNumber: number;
  san: string;
  fen: string;
  status: "in-repertoire" | "out-of-repertoire" | "opponent-new";
  expectedMove?: string;
  isUserMove: boolean;
}
```

### 4.5 Stockfish Engine Types

```typescript
// Evaluation result from Stockfish engine
interface EngineEvaluation {
  score: number; // centipawns (+150 = +1.5 for White)
  mate?: number; // number of half-moves to mate (undefined if no mate)
  depth: number; // analysis depth (default: 12)
  bestMove?: string; // best move in SAN notation (e.g., "e4")
  bestMoveFrom?: string; // source square in UCI format (e.g., "e2")
  bestMoveTo?: string; // target square in UCI format (e.g., "e4")
  pv: string[]; // principal variation (sequence of UCI moves)
}

// Top move suggestion for the panel
interface TopMove {
  san: string; // SAN notation (e.g., "e4")
  score: number; // evaluation in centipawns
  depth: number; // analysis depth for this move
}

// UCI info line parsing result
interface UCIInfo {
  depth: number;
  score?: number; // centipawns (positive = advantage for White)
  scoreMate?: number; // mate in X moves (if found)
  bestMove?: string; // UCI format "e2e4"
  ponder?: string; // expected opponent move
  pv: string[]; // principal variation in UCI format
  nps?: number; // nodes per second
  time?: number; // time in milliseconds
  nodes?: number; // nodes searched
}

// Engine state for the UI
interface EngineState {
  isAnalyzing: boolean;
  currentEvaluation: EngineEvaluation | null;
  currentFEN: string;
  error: string | null;
}
```

---

## 5. Technical Architecture

### 5.1 MVP Tech Stack

| Layer             | Technology                 | Reason                              |
| ----------------- | -------------------------- | ----------------------------------- |
| Frontend          | React 18 + TypeScript      | Components, strict typing           |
| State Management  | Zustand                    | Lightweight                         |
| Chess             | chess.js                   | Move validation, FEN, SAN           |
| Chess Engine      | Stockfish.js (WebAssembly) | Position analysis, move suggestions |
| Worker Processing | Web Workers                | Non-blocking engine calculations    |
| Visualization     | D3.js or React Flow        | Interactive GitHub-style tree       |
| Backend           | Go + Echo                  | Performant REST API                 |
| Database          | PostgreSQL                 | Structured data, native JSONB       |
| DB Driver         | pgx                        | Native PostgreSQL driver for Go     |
| Frontend Build    | Vite                       | Fast dev server                     |

### 5.2 Backend Architecture (Go)

```
backend/
├── main.go                          # Entry point, DI, routes, middleware
├── Dockerfile                       # Multi-stage (dev + prod)
├── config/
│   ├── config.go                    # Environment-based configuration
│   └── limits.go                    # Application limits and constants
├── internal/
│   ├── handlers/
│   │   ├── auth.go                  # Register, Login, Me, UpdateProfile
│   │   ├── oauth.go                 # Lichess OAuth (redirect + callback)
│   │   ├── health.go                # Health check endpoint
│   │   ├── helpers.go               # Shared response helpers, validators
│   │   ├── repertoire.go            # CRUD repertoires, nodes, templates
│   │   ├── category.go              # Category CRUD operations
│   │   ├── study_import.go          # Lichess study import handler
│   │   ├── import.go                # PGN upload, Lichess/Chess.com import
│   │   ├── sync.go                  # Game sync handler
│   │   ├── games.go                 # Games list, delete, insights
│   │   └── engine.go                # Engine evaluation requests
│   ├── services/
│   │   ├── auth_service.go          # Registration, login, JWT generation
│   │   ├── oauth_service.go         # Lichess OAuth flow (PKCE)
│   │   ├── repertoire_service.go    # Repertoire CRUD + tree operations
│   │   ├── repertoire_templates.go  # Pre-built opening templates
│   │   ├── category_service.go      # Category business logic
│   │   ├── study_import_service.go  # Lichess study import
│   │   ├── import_service.go        # PGN parsing + repertoire analysis
│   │   ├── lichess_service.go       # Lichess API client
│   │   ├── chesscom_service.go      # Chess.com API client
│   │   ├── sync_service.go          # Game sync orchestration
│   │   ├── engine_service.go        # Engine evaluation management
│   │   └── game_analysis_service.go # Opening insights calculation
│   ├── repository/
│   │   ├── interfaces.go            # Repository interfaces
│   │   ├── db.go                    # Connection pool + inline migrations
│   │   ├── errors.go                # Sentinel errors
│   │   ├── user_repo.go             # User CRUD, OAuth, profile, sync timestamps
│   │   ├── category_repo.go         # Category CRUD
│   │   ├── repertoire_repo.go       # Repertoire CRUD, ownership checks
│   │   ├── import_repo.go           # Analysis CRUD, games, ownership
│   │   ├── engine_eval_repo.go      # Engine evaluation storage
│   │   └── mocks/mocks.go          # Mock implementations for testing
│   ├── models/
│   │   ├── user.go                  # User, AuthResponse, SyncResult
│   │   ├── category.go              # Category, CategoryWithRepertoires
│   │   └── repertoire.go            # RepertoireNode, Repertoire, GameAnalysis, etc.
│   └── middleware/
│       └── auth.go                  # JWT authentication middleware
└── go.mod
```

### 5.3 REST API

All routes except health and auth are protected by JWT authentication. Auth endpoints have stricter rate limiting (10 req/min vs 100 req/min globally).

```
# Public
GET    /api/health                           # Health check

# Authentication (stricter rate limit)
POST   /api/auth/register                    # Register new user
POST   /api/auth/login                       # Login with credentials
GET    /api/auth/lichess/login               # Lichess OAuth redirect
GET    /api/auth/lichess/callback            # Lichess OAuth callback

# Protected - User
GET    /api/auth/me                          # Get current user profile
PUT    /api/auth/profile                     # Update profile (Lichess/Chess.com usernames)

# Protected - Categories
GET    /api/categories                       # List user's categories
POST   /api/categories                       # Create new category
PATCH  /api/categories/:id                   # Rename category
DELETE /api/categories/:id                   # Delete category (cascades to repertoires)

# Protected - Repertoire CRUD
GET    /api/repertoires/templates            # List opening templates
POST   /api/repertoires/seed                 # Create repertoire from template
GET    /api/repertoires                      # List user's repertoires
POST   /api/repertoires                      # Create new repertoire
POST   /api/repertoires/merge                # Merge multiple repertoires
GET    /api/repertoires/:id                  # Get repertoire by ID
PATCH  /api/repertoires/:id                  # Update repertoire (rename, assign category)
DELETE /api/repertoires/:id                  # Delete repertoire
POST   /api/repertoires/:id/nodes            # Add node to repertoire
DELETE /api/repertoires/:id/nodes/:nodeId    # Delete node from repertoire
POST   /api/repertoires/:id/extract          # Extract subtree to new repertoire

# Protected - Studies
POST   /api/studies/info                     # Get Lichess study metadata
POST   /api/studies/import                   # Import chapters from Lichess study

# Protected - Import/Analysis
POST   /api/imports                          # Upload PGN + auto-analyze
POST   /api/imports/lichess                  # Import from Lichess API
POST   /api/imports/chesscom                 # Import from Chess.com API
POST   /api/imports/validate-pgn             # Validate PGN content
POST   /api/imports/validate-move            # Validate a move
GET    /api/imports/legal-moves              # Get legal moves for position
GET    /api/analyses                         # List all analyses
GET    /api/analyses/:id                     # Get analysis details
DELETE /api/analyses/:id                     # Delete analysis

# Protected - Games
GET    /api/games                            # List games (paginated, filterable)
DELETE /api/games/:analysisId/:gameIndex     # Delete specific game
POST   /api/games/bulk-delete                # Delete multiple games
POST   /api/games/:analysisId/:gameIndex/reanalyze  # Reanalyze game

# Protected - Insights
GET    /api/games/insights                   # Get opening insights (mistakes)
POST   /api/games/dismiss-mistake            # Dismiss a mistake

# Protected - Engine
POST   /api/engine/evaluate                  # Request engine evaluation
GET    /api/engine/status/:id                # Get evaluation status

# Protected - Sync
POST   /api/sync                             # Sync games from Lichess/Chess.com
```

### 5.4 Frontend Architecture

Feature-based structure:

```
frontend/src/
├── App.tsx                           # React Router
├── main.tsx                          # Entry point
├── tailwind.css                      # Global styles + theme tokens
├── overrides.css                     # Component overrides
├── services/
│   ├── api.ts                        # Axios API client
│   └── stockfish.ts                  # Stockfish WebAssembly service
├── stores/
│   ├── authStore.ts                  # Auth state (JWT, user)
│   ├── repertoireStore.ts            # Repertoire state
│   ├── engineStore.ts                # Stockfish engine state
│   └── toastStore.ts                 # Toast notifications
├── types/
│   └── index.ts                      # Global type definitions
├── shared/
│   ├── components/
│   │   ├── Board/ChessBoard.tsx      # Chessboard component
│   │   ├── Layout/MainLayout.tsx     # Layout wrapper
│   │   ├── ProtectedRoute.tsx        # Auth guard
│   │   └── UI/                       # Button, Modal, Loading, Toast, EmptyState
│   ├── hooks/
│   │   ├── useChess.ts               # chess.js wrapper
│   │   ├── useAbortController.ts     # Request cancellation
│   │   └── useAnalysisBase.ts        # Shared analysis logic
│   └── utils/
│       └── chess.ts                  # Chess utility functions
├── features/
│   ├── auth/
│   │   ├── LoginPage.tsx             # Login/register + OAuth
│   │   └── OnboardingModal.tsx       # First-login profile setup
│   ├── dashboard/
│   │   └── Dashboard.tsx             # Home page
│   ├── repertoire/
│   │   ├── RepertoireTab.tsx         # Repertoire list view
│   │   ├── RepertoireEdit.tsx        # Repertoire editor (main page)
│   │   └── shared/
│   │       ├── components/           # RepertoireCard, RepertoireSelector, RepertoireTree
│   │       └── hooks/               # useRepertoires, useStudyImport
│   ├── game-analysis/
│   │   ├── GameAnalysisPage.tsx      # Single game analysis
│   │   └── hooks/                   # useChessNavigation, useFENComputed, useGameLoader
│   ├── analyse-tab/
│   │   ├── AnalyseTab.tsx            # Import/analysis tab
│   │   └── hooks/                   # useGames, useAnalyses, useFileUpload
│   ├── analyse-import/
│   │   ├── ImportDetail.tsx          # Analysis results detail
│   │   └── hooks/                   # useAnalysisLoader, useAddToRepertoire
│   ├── games/
│   │   ├── GamesPage.tsx             # Games management
│   │   └── hooks/                   # useInsights
│   └── landing/
│       └── LandingPage.tsx           # Marketing landing page
```

### 5.5 Stockfish Integration Architecture

See section 3.7 for detailed specifications.

---

## 6. Tree Visual Component - Detailed Specifications

### 6.1 Objective

Create a React component displaying the move tree as a GitHub-style diagram (left to right) with zoom/pan and node selection. This component is critical and will be developed last.

### 6.2 Layout Algorithm

```typescript
interface TreeLayout {
  nodes: LayoutNode[];
  edges: LayoutEdge[];
}

interface LayoutNode {
  id: string;
  x: number;
  y: number;
  san: string;
  depth: number;
}

interface LayoutEdge {
  source: string;
  target: string;
  path: string;
}

function computeTreeLayout(root: RepertoireNode): TreeLayout {
  // Reingold-Tilford or Walker's algorithm
  // Objective: minimize crossings, constant spacing
  // Deep branches = closer nodes
}
```

### 6.3 Interactions

| Interaction       | Behavior                      |
| ----------------- | ----------------------------- |
| Scroll wheel      | Zoom in/out centered on mouse |
| Click + drag      | Pan viewport                  |
| Click node        | Select node, update board     |
| Double-click node | Open branch review mode       |
| Reset button      | Return to root                |

### 6.4 Graphical Rendering

```tsx
<svg className="repertoire-tree">
  <g className="viewport" transform={translate(x, y) scale(zoom)}>
    <TreeEdges edges={layout.edges} />
    <TreeNodes
      nodes={layout.nodes}
      selectedNodeId={selectedId}
      onNodeClick={handleNodeClick}
    />
  </g>
  <ZoomControls onZoom={setZoom} />
  <Legend />
</svg>
```

### 6.5 Visual Style

- **Node**: Circle (r=12px) or rounded rectangle with move text
- **Edge**: Curved line (quadratic Bézier) with arrow
- **Selected node**: Thick outline, different color
- **Root**: Square (distinct from other nodes)
- **Depth fade**: Reduced opacity for very deep branches

---

## 7. User Interface - Text Wireframes

**MVP Principle**: No out-of-scope functionality is displayed. Buttons for V2 features are absent from the interface.

### 7.1 Dashboard (Home Page)

```
┌─────────────────────────────────────────────────────────────────┐
│  TreeChess                                                      │
├─────────────────────────────────────────────────────────────────┤
│  Your repertoires:                                              │
│  ┌───────────────────────────────┐  ┌───────────────────────────┐│
│  │  ♔ White                      │  │  ♚ Black                  ││
│  │  [Edit]                       │  │  [Edit]                   ││
│  └───────────────────────────────┘  └───────────────────────────┘│
│                                                                 │
│  Recent imports:                                                │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  my_games.pgn                                [🗑][Analyze] ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│  [📁 Import PGN]                                               │
└─────────────────────────────────────────────────────────────────┘
```

### 7.2 Repertoires Page (List with Categories)

```
┌─────────────────────────────────────────────────────────────────┐
│  Repertoires                                        [+ New]     │
├─────────────────────────────────────────────────────────────────┤
│  ▼ Aggressive Lines (White)                                    │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  ♔ King's Gambit              [Edit] [🗑]                  ││
│  └─────────────────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  ♔ Evans Gambit               [Edit] [🗑]                  ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│  ▼ Solid Defenses (Black)                                      │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  ♚ Caro-Kann                  [Edit] [🗑]                  ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│  ▼ Uncategorized                                               │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  ♔ Italian Game               [Edit] [🗑]                  ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

### 7.3 Repertoire Edit Page

```
┌─────────────────────────────────────────────────────────────────┐
│  ♔ White - Edit                                    [← Back]    │
├─────────────────────────────────────────────────────────────────┤
├────────────────────┬────────────────────────────────────────────┤
│                    │                                            │
│   ┌────────────┐  │           ┌────────────────────────┐        │
│   │ TREE       │  │           │                        │        │
│   │ (GitHub    │  │           │      BOARD             │        │
│   │  style)    │  │           │                        │        │
│   │            │  │           │                        │        │
│   │ [+]        │  │           │                        │        │
│   └────────────┘  │           └────────────────────────┘        │
│                    │                                            │
├────────────────────┴────────────────────────────────────────────┤
│  Moves played: e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6                    │
│  [＋ Add move]  [🗑 Delete last]                                │
└─────────────────────────────────────────────────────────────────┘

Interactions:
- Click [+]: Open modal to add new move
- Right-click node: [Delete branch]
- Click node: Update board with position
```

### 7.4 Imports Page

```
┌─────────────────────────────────────────────────────────────────┐
│  Imports                                          [📁 Import]   │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  my_games.pgn                                [🗑][Analyze] ││
│  │  5 games imported                                           ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  december_tournament.pgn                    [🗑][Analyze]   ││
│  │  12 games imported                                           ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

### 7.5 PGN Import Modal

```
┌───────────────────────────────────────────┐
│  Import PGN file                          │
├───────────────────────────────────────────┤
│                                           │
│  [📁 Choose file]                         │
│  or drag and drop here                    │
│                                           │
│  file.pgn                                 │
│  [Cancel]        [Import]                 │
└───────────────────────────────────────────┘
```

### 7.6 Analysis Detail Page (after clicking "Analyze")

```
┌─────────────────────────────────────────────────────────────────┐
│  my_games.pgn                          [← Back Imports]         │
├─────────────────────────────────────────────────────────────────┤
│  Games:                                                         │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  Game 1 (Victory)                                           ││
│  │  1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6                 ││
│  │  ✓ Next move: [Nf6]                                         ││
│  │  [Add missing moves]                                        ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  Game 2 (Defeat) - 2 errors                                ││
│  │  1. e4 c5 2. Nf3 d6 [ERROR: g4 instead of d4]             ││
│  │  [Add g4]  [Ignore]                                         ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  Game 3                                                     ││
│  │  Opponent played: ...a6 after 1.e4 c5 2.Nf3 d6             ││
│  │  [Add ...a6]  [Ignore]                                      ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘

Legend:
- ✓ : Move in repertoire (no action required)
- [Add X]: Navigate to edit page at the relevant node
- [Ignore]: Do not add this line to the repertoire
```

### 7.7 Add Move Modal

```
┌───────────────────────────────────────────┐
│  Add response to c5                       │
├───────────────────────────────────────────┤
│                                           │
│    ┌─────┐  Move: [ Nf3    ]  [Validate]  │
│    │♜ ♞ ♝│                                   │
│    │♟ ♟ ♟│  Or play on the board:            │
│    │  ·  │                                   │
│    │♙ ♙ ♙│     ┌─────┐                      │
│    │♖ ♘ ♗│     │♘    │                      │
│    └─────┘     │     │                      │
│                │    ♙│ → →                   │
│                └─────┘                      │
│                                           │
│  [Cancel]                                 │
└───────────────────────────────────────────┘
```

---

## 8. UI Design System

### 8.1 Design Direction

**Inspiration:** chess.com — clean, functional, board-focused.  
**Mode:** Light mode only.  
**Accent color:** Warm amber orange (`#E67E22` primary, `#D4740A` hover) on a white/light gray base.  
**Typography:** Inter (clean sans-serif). Fallback: system sans-serif stack.  
**Chess board:** Keep current board styling unchanged (react-chessboard defaults).

### 8.2 Color Palette

All colors defined as CSS custom properties in `tailwind.css`.

| Token              | Value       | Usage                                      |
|--------------------|-------------|---------------------------------------------|
| `--primary`        | `#E67E22`   | Buttons, active nav, links, accents         |
| `--primary-hover`  | `#D4740A`   | Button hover, active states                 |
| `--primary-light`  | `#FDF2E6`   | Active nav background, light badges         |
| `--primary-dark`   | `#A85C12`   | Focused outlines, pressed states            |
| `--bg`             | `#F9FAFB`   | Page background                             |
| `--bg-card`        | `#FFFFFF`   | Card surfaces, panels                       |
| `--bg-sidebar`     | `#FFFFFF`   | Sidebar background                          |
| `--text`           | `#1F2937`   | Primary text                                |
| `--text-muted`     | `#6B7280`   | Secondary text, labels                      |
| `--text-light`     | `#9CA3AF`   | Placeholder, disabled text                  |
| `--border`         | `#E5E7EB`   | Default borders                             |
| `--border-dark`    | `#D1D5DB`   | Emphasized borders                          |
| `--success`        | `#16A34A`   | Success states                              |
| `--danger`         | `#DC2626`   | Destructive actions, errors                 |
| `--warning`        | `#F59E0B`   | Warnings                                    |
| `--info`           | `#3B82F6`   | Informational highlights                    |

### 8.3 Typography

- **Font family:** `'Inter', system-ui, -apple-system, sans-serif`
- **Headings:** Semi-bold (600), tracking tight
- **Body:** Regular (400), 14–16px depending on context
- **Small/labels:** Medium (500), 12px, uppercase where appropriate
- **Monospace (FEN, PGN):** `'JetBrains Mono', 'Fira Code', monospace`

### 8.4 Layout & Navigation

#### Left Sidebar

- **Width:** 220px (desktop), collapsible icon-only mode at 60px
- **Background:** White with a subtle right border
- **Logo:** "TreeChess" in Inter Bold, with a small orange tree icon
- **Nav items:**
  - Icon + label, vertically stacked
  - Active state: orange left border (3px) + `--primary-light` background + orange text
  - Hover: light gray background
  - Items: Dashboard, Repertoires, Games
- **User section:** Bottom of sidebar — avatar circle (initials), username, logout icon
- **Mobile:** Sidebar collapses to a bottom tab bar (3 icons)

#### Main Content Area

- `flex-1`, scrollable, `--bg` background
- Consistent padding: `p-6` on desktop, `p-4` on mobile
- Max content width: none (full width utilization for board + panels)

### 8.5 Component Design System

#### Buttons

| Variant     | Style                                                  |
|-------------|--------------------------------------------------------|
| Primary     | Orange bg (`--primary`), white text, rounded-md        |
| Secondary   | White bg, orange border, orange text                   |
| Ghost       | Transparent bg, gray text, hover: light gray bg        |
| Danger      | Red bg, white text (for destructive actions)           |
| Icon button | Ghost style with icon only, rounded-full, tooltip      |

All buttons: `font-medium`, consistent padding (`px-4 py-2` default), `transition-colors duration-150`.

#### Cards

- White background, `rounded-lg`, `border` (`--border`)
- `shadow-sm` default, `shadow-md` on hover (with transition)
- Consistent padding: `p-4` or `p-6`

#### Inputs

- White background, `rounded-md`, `border` (`--border`)
- Focus: orange ring (`ring-2 ring-primary/30`) + orange border
- Placeholder text: `--text-light`

#### Modals

- Centered overlay with semi-transparent dark backdrop
- White card, `rounded-xl`, `shadow-xl`
- Header with title + close button
- Footer with action buttons (primary right-aligned)
- Smooth fade-in animation

#### Toasts

- Bottom-right positioned
- Rounded, shadow, icon + message
- Color-coded left border (success=green, error=red, info=blue, warning=orange)
- Auto-dismiss with progress bar

#### Tabs

- Underline style: orange bottom border for active tab
- Text: `--text-muted` for inactive, `--primary` for active
- No background change, clean and minimal

### 8.6 Repertoire Tree — Dual View

#### SVG Tree View

- Node colors:
  - Main line nodes: orange fill
  - Alternative/variation nodes: light gray fill with orange border
  - Current position: bold orange ring
  - Transposition indicator: dashed purple
- Edge lines: gray, slightly rounded
- Background: subtle dot grid pattern (optional)
- Pan/zoom controls: minimal floating buttons in corner

#### Indented List View

- File-explorer style with collapsible sections
- Structure:
  ```
  ▼ 1. e4
    ▼ 1... e5
      ▼ 2. Nf3
        2... Nc6 (Main line)
        ▶ 2... d6 (Philidor)
    ▶ 1... c5 (Sicilian)
    ▶ 1... e6 (French)
  ```
- Chevron icons for expand/collapse
- Click a move to navigate the board
- Current position: orange background highlight
- Right-click context menu: delete, extract
- Depth indicators: subtle vertical lines connecting children

#### Toggle Switch

- Small icon toggle in the top-right of the tree panel
- Tree icon (graph) | List icon (lines)
- Persisted in localStorage

### 8.7 Animations & Transitions

- **Page transitions:** Subtle fade-in for route changes (`opacity 0 -> 1`, 150ms)
- **Cards:** Hover lift with shadow transition (200ms ease)
- **Sidebar:** Collapse/expand with width transition (200ms)
- **Modals:** Fade in backdrop + scale up card (150ms)
- **Toasts:** Slide in from right (200ms)
- **Tree nodes:** Subtle scale on hover (50ms)
- **Tab underline:** Slide transition (150ms)

Keep animations minimal and fast. No flashy effects.

### 8.8 Responsive Breakpoints

| Breakpoint | Layout changes                                           |
|------------|----------------------------------------------------------|
| `>= 1280px` (xl) | Full layout: sidebar (220px) + two-column content |
| `1024–1279px` (lg) | Sidebar collapses to icon-only (60px)           |
| `768–1023px` (md) | Single column content, sidebar as bottom tabs     |
| `< 768px` (sm) | Bottom tab bar, stacked panels, full-width board   |

---

## 9. Detailed User Journeys

### 9.1 Scenario 1: Initial Repertoire Creation

**Preconditions**: Empty application, first launch

1. User opens application (Dashboard)
2. Clicks [Edit] for the "White" repertoire
3. Board shows initial position
4. User plays e4 on the board
5. System asks: "Add e4 as first move?"
6. User validates
7. Tree displays new node "e4"
8. User returns to Dashboard and selects "Black"
9. Plays c5 and adds it to repertoire
10. Base repertoire is created

### 9.2 Scenario 2: PGN Import and Analysis

**Preconditions**: Existing repertoire, PGN file available

1. User clicks [📁 Import PGN]
2. Selects file `my_games.pgn`
3. File appears in Imports page
4. User clicks [Analyze]
5. Backend parses file (5 games detected)
6. For each game, backend compares with repertoire
7. Analysis page displays:
   - OK game (next move exists)
   - Games with errors (move out of repertoire)
   - Games with new lines (missing opponent move)

### 9.3 Scenario 3: Repertoire Enrichment via Analysis

**Preconditions**: Existing repertoire, analysis completed

1. In analysis page, user sees "Game 2 - Error: g4"
2. Clicks [Add g4]
3. Application navigates to edit page at relevant node
4. Board displays position with g4 played
5. User can add additional moves (response to g4)
6. Validates and returns to analysis

### 9.4 Scenario 4: Adding New Opponent Line

**Preconditions**: Existing repertoire, analysis completed

1. In analysis page, user sees "...a6 after 1.e4 c5 2.Nf3 d6"
2. Clicks [Add ...a6]
3. Application navigates to edit page at "...d6" node
4. Board displays position after ...a6
5. User plays their response (e.g., 4.Bb5+)
6. Validates and returns to analysis

### 9.5 Scenario 5: Branch Deletion

**Preconditions**: Existing repertoire with at least 2 nodes

1. User opens repertoire edit page
2. Navigates tree to node to delete
3. Right-clicks on node
4. Selects [Delete branch]
5. System confirms: "Delete this node and all its children?"
6. User confirms
7. Node and children are removed from tree

### 9.6 Scenario 6: Organizing with Categories

**Preconditions**: Multiple repertoires exist

1. User clicks "New Category" button
2. Enters name "Aggressive Lines" and selects color
3. Creates category
4. Drags repertoires into the category
5. Categories are displayed with collapsible sections
6. Repertoires are grouped by category in the list

### 9.7 Scenario 7: Importing from Lichess Study

**Preconditions**: User has a Lichess study URL

1. User clicks "Import from Lichess Study"
2. Pastes study URL
3. System fetches study metadata (chapters list)
4. User selects chapters 1, 3, and 5
5. Optionally chooses to merge into one repertoire
6. Optionally creates a category for the imports
7. Clicks Import
8. New repertoires created from selected chapters

---

## 10. Error Handling and Validation

### 10.1 PGN Parsing Errors

| Error          | Message                        | Action                        |
| -------------- | ------------------------------ | ----------------------------- |
| Empty file     | "File is empty"                | Invite to choose another file |
| Invalid format | "Invalid PGN format at line X" | Show format examples          |
| UTF-8 encoding | "Encoding error, use UTF-8"    | Auto-correct if possible      |
| No moves found | "File contains no games"       | Invite to verify file         |

### 10.2 Move Validation Errors

| Error            | Message                                | Action                    |
| ---------------- | -------------------------------------- | ------------------------- |
| Illegal move     | "This move is not legal"               | Block addition            |
| SAN ambiguity    | "Specify starting square (e.g., Nge2)" | Request complete notation |
| Invalid position | "Inconsistent position"                | Reload from FEN           |

### 10.3 Backend Errors

| Error         | Message                     | Action                         |
| ------------- | --------------------------- | ------------------------------ |
| DB connection | "Database connection error" | Retry with exponential backoff |
| Timeout       | "Operation timed out"       | Retry                          |
| Invalid JSON  | "Data corrupted"            | Rollback transaction           |

---

## 11. Interface Contracts

### 11.1 Naming Conventions

#### Database

| Entity           | Convention | Example     |
| ---------------- | ---------- | ----------- |
| Table names      | snake_case | repertoires |
| Column names     | snake_case | created_at  |
| UUID primary key | id         | id          |

#### API

| Entity      | Convention | Example                |
| ----------- | ---------- | ---------------------- |
| URL paths   | kebab-case | /api/repertoire/:color |
| JSON keys   | camelCase  | treeData               |
| Enum values | lowercase  | white, black           |

#### Frontend

| Entity     | Convention     | Example            |
| ---------- | -------------- | ------------------ |
| Files      | camelCase.ts   | repertoireStore.ts |
| Components | PascalCase.tsx | ChessBoard.tsx     |
| Interfaces | PascalCase     | RepertoireNode     |
| Variables  | camelCase      | whiteRepertoire    |

#### Backend

| Entity   | Convention    | Example               |
| -------- | ------------- | --------------------- |
| Files    | snake_case.go | repertoire_service.go |
| Packages | lowercase     | repository            |
| Structs  | PascalCase    | RepertoireNode        |
| Fields   | camelCase     | moveNumber            |

### 11.2 CORS Configuration

**Allowed Origins:** `http://localhost:5173` (development, configurable via `CORS_ALLOWED_ORIGINS`)

**Allowed Methods:** GET, POST, PUT, PATCH, DELETE

**Allowed Headers:** Origin, Content-Type, Accept, Authorization

### 11.3 Session Storage Keys

For cross-page navigation (e.g., PGN import to repertoire edit):

| Key              | Purpose                        | Format                                                |
| ---------------- | ------------------------------ | ----------------------------------------------------- |
| pendingAddNode   | Node to add after import       | `{"color":"white","parentId":"uuid","fen":"..."}`     |
| analysisNavigate | Navigate context from analysis | `{"color":"white","parentFEN":"...","moveSAN":"..."}` |

Both expire on page unload.

### 11.4 Transposition Policy

**For MVP, transpositions are NOT merged automatically.**

Each path through the tree is kept as-is. If the user adds:

- 1.e4 e5 2.Nf3 → creates path "e4 → e5 → Nf3"
- 1.Nf3 e5 2.e4 → creates separate path "Nf3 → e5 → e4"

Both paths lead to the same position but are stored as separate branches.

**Rationale:** Simpler implementation, matches user's actual game experience.

### 11.5 Promotion Handling

**Default Behavior:** When a promotion is encountered without explicit piece, default to Queen promotion (most common).

**Frontend Input:** When user plays a move to the 8th/1st rank:

- Show promotion dialog
- Allow user to choose Q, R, B, N
- Default to Queen if no choice made

**Storage:** Store full SAN with promotion (e8=Q, etc.)

---

## 12. Installation and Local Development

### 12.1 Prerequisites

- Go 1.25+
- PostgreSQL 17+
- Node.js 20+
- npm
- Docker and Docker Compose (optional)

### 12.2 Database Setup

```bash
# Create database
createdb treechess

# Apply migrations
psql -d treechess -f migrations/001_init.sql
```

### 12.3 Run Backend

**Without Docker (with hot reload):**

```bash
cd backend
go mod download
air
# Backend available at http://localhost:8080
```

**With Docker:** See section 12.6

### 12.4 Run Frontend

```bash
cd frontend
npm install
npm run dev
# Frontend available at http://localhost:5173
# Vite includes automatic Hot Module Replacement (HMR)
```

**With Docker:** See section 12.6

### 12.5 Environment Variables

See `.env.example` for a full template. Required variables:

```env
DATABASE_URL=postgres://treechess:password@localhost:5432/treechess?sslmode=disable
JWT_SECRET=your-random-secret
```

See section 19.3 for the complete environment variables reference.

### 12.6 Dockerization

**Prerequisites**: Docker and Docker Compose installed.

#### File Structure

```
treechess/
├── docker-compose.yml            # Dev orchestration
├── .env                          # Secrets (not in git)
├── .env.example                  # Template
├── backend/
│   ├── Dockerfile                # Multi-stage (dev + prod)
│   └── ...
└── frontend/
    ├── Dockerfile                # Multi-stage (dev + prod)
    └── ...
```

Both Dockerfiles have `dev` and `prod` stages. The `docker-compose.yml` targets `dev` for local development (hot reload via `air` for backend, Vite HMR for frontend).

For production builds: `docker build --target prod -t treechess-backend ./backend`

#### Docker Commands

```bash
# Start complete environment (build + run)
docker-compose up --build

# Start in background
docker-compose up -d

# Stop containers
docker-compose down

# Stop + delete PostgreSQL data
docker-compose down -v
```

#### Access URLs

- Frontend: <http://localhost:5173>
- Backend API: <http://localhost:8080>
- PostgreSQL: localhost:5432

---

## 13. Testing Strategy

### 13.1 Frontend Testing

**Framework**: Vitest (included with Vite)

```bash
# Run tests
npm run test

# CI mode (no watch)
npm run test:run

# Specific test
npx vitest run -t "test name"
```

**Coverage Target**: 50%

**Test Structure:**

```
src/
├── test/
│   └── setup.ts
└── shared/
    └── utils/
        └── chess.test.ts
```

### 13.2 Backend Testing

**Framework**: Go standard library + testify

```bash
# Run all tests
go test ./...

# Verbose output
go test -v ./internal/handlers/

# Specific test
go test -run "TestName" ./...

# Coverage
go test -coverprofile=coverage.out ./...
go tool cover -html=coverage.out -o coverage.html
```

**Coverage Target**: 50%

**Test Structure:**

```
internal/
├── handlers/
│   ├── repertoire_test.go
│   ├── auth_test.go
│   └── ...
├── services/
│   ├── repertoire_service_test.go
│   └── ...
├── repository/
│   └── mocks/
│       └── mocks.go
└── testhelpers/
    ├── testdb.go
    └── seeds.go
```

### 13.3 Integration Tests

- API + Database tests for core functionality
- PGN import workflow tests
- Repertoire CRUD operation tests

---

## 14. Logging

### 14.1 Log Format

All logs are structured JSON:

```json
{
  "timestamp": "2026-01-19T10:30:00Z",
  "level": "INFO",
  "message": "PGN file imported successfully",
  "service": "backend",
  "game_count": 5,
  "user_id": "uuid"
}
```

### 14.2 Log Levels

| Level | Usage                                       |
| ----- | ------------------------------------------- |
| DEBUG | Detailed debug information, variable values |
| INFO  | Normal operation events                     |
| ERROR | Errors that require attention               |
| WARN  | Warnings (non-blocking issues)              |

### 14.3 Output

- **Development**: stdout (captured by Docker)
- **Production**: stdout (container log aggregation)

### 14.4 Implementation (Go)

```go
package middleware

import (
    "encoding/json"
    "log"
    "time"
)

type LogEntry struct {
    Timestamp string `json:"timestamp"`
    Level     string `json:"level"`
    Message   string `json:"message"`
    Service   string `json:"service"`
}

func Log(level, message string, fields map[string]interface{}) {
    entry := LogEntry{
        Timestamp: time.Now().UTC().Format(time.RFC3339),
        Level:     level,
        Message:   message,
        Service:   "treechess",
    }

    // Merge fields into JSON
    entryJSON, _ := json.Marshal(entry)
    log.Println(string(entryJSON))
}
```

### 14.5 Implementation (React)

```typescript
// utils/logger.ts
type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  component?: string;
}

function log(level: LogLevel, message: string, component?: string): void {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    component,
  };
  console[level](JSON.stringify(entry));
}

export const logger = {
  debug: (msg: string, comp?: string) => log("debug", msg, comp),
  info: (msg: string, comp?: string) => log("info", msg, comp),
  warn: (msg: string, comp?: string) => log("warn", msg, comp),
  error: (msg: string, comp?: string) => log("error", msg, comp),
};
```

---

## 15. Database Migrations

### 15.1 Migration Strategy

Migrations are managed inline in `repository/db.go` via the `runMigrations()` function, which runs on application startup. The schema is idempotent (`CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`).

Legacy SQL migration files exist in the `migrations/` directory for reference:

```
migrations/
├── 001_init.sql                 # Initial schema (repertoires + analyses)
├── 002_username_analysis.sql    # Replace color with username in analyses
└── 003_multiple_repertoires.sql # Multiple repertoires per color, name column
```

### 15.2 Naming Convention

- Format: `NNN_description.sql` where NNN is a 3-digit sequential number
- All migrations must be forward-only (no down migrations for MVP)
- Each file contains DDL statements in order

### 15.3 Running Migrations

Migrations run automatically on application startup via `repository.NewDB()`. No manual migration step is needed.

For schema changes, add idempotent SQL to the `runMigrations()` function in `repository/db.go`.

---

## 16. Project README

### 16.1 README.md Template

The README should reflect the actual project structure:

```
treechess/
├── backend/              # Go backend (Echo + pgx)
├── frontend/             # React frontend (Vite + TypeScript)
├── migrations/           # PostgreSQL migrations (legacy, now inline)
├── docker-compose.yml    # Docker orchestration
├── .env.example          # Environment variables template
└── SPECIFICATIONS.md     # This document
```

Key commands:

```bash
# Docker (full stack)
docker-compose up --build

# Local development
cd backend && air          # Backend with hot reload
cd frontend && npm run dev # Frontend with HMR
```

Features:
- Multi-user authentication (local + Lichess OAuth)
- Create and edit opening repertoires (up to 50 per user)
- Organize repertoires into categories
- Import games from PGN files, Lichess, Chess.com, or Lichess Studies
- Analyze games against repertoire trees
- GitHub-style tree visualization
- Stockfish engine analysis (WebAssembly)
- Auto-sync from Lichess/Chess.com
- Opening insights with mistake detection

---

## 17. Glossary

### Chess Terms

| Term | Definition |
|------|------------|
| **FEN** | Forsyth-Edwards Notation - Standard notation describing a chess position in one line. Format: `<piece placement>/<active color>/<castling>/<en passant>/<halfmove>/<fullmove>` |
| **SAN** | Standard Algebraic Notation - Move notation (e.g., e4, Nf3, O-O, exd5, e8=Q) |
| **Ply** | A half-move (one player's turn). A full move = 2 plies |
| **ECO** | Encyclopedia of Chess Openings - Classification system (A00-E99) |

### Project-Specific Terms

| Term | Definition |
|------|------------|
| **Repertoire** | A tree of opening lines the player wants to learn |
| **Category** | A named grouping of repertoires (e.g., "White Openings") |
| **Node** | A position in the tree after a specific move |
| **Branch** | A path from root to a specific node (sequence of moves) |
| **Divergence** | A point where a game deviates from the known repertoire |
| **In-repertoire** | A move that exists in the user's tree |
| **Out-of-repertoire** | User's move that doesn't exist in their tree |
| **New line** | Opponent's move not covered in the tree |
| **Analysis** | Comparison of imported games against the repertoire |
| **Insight** | Opening mistake detected through engine analysis |

---

## 18. Change Log

| Version | Date | Author | Description |
|---------|------|--------|-------------|
| 1.0 | 2026-01-19 | - | Initial document |
| 2.0 | 2026-01-19 | - | PostgreSQL, single-user MVP, multi-user V2 |
| 3.0 | 2026-01-19 | - | Full English translation, added tests, logging, migrations, README sections |
| 4.0 | 2026-01-21 | - | Consolidated specs/ folder content, removed roadmap, added interface contracts and glossary |
| 5.0 | 2026-01-28 | - | Updated REST API to plural routes, multiple repertoires per color, added Games API |
| 6.0 | 2026-01-29 | - | Added YouTube video import feature (REQ-070 to REQ-078): video_imports/video_positions tables, SSE progress, tree builder, video search, preview page |
| 7.0 | 2026-01-29 | - | Migrated video recognition from Python OpenCV to native Go (GoCV). Added `internal/recognition/` package. Removed Python/script dependencies. Updated architecture diagram. |
| 8.0 | 2026-01-30 | - | Added security hardening section (18). Rate limiting, security headers, input validation, generic errors, multi-stage Dockerfiles, configurable OAuth callback. |
| 9.0 | 2026-02-04 | - | Added missing features: Categories (REQ-005), Merge/Extract (REQ-006/007), Lichess Study Import (REQ-015/016), Opening Insights (REQ-060-062). Merged UI Design System from UI_REDESIGN_PLAN.md. Updated database schema with categories, engine_evals, dismissed_mistakes tables. Removed video import features (no longer in codebase). |

---

## 19. Production Security Checklist

This section lists security items that **must be addressed before production deployment**. Items marked with `[DEV]` have already been implemented for development. Items marked with `[PROD]` require production infrastructure.

### 19.1 Already Implemented [DEV]

| Item | Description | Files |
|------|-------------|-------|
| Rate limiting (global) | 100 req/min per IP, burst 20 | `main.go` |
| Rate limiting (auth) | 10 req/min per IP on login/register | `main.go` |
| Security headers | X-Content-Type-Options, X-Frame-Options, Referrer-Policy, X-XSS-Protection | `main.go` |
| Body size limit | Global 10MB limit on request bodies | `main.go` |
| Username validation | Regex validation on Lichess/Chess.com usernames | `internal/handlers/import.go` |
| Generic error messages | Internal errors logged server-side, generic messages to clients | `internal/handlers/import.go` |
| Configurable OAuth callback | `OAUTH_CALLBACK_URL` env var replaces hardcoded localhost | `config/config.go`, `main.go` |
| Secure cookie flag | `SECURE_COOKIES` env var controls Secure flag on OAuth cookies | `config/config.go`, `internal/handlers/oauth.go` |
| `.env` excluded from git | `.gitignore` prevents secret leaks, `.env.example` provided | `.gitignore`, `.env.example` |
| Multi-stage Dockerfiles | Dev and prod stages separated; prod runs as non-root user | `backend/Dockerfile`, `frontend/Dockerfile` |

### 19.2 Required for Production [PROD]

#### Authentication & Token Security

- [ ] **Migrate JWT from localStorage to httpOnly cookies**: The frontend stores JWT tokens in `localStorage` which is vulnerable to XSS. Move to `httpOnly` + `Secure` cookies set by the backend on login/OAuth callback. This impacts `authStore.ts`, `api.ts`, and all backend auth endpoints.
- [ ] **Remove token from OAuth redirect query parameter**: Currently `oauth.go:111` passes the token via `?token=`. Use a short-lived authorization code or set the token as a cookie in the callback response instead.
- [ ] **Implement refresh token rotation**: Current JWT has a fixed 7-day expiry with no refresh. Add a refresh token endpoint to allow shorter-lived access tokens (e.g., 15 min) with automatic refresh.
- [ ] **Add CSRF protection**: Add CSRF token middleware on state-changing endpoints (POST/PUT/PATCH/DELETE). Required once authentication moves to cookies.

#### Transport Security

- [ ] **Deploy behind HTTPS reverse proxy**: Use Caddy (automatic HTTPS) or nginx + Let's Encrypt. All traffic must be encrypted.
- [ ] **Enable HSTS header**: Add `Strict-Transport-Security: max-age=31536000; includeSubDomains` once HTTPS is confirmed working.
- [ ] **Set `SECURE_COOKIES=true`**: Enable the Secure flag on all cookies in production.
- [ ] **Enable database SSL**: Change `sslmode=disable` to `sslmode=require` (or `verify-full` with certificates) in `DATABASE_URL`.

#### Infrastructure

- [ ] **Rotate all secrets**: Generate new `JWT_SECRET` and `POSTGRES_PASSWORD` for production. The development values in `.env` must never be reused.
- [ ] **Use external secrets management**: Move secrets out of `.env` files into a secrets manager (HashiCorp Vault, AWS Secrets Manager, or equivalent).
- [ ] **Configure database connection pool**: Set explicit `MaxConns`, `MinConns`, `MaxConnLifetime` in `repository/db.go` via `pgxpool.ParseConfig`.
- [ ] **Add Content-Security-Policy header**: Define a strict CSP to prevent XSS: `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'`.
- [ ] **Use production Docker target**: Build with `docker build --target prod` and ensure `docker-compose.prod.yml` targets the `prod` stage.
- [ ] **Set up health check monitoring**: Add external health check on `/api/health` with alerting.
- [ ] **Add structured logging**: Replace `log.Printf` with structured JSON logging for log aggregation (ELK, Datadog).

#### OAuth Key Derivation

- [ ] **Improve AES key derivation for OAuth cookies**: Replace `copy(key, []byte(jwtSecret))` in `oauth.go` with HKDF (RFC 5869) to properly derive a 32-byte encryption key from the JWT secret. Use `golang.org/x/crypto/hkdf` with a dedicated salt.

### 19.3 Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | - | PostgreSQL connection string |
| `JWT_SECRET` | Yes | - | Secret key for JWT signing |
| `JWT_EXPIRY_HOURS` | No | `168` | JWT token expiry in hours |
| `PORT` | No | `8080` | Backend server port |
| `FRONTEND_URL` | No | `http://localhost:5173` | Frontend URL for redirects |
| `CORS_ALLOWED_ORIGINS` | No | `http://localhost:5173` | Comma-separated allowed origins |
| `LICHESS_CLIENT_ID` | No | - | Lichess OAuth client ID |
| `OAUTH_CALLBACK_URL` | No | `http://localhost:{PORT}/api/auth/lichess/callback` | OAuth callback URL |
| `SECURE_COOKIES` | No | `false` | Set `true` in production (HTTPS) |

---

*Document generated for TreeChess - Chess opening training web app*
