# TreeChess - Technical and Functional Specifications

**Version:** 8.0
**Date:** January 30, 2026
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
- **Import sources**: PGN file upload, Lichess API, Chess.com API
- **Sync**: Automatic sync of recent games from Lichess/Chess.com
- **Analysis**: Game-by-game comparison against repertoire trees
- **Engine**: Stockfish WebAssembly for position evaluation
- **Repertoire templates**: Pre-built opening trees (Sicilian, Italian, etc.)

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
- Comments on positions
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

### 3.3 Repertoire Comparison

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

### 3.4 Repertoire Enrichment

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

### 3.5 Tree Visualization

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

### 3.6 Stockfish Engine Analysis

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

### 3.7 Review Mode (V2)

**Note**: This feature is deferred to V2.

#### REQ-060: Branch Visualization

The user selects a node and accesses a dedicated view displaying:

- A board with the current position
- The move sequence from root node to selected node
- Previous/Next navigation to browse the sequence

#### REQ-061: Active Review

In review mode, the user can:

- Replay moves by playing them on the board
- Receive immediate feedback on wrong move
- Return to branch start

#### REQ-062: Position + Notation Display

ALWAYS display simultaneously:

- Board diagram with pieces
- SAN move notation in text format

---

### 3.8 Game Sync

#### REQ-070: Automatic Game Sync

Users can link their Lichess and/or Chess.com usernames via their profile (`PUT /api/auth/profile`). The sync endpoint (`POST /api/sync`) fetches recent games from both platforms and imports them automatically.

#### REQ-071: Sync Behavior

- Only fetches games played since the last sync (tracked per platform via `last_lichess_sync_at` / `last_chesscom_sync_at`)
- Imported games are parsed and analyzed against the user's repertoires
- Errors on one platform do not block the other
- Returns a `SyncResult` with counts of imported games and any errors

#### REQ-072: Platform Usernames

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

-- Repertoires table (multiple per user, up to 50)
CREATE TABLE repertoires (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
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

-- Analyses table
CREATE TABLE analyses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    username VARCHAR(255) NOT NULL,
    filename VARCHAR(255) NOT NULL,
    game_count INTEGER NOT NULL,
    results JSONB NOT NULL,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Performance indexes
CREATE INDEX idx_repertoires_user_id ON repertoires(user_id);
CREATE INDEX idx_repertoires_color ON repertoires(color);
CREATE INDEX idx_repertoires_updated ON repertoires(updated_at DESC);
CREATE INDEX idx_repertoires_name ON repertoires(name);
CREATE INDEX idx_analyses_user_id ON analyses(user_id);
CREATE INDEX idx_analyses_username ON analyses(username);
CREATE INDEX idx_analyses_uploaded ON analyses(uploaded_at DESC);
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
│   │   ├── import.go                # PGN upload, Lichess/Chess.com import
│   │   └── sync.go                  # Game sync handler
│   ├── services/
│   │   ├── auth_service.go          # Registration, login, JWT generation
│   │   ├── oauth_service.go         # Lichess OAuth flow (PKCE)
│   │   ├── repertoire_service.go    # Repertoire CRUD + tree operations
│   │   ├── repertoire_templates.go  # Pre-built opening templates
│   │   ├── import_service.go        # PGN parsing + repertoire analysis
│   │   ├── lichess_service.go       # Lichess API client
│   │   ├── chesscom_service.go      # Chess.com API client
│   │   └── sync_service.go          # Game sync orchestration
│   ├── repository/
│   │   ├── interfaces.go            # Repository interfaces
│   │   ├── db.go                    # Connection pool + inline migrations
│   │   ├── errors.go                # Sentinel errors
│   │   ├── user_repo.go             # User CRUD, OAuth, profile, sync timestamps
│   │   ├── repertoire_repo.go       # Repertoire CRUD, ownership checks
│   │   ├── import_repo.go           # Analysis CRUD, games, ownership
│   │   └── mocks/mocks.go          # Mock implementations for testing
│   ├── models/
│   │   ├── user.go                  # User, AuthResponse, SyncResult
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

# Protected - Repertoire CRUD
GET    /api/repertoires/templates            # List opening templates
POST   /api/repertoires/seed                 # Create repertoire from template
GET    /api/repertoires                      # List user's repertoires
POST   /api/repertoires                      # Create new repertoire
GET    /api/repertoires/:id                  # Get repertoire by ID
PATCH  /api/repertoires/:id                  # Update repertoire (rename)
DELETE /api/repertoires/:id                  # Delete repertoire
POST   /api/repertoires/:id/nodes            # Add node to repertoire
DELETE /api/repertoires/:id/nodes/:nodeId    # Delete node from repertoire

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

# Protected - Sync
POST   /api/sync                             # Sync games from Lichess/Chess.com
```

### 5.4 Frontend Architecture

Feature-based structure:

```
frontend/src/
├── App.tsx                           # React Router
├── main.tsx                          # Entry point
├── index.css                         # Global styles
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
│   │   ├── Dashboard.tsx             # Home page
│   │   └── components/               # QuickActions, RecentGames, RepertoireOverview, TemplatePicker
│   ├── repertoire/
│   │   ├── RepertoireTab.tsx         # Repertoire list view
│   │   ├── RepertoireEdit.tsx        # Repertoire editor (main page)
│   │   ├── edit/
│   │   │   ├── components/           # BoardSection, AddMoveModal, DeleteModal, TopMovesPanel
│   │   │   ├── hooks/               # useEngine, useMoveActions, usePendingAddNode, useRepertoireLoader
│   │   │   └── utils/               # constants, nodeUtils
│   │   └── shared/
│   │       ├── components/           # RepertoireCard, RepertoireSelector, MoveHistory, RepertoireTree/
│   │       └── hooks/               # useRepertoires
│   ├── game-analysis/
│   │   ├── GameAnalysisPage.tsx      # Single game analysis
│   │   ├── components/               # GameBoardSection, GameMoveList, GameNavigation
│   │   └── hooks/                   # useChessNavigation, useFENComputed, useGameLoader
│   ├── analyse-tab/
│   │   ├── AnalyseTab.tsx            # Import/analysis tab
│   │   ├── components/               # GamesList, AnalysesList, ImportSection, PGN/FileUploader
│   │   └── hooks/                   # useGames, useAnalyses, useFileUpload, useChesscomImport, useLichessImport
│   ├── analyse-import/
│   │   ├── ImportDetail.tsx          # Analysis results detail
│   │   ├── components/               # GameSection
│   │   └── hooks/                   # useAnalysisLoader, useAddToRepertoire
│   └── games/
│       ├── GamesPage.tsx             # Games management
│       └── components/               # ImportPanel
```

### 5.5 Stockfish Integration Architecture

Frontend architecture for Stockfish integration:

```text
src/
├── services/
│   ├── api.ts                    # REST API calls
│   └── stockfish.ts              # Stockfish UCI service
├── features/repertoire/
│   ├── edit/
│   │   ├── components/
│   │   │   ├── BoardSection.tsx        # Displays board with score indicator
│   │   │   ├── AddMoveModal.tsx        # Modal with top suggestions
│   │   │   └── TopMovesPanel.tsx       # Panel showing top 3 moves
│   │   ├── hooks/
│   │   │   └── useEngine.ts           # Engine lifecycle management
│   │   └── RepertoireEdit.tsx          # Main edit page with engine
│   └── shared/
│       └── components/
│           └── RepertoireTree.tsx       # [No engine integration]
├── shared/components/Board/
│   └── ChessBoard.tsx                  # Extended for best move highlighting
├── stores/
│   ├── repertoireStore.ts
│   └── engineStore.ts                  # Engine state (Zustand)
└── types/
    └── index.ts                        # EngineEvaluation, TopMove, etc.
```

#### 5.5.1 Stockfish Service (`services/stockfish.ts`)

Singleton service that manages Stockfish Web Worker communication:

```typescript
class StockfishService {
  private worker: Worker | null = null;
  private currentDepth = 12;

  // Initialize Stockfish Web Worker
  initialize(): void {
    this.worker = Stockfish();
    this.worker.onmessage = this.handleMessage.bind(this);
    this.worker.postMessage("uci");
    this.worker.postMessage("isready");
  }

  // Analyze position with FEN string
  analyzePosition(fen: string, depth: number = 12): void {
    if (!this.worker) return;
    this.currentDepth = depth;
    this.worker.postMessage("ucinewgame");
    this.worker.postMessage(`position fen ${fen}`);
    this.worker.postMessage(`go depth ${depth}`);
  }

  // Stop current analysis
  stop(): void {
    this.worker?.postMessage("stop");
  }

  // Parse UCI info lines
  private parseInfoLine(line: string): UCIInfo | null {
    // Extract depth, scorecp/scoremate, bestmove, pv
    // Returns structured UCIInfo
  }

  // Handle worker messages
  private handleMessage(event: MessageEvent): void {
    const line = event.data;
    if (line.startsWith("info depth")) {
      const info = this.parseInfoLine(line);
      if (info && info.depth >= this.currentDepth) {
        this.onEvaluation?.(this.buildEvaluation(info, line));
      }
    } else if (line.startsWith("bestmove")) {
      const parts = line.split(" ");
      if (parts[1]) {
        const from = parts[1].slice(0, 2);
        const to = parts[1].slice(2, 4);
        this.onBestMove?.({ from, to });
      }
    }
  }
}
```

#### 5.5.2 Engine Store (`stores/engineStore.ts`)

Zustand store for engine state across components:

```typescript
import { create } from "zustand";

interface EngineState {
  isAnalyzing: boolean;
  currentEvaluation: EngineEvaluation | null;
  currentFEN: string;
  error: string | null;

  analyze: (fen: string) => void;
  stop: () => void;
  setEvaluation: (evaluation: EngineEvaluation) => void;
  setError: (error: string) => void;
  reset: () => void;
}

export const useEngineStore = create<EngineState>((set) => ({
  isAnalyzing: false,
  currentEvaluation: null,
  currentFEN: "",
  error: null,

  analyze: (fen: string) => {
    set({ isAnalyzing: true, currentFEN: fen, error: null });
    stockfishService.analyzePosition(fen);
  },

  stop: () => {
    stockfishService.stop();
    set({ isAnalyzing: false });
  },

  setEvaluation: (evaluation: EngineEvaluation) => {
    set({ currentEvaluation: evaluation, isAnalyzing: false });
  },

  setError: (error: string) => {
    set({ error, isAnalyzing: false });
  },

  reset: () => {
    stockfishService.stop();
    set({
      isAnalyzing: false,
      currentEvaluation: null,
      currentFEN: "",
      error: null,
    });
  },
}));
```

#### 5.5.3 RepertoireEdit Integration

Engine initialization and position-changed analysis:

```typescript
useEffect(() => {
  stockfishService.initialize();

  stockfishService.onEvaluation = (evaluation) => {
    useEngineStore.getState().setEvaluation(evaluation);
  };

  stockfishService.onBestMove = (move) => {
    const { currentEvaluation } = useEngineStore.getState();
    if (currentEvaluation) {
      useEngineStore.getState().setEvaluation({
        ...currentEvaluation,
        bestMoveFrom: move.from,
        bestMoveTo: move.to,
      });
    }
  };

  return () => {
    stockfishService.stop();
    stockfishService.terminate();
  };
}, []);

// Analyze after position changes
useEffect(() => {
  if (currentFEN && selectedNode) {
    useEngineStore.getState().analyze(currentFEN);
  }
}, [currentFEN]);
```

#### 5.5.4 BoardSection with Score Indicator

```typescript
function BoardSection({ currentEvaluation, isAnalyzing }: Props) {
  const getScoreDisplay = () => {
    if (isAnalyzing) return 'Analyzing...';
    if (!currentEvaluation) return null;
    if (currentEvaluation.mate) return `Mate in ${currentEvaluation.mate}`;
    return `+${(currentEvaluation.score / 100).toFixed(1)}`;
  };

  const scoreColor = () => {
    if (!currentEvaluation || currentEvaluation.score > -50) return '#4caf50';
    return '#f44336';
  };

  return (
    <div className="repertoire-edit-board">
      <div className="panel-header">
        <h2>Position</h2>
      </div>

      {getScoreDisplay() && (
        <div className="score-indicator" style={{ color: scoreColor() }}>
          {getScoreDisplay()}
        </div>
      )}

      <ChessBoard
        fen={currentFEN}
        bestMoveFrom={currentEvaluation?.bestMoveFrom}
        bestMoveTo={currentEvaluation?.bestMoveTo}
        // ... other props
      />
    </div>
  );
}
```

#### 5.5.5 TopMovesPanel Component

```typescript
function TopMovesPanel({ evaluation }: Props) {
  if (!evaluation || evaluation.pv.length === 0) return null;

  const topMoves: TopMove[] = evaluation.pv.slice(0, 3).map((uciMove, index) => ({
    san: uciToSAN(uciMove, evaluation.currentFEN),
    score: index === 0 ? evaluation.score : evaluation.score - index * 20,
    depth: evaluation.depth
  }));

  return (
    <div className="top-moves-panel">
      <h3>Top Moves (depth {evaluation.depth})</h3>
      <ul className="top-moves-list">
        {topMoves.map((move, index) => (
          <li key={index}>
            <span className="move-san">{index + 1}. {move.san}</span>
            <span className="move-score">{formatScore(move.score)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

#### 5.5.6 AddMoveModal with Suggestions

```typescript
function AddMoveModal({ evaluation }: Props) {
  const suggestedMove = evaluation?.bestMove;

  return (
    <Modal isOpen={isOpen}>
      {suggestedMove && (
        <div className="stockfish-suggestion">
          Stockfish suggests: <strong>{suggestedMove}</strong>
          {evaluation.score && (
            <span className="suggestion-score">
              ({formatScore(evaluation.score)}, depth {evaluation.depth})
            </span>
          )}
        </div>
      )}
      <div className="add-move-form">
        {/* ... move input ... */}
      </div>
    </Modal>
  );
}
```

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

### 7.2 Repertoires Page (List)

```
┌─────────────────────────────────────────────────────────────────┐
│  Repertoires                                                    │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  ♔ White                                                   ││
│  │  [Edit]                                                    ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  ♚ Black                                                   ││
│  │  [Edit]                                                    ││
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

## 8. Detailed User Journeys

### 8.1 Scenario 1: Initial Repertoire Creation

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

### 8.2 Scenario 2: PGN Import and Analysis

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

### 8.3 Scenario 3: Repertoire Enrichment via Analysis

**Preconditions**: Existing repertoire, analysis completed

1. In analysis page, user sees "Game 2 - Error: g4"
2. Clicks [Add g4]
3. Application navigates to edit page at relevant node
4. Board displays position with g4 played
5. User can add additional moves (response to g4)
6. Validates and returns to analysis

### 8.4 Scenario 4: Adding New Opponent Line

**Preconditions**: Existing repertoire, analysis completed

1. In analysis page, user sees "...a6 after 1.e4 c5 2.Nf3 d6"
2. Clicks [Add ...a6]
3. Application navigates to edit page at "...d6" node
4. Board displays position after ...a6
5. User plays their response (e.g., 4.Bb5+)
6. Validates and returns to analysis

### 8.5 Scenario 5: Branch Deletion

**Preconditions**: Existing repertoire with at least 2 nodes

1. User opens repertoire edit page
2. Navigates tree to node to delete
3. Right-clicks on node
4. Selects [Delete branch]
5. System confirms: "Delete this node and all its children?"
6. User confirms
7. Node and children are removed from tree

---

## 9. Error Handling and Validation

### 9.1 PGN Parsing Errors

| Error          | Message                        | Action                        |
| -------------- | ------------------------------ | ----------------------------- |
| Empty file     | "File is empty"                | Invite to choose another file |
| Invalid format | "Invalid PGN format at line X" | Show format examples          |
| UTF-8 encoding | "Encoding error, use UTF-8"    | Auto-correct if possible      |
| No moves found | "File contains no games"       | Invite to verify file         |

### 9.2 Move Validation Errors

| Error            | Message                                | Action                    |
| ---------------- | -------------------------------------- | ------------------------- |
| Illegal move     | "This move is not legal"               | Block addition            |
| SAN ambiguity    | "Specify starting square (e.g., Nge2)" | Request complete notation |
| Invalid position | "Inconsistent position"                | Reload from FEN           |

### 9.3 Backend Errors

| Error         | Message                     | Action                         |
| ------------- | --------------------------- | ------------------------------ |
| DB connection | "Database connection error" | Retry with exponential backoff |
| Timeout       | "Operation timed out"       | Retry                          |
| Invalid JSON  | "Data corrupted"            | Rollback transaction           |

---

## 10. Interface Contracts

### 10.1 Naming Conventions

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

### 10.2 CORS Configuration

**Allowed Origins:** `http://localhost:5173` (development, configurable via `CORS_ALLOWED_ORIGINS`)

**Allowed Methods:** GET, POST, PUT, PATCH, DELETE

**Allowed Headers:** Origin, Content-Type, Accept, Authorization

### 10.3 Session Storage Keys

For cross-page navigation (e.g., PGN import to repertoire edit):

| Key              | Purpose                        | Format                                                |
| ---------------- | ------------------------------ | ----------------------------------------------------- |
| pendingAddNode   | Node to add after import       | `{"color":"white","parentId":"uuid","fen":"..."}`     |
| analysisNavigate | Navigate context from analysis | `{"color":"white","parentFEN":"...","moveSAN":"..."}` |

Both expire on page unload.

### 10.4 Transposition Policy

**For MVP, transpositions are NOT merged automatically.**

Each path through the tree is kept as-is. If the user adds:

- 1.e4 e5 2.Nf3 → creates path "e4 → e5 → Nf3"
- 1.Nf3 e5 2.e4 → creates separate path "Nf3 → e5 → e4"

Both paths lead to the same position but are stored as separate branches.

**Rationale:** Simpler implementation, matches user's actual game experience.

### 10.5 Promotion Handling

**Default Behavior:** When a promotion is encountered without explicit piece, default to Queen promotion (most common).

**Frontend Input:** When user plays a move to the 8th/1st rank:

- Show promotion dialog
- Allow user to choose Q, R, B, N
- Default to Queen if no choice made

**Storage:** Store full SAN with promotion (e8=Q, etc.)

---

## 11. Installation and Local Development

### 11.1 Prerequisites

- Go 1.25+
- PostgreSQL 17+
- Node.js 20+
- npm
- Docker and Docker Compose (optional)

### 11.2 Database Setup

```bash
# Create database
createdb treechess

# Apply migrations
psql -d treechess -f migrations/001_init.sql
```

### 11.3 Run Backend

**Without Docker (with hot reload):**

```bash
cd backend
go mod download
air
# Backend available at http://localhost:8080
```

**With Docker:** See section 11.6

### 11.4 Run Frontend

```bash
cd frontend
npm install
npm run dev
# Frontend available at http://localhost:5173
# Vite includes automatic Hot Module Replacement (HMR)
```

**With Docker:** See section 11.6

### 11.5 Environment Variables

See `.env.example` for a full template. Required variables:

```env
DATABASE_URL=postgres://treechess:password@localhost:5432/treechess?sslmode=disable
JWT_SECRET=your-random-secret
```

See section 18.3 for the complete environment variables reference.

### 11.6 Dockerization

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

## 12. Testing Strategy

### 12.1 Frontend Testing

**Framework**: Vitest (included with Vite)

```bash
# Run tests
npm run test

# CI mode (no watch)
npm run test -- --run

# Specific test
npm run test -- --grep "repertoire"
```

**Coverage Target**: 50%

**Test Structure:**

```
src/
├── __tests__/
│   ├── components/
│   │   ├── ChessBoard.test.tsx
│   │   └── RepertoireTree.test.tsx
│   ├── hooks/
│   │   └── useRepertoire.test.ts
│   └── services/
│       └── api.test.ts
```

### 12.2 Backend Testing

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
│   └── pgn_test.go
├── services/
│   ├── repertoire_service_test.go
│   └── pgn_parser_test.go
└── repository/
    └── repertoire_repo_test.go
```

### 12.3 Integration Tests

- API + Database tests for core functionality
- PGN import workflow tests
- Repertoire CRUD operation tests

---

## 13. Logging

### 13.1 Log Format

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

### 13.2 Log Levels

| Level | Usage                                       |
| ----- | ------------------------------------------- |
| DEBUG | Detailed debug information, variable values |
| INFO  | Normal operation events                     |
| ERROR | Errors that require attention               |
| WARN  | Warnings (non-blocking issues)              |

### 13.3 Output

- **Development**: stdout (captured by Docker)
- **Production**: stdout (container log aggregation)

### 13.4 Implementation (Go)

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

### 13.5 Implementation (React)

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

## 14. Database Migrations

### 14.1 Migration Strategy

Migrations are managed inline in `repository/db.go` via the `runMigrations()` function, which runs on application startup. The schema is idempotent (`CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`).

Legacy SQL migration files exist in the `migrations/` directory for reference:

```
migrations/
├── 001_init.sql                 # Initial schema (repertoires + analyses)
├── 002_username_analysis.sql    # Replace color with username in analyses
└── 003_multiple_repertoires.sql # Multiple repertoires per color, name column
```

### 14.2 Naming Convention

- Format: `NNN_description.sql` where NNN is a 3-digit sequential number
- All migrations must be forward-only (no down migrations for MVP)
- Each file contains DDL statements in order

### 14.3 Running Migrations

Migrations run automatically on application startup via `repository.NewDB()`. No manual migration step is needed.

For schema changes, add idempotent SQL to the `runMigrations()` function in `repository/db.go`.

---

## 15. Project README

### 15.1 README.md Template

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
- Import games from PGN files, Lichess, or Chess.com
- Analyze games against repertoire trees
- GitHub-style tree visualization
- Stockfish engine analysis (WebAssembly)
- Auto-sync from Lichess/Chess.com

---

## 16. Glossary

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
| **Node** | A position in the tree after a specific move |
| **Branch** | A path from root to a specific node (sequence of moves) |
| **Divergence** | A point where a game deviates from the known repertoire |
| **In-repertoire** | A move that exists in the user's tree |
| **Out-of-repertoire** | User's move that doesn't exist in their tree |
| **New line** | Opponent's move not covered in the tree |
| **Analysis** | Comparison of imported games against the repertoire |

---

## 17. Change Log

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

---

## 18. Production Security Checklist

This section lists security items that **must be addressed before production deployment**. Items marked with `[DEV]` have already been implemented for development. Items marked with `[PROD]` require production infrastructure.

### 18.1 Already Implemented [DEV]

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

### 18.2 Required for Production [PROD]

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

### 18.3 Environment Variables Reference

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
