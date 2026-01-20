# TreeChess - Technical and Functional Specifications

**Version:** 3.0  
**Date:** January 19, 2026  
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

### 2.1 MVP Objectives (Version 1.0) - Local Development

Enable a single user to create and visualize two repertoire trees (White and Black) by importing PGN files, with the ability to manually add new branches during divergences.

**MVP Tech Stack:**
- Frontend: React 18 + TypeScript
- Backend: Go
- Database: PostgreSQL (local dev)
- No authentication
- No production deployment

### 2.2 V2 Objectives (Version 2.0) - Production

- Authentication via OAuth Lichess (users already have Lichess accounts)
- Direct import from Lichess API
- Multi-user support
- Production deployment

### 2.3 Features Deferred to V2

- Training mode with quiz and spaced repetition
- Chess.com API import
- Multiple repertoires per color
- Main line vs sideline visualization
- Repertoire PGN export
- Progress statistics
- Comments/Videos on positions

---

## 3. Functional Specifications

### 3.1 Repertoire Management

#### REQ-001: Initial Repertoire Creation
On first application startup, the API automatically creates two empty repertoires:
- A "White" repertoire with the initial position (fen: rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -)
- A "Black" repertoire with the initial position

#### REQ-002: Active Repertoire Selection
The user can switch between White and Black repertoires via a selector. The displayed tree corresponds to the selected repertoire.

#### REQ-003: Data Persistence (PostgreSQL)
Data is stored in a PostgreSQL database. Schema:

```sql
CREATE TABLE repertoires (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    color VARCHAR(5) NOT NULL CHECK (color IN ('white', 'black')),
    tree_data JSONB NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{"totalNodes": 0, "totalMoves": 0, "deepestDepth": 0}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_repertoires_color ON repertoires(color);
```

#### REQ-004: Single Repertoire per Color
For MVP, one White and one Black repertoire per installation. Multi-repertoire support deferred to V2.

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

| Case | Condition | Action |
|------|-----------|--------|
| A | User's move exists in tree | Mark as "OK" |
| B | User's move doesn't exist | Mark as "Error - out of repertoire" |
| C | Opponent's move doesn't exist in tree | Mark as "New line possible" |

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

### 3.6 Review Mode (V2)

**Note**: This feature is deferred to V2.

#### REQ-050: Branch Visualization
The user selects a node and accesses a dedicated view displaying:
- A board with the current position
- The move sequence from root node to selected node
- Previous/Next navigation to browse the sequence

#### REQ-051: Active Review
In review mode, the user can:
- Replay moves by playing them on the board
- Receive immediate feedback on wrong move
- Return to branch start

#### REQ-052: Position + Notation Display
ALWAYS display simultaneously:
- Board diagram with pieces
- SAN move notation in text format

---

## 4. Data Model

### 4.1 Tree Structure (PostgreSQL JSONB)

```typescript
type Color = 'w' | 'b';
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

```sql
-- Main repertoires table
CREATE TABLE repertoires (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    color VARCHAR(5) NOT NULL CHECK (color IN ('white', 'black')),
    tree_data JSONB NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{"totalNodes": 0, "totalMoves": 0, "deepestDepth": 0}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT one_repertoire_per_color UNIQUE (color)
);

-- Performance indexes
CREATE INDEX idx_repertoires_color ON repertoires(color);
CREATE INDEX idx_repertoires_updated ON repertoires(updated_at DESC);
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
  status: 'in-repertoire' | 'out-of-repertoire' | 'opponent-new';
  expectedMove?: string;
  isUserMove: boolean;
}
```

---

## 5. Technical Architecture

### 5.1 MVP Tech Stack

| Layer | Technology | Reason |
|-------|------------|--------|
| Frontend | React 18 + TypeScript | Components, strict typing |
| State Management | Zustand | Lightweight |
| Chess | chess.js | Move validation, FEN, SAN |
| Visualization | D3.js or React Flow | Interactive GitHub-style tree |
| Backend | Go + Echo | Performant REST API |
| Database | PostgreSQL | Structured data, native JSONB |
| DB Driver | pgx | Native PostgreSQL driver for Go |
| Frontend Build | Vite | Fast dev server |

### 5.2 Backend Architecture (Go)

```
cmd/server/
├── main.go                          # Entry point
├── config/
│   └── config.go                    # Configuration (DB, port)
├── internal/
│   ├── handlers/
│   │   ├── repertoire.go            # CRUD repertoires
  │   │   └── import.go                  # Import + Analysis
│   ├── services/
│   │   ├── repertoire_service.go    # Business logic
│   │   ├── pgn_parser.go            # PGN parsing
│   │   └── tree_service.go          # Tree manipulation
│   ├── repository/
│   │   └── repertoire_repo.go       # PostgreSQL access
│   ├── models/
│   │   └── repertoire.go            # TypeScript/Go types
│   └── middleware/
│       └── logger.go                # Structured logging
├── migrations/
│   └── 001_init.sql                 # PostgreSQL schema
└── go.mod
```

### 5.3 REST API (MVP)

```
GET    /api/health                   # Health check
GET    /api/repertoire/:color        # Get White/Black repertoire
POST   /api/repertoire/:color/node   # Add node
DELETE /api/repertoire/:color/node/:id  # Delete node
POST   /api/imports                  # Upload PGN + auto-analyze
GET    /api/analyses                 # List all analyses
GET    /api/analyses/:id             # Get analysis details
DELETE /api/analyses/:id             # Delete analysis
```

**Note:** Repertoires are auto-created on startup (REQ-001). No POST endpoint needed for creation.

### 5.4 Frontend Architecture

```
src/
├── components/
│   ├── App.tsx
│   ├── Board/
│   │   ├── ChessBoard.tsx
│   │   └── MoveHistory.tsx
│   ├── Tree/
│   │   ├── RepertoireTree.tsx
│   │   ├── TreeNode.tsx
│   │   └── TreeEdge.tsx
│   ├── PGN/
│   │   ├── FileUploader.tsx
│   │   └── AnalysisResult.tsx
│   ├── Repertoire/
│   │   ├── RepertoireSelector.tsx
│   │   └── BranchReview.tsx
│   └── UI/
│       ├── Button.tsx
│       ├── Modal.tsx
│       └── Toast.tsx
├── hooks/
│   ├── useRepertoire.ts
│   ├── useChess.ts
│   └── useTreeLayout.ts
├── services/
│   ├── api.ts
│   └── pgnParser.ts
├── stores/
│   └── repertoireStore.ts
├── types/
│   └── index.ts
└── styles/
    └── main.css
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

| Interaction | Behavior |
|-------------|----------|
| Scroll wheel | Zoom in/out centered on mouse |
| Click + drag | Pan viewport |
| Click node | Select node, update board |
| Double-click node | Open branch review mode |
| Reset button | Return to root |

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

| Error | Message | Action |
|-------|---------|--------|
| Empty file | "File is empty" | Invite to choose another file |
| Invalid format | "Invalid PGN format at line X" | Show format examples |
| UTF-8 encoding | "Encoding error, use UTF-8" | Auto-correct if possible |
| No moves found | "File contains no games" | Invite to verify file |

### 9.2 Move Validation Errors

| Error | Message | Action |
|-------|---------|--------|
| Illegal move | "This move is not legal" | Block addition |
| SAN ambiguity | "Specify starting square (e.g., Nge2)" | Request complete notation |
| Invalid position | "Inconsistent position" | Reload from FEN |

### 9.3 Backend Errors

| Error | Message | Action |
|-------|---------|--------|
| DB connection | "Database connection error" | Retry with exponential backoff |
| Timeout | "Operation timed out" | Retry |
| Invalid JSON | "Data corrupted" | Rollback transaction |

---

## 10. Roadmap: MVP → V2

### 10.1 MVP - Version 1.0 (Months 1-2) - Local Development

| Feature | Priority | Estimate |
|---------|----------|----------|
| Go + PostgreSQL project setup | High | 1 day |
| Database migration | High | 0.5 day |
| React + TypeScript architecture | High | 2 days |
| Chess board component (chess.js) | High | 3 days |
| Repertoire CRUD (API + UI) | High | 4 days |
| PGN parser backend | High | 2 days |
| Repertoire vs games matching | High | 3 days |
| GitHub-style Tree visualization | High | 5 days |
| UI/Polish | Medium | 3 days |
| **Total** | | **~24 days** |

**MVP Note:**
- Backend Go in local development with PostgreSQL
- No authentication
- No production deployment
- Data stored in local PostgreSQL database

### 10.2 V2 - Version 2.0 (Months 3-6) - Production

| Feature | Description |
|---------|-------------|
| **Lichess OAuth Authentication** | Login via Lichess account (free) |
| **Multi-users** | Data isolation by user_id |
| **Lichess API** | Direct import from Lichess account |
| **Production deployment** | Server + cloud PostgreSQL |
| **Tests and CI/CD** | Deployment pipeline |
| **Training mode** | Quiz "What's the next move?" with 4 choices |
| **Spaced repetition** | Anki-like algorithm for review |

### 10.3 V3+ - Future Enhancements

| Feature | Description |
|---------|-------------|
| **Main line vs Sideline** | Different colors in tree |
| **Multiple repertoires** | "Club", "Competitive", "Fun" |
| **PGN Export** | Save repertoire |
| **Automatic ECO** | ECO classification of positions |
| **Statistics** | Mastery percentage per opening |
| **Chess.com API** | Import from Chess.com account |
| **Comments/Videos** | Annotations on positions |
| **Opening explorer** | Lichess stats on positions |
| **Shared repertoires** | Community templates |

---

## 11. Installation and Local Development

### 11.1 Prerequisites

- Go 1.21+
- PostgreSQL 15+
- Node.js 18+
- npm or yarn
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
# Install air for hot reload
curl -sSf https://raw.githubusercontent.com/cosmtrek/air/master/install.sh | sh -s -- -b $(go env GOPATH)/bin

# Run with hot reload
cd cmd/server
air
# Backend available at http://localhost:8080
```

**With Docker:** See section 11.6

### 11.4 Run Frontend

```bash
npm install
npm run dev
# Frontend available at http://localhost:5173
# Vite includes automatic Hot Module Replacement (HMR)
```

**With Docker:** See section 11.6

### 11.5 Environment Variables

```env
# .env
DATABASE_URL=postgres://user:password@localhost:5432/treechess?sslmode=disable
PORT=8080
```

### 11.6 Dockerization (Local Development)

**Prerequisites**: Docker and Docker Compose installed.

#### File Structure

```
treechess/
├── docker-compose.yml
├── Dockerfile.backend
├── Dockerfile.frontend
├── .dockerignore
├── cmd/server/
│   └── main.go
└── src/
    └── ...
```

#### Configuration Files

**docker-compose.yml:**
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
    depends_on:
      - postgres

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

volumes:
  postgres_data:
```

**Dockerfile.backend:**
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

**Dockerfile.frontend:**
```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host"]
```

**.dockerignore:**
```
node_modules
.git
*.log
```

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

#### Hot Reload

- **Frontend**: Vite HMR automatic (files mounted as volumes)
- **Backend**: `compile-daemon` detects changes and auto-recompiles

#### Access URLs

- Frontend: http://localhost:5173
- Backend API: http://localhost:8080
- PostgreSQL: localhost:5432 (treechess/treechess)

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

 50%

**Test Structure**Coverage Target**::**
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

| Level | Usage |
|-------|-------|
| DEBUG | Detailed debug information, variable values |
| INFO | Normal operation events |
| ERROR | Errors that require attention |
| WARN | Warnings (non-blocking issues) |

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
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

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
  debug: (msg: string, comp?: string) => log('debug', msg, comp),
  info: (msg: string, comp?: string) => log('info', msg, comp),
  warn: (msg: string, comp?: string) => log('warn', msg, comp),
  error: (msg: string, comp?: string) => log('error', msg, comp),
};
```

---

## 14. Database Migrations

### 14.1 Migration Files

All migrations are stored in `migrations/` directory:

```
migrations/
├── 001_init.sql
├── 002_add_user_table.sql
└── 003_add_repertoire_name.sql
```

### 14.2 Naming Convention

- Format: `NNN_description.sql` where NNN is a 3-digit序号
- All migrations must be forward-only (no down migrations for MVP)
- Each file contains DDL statements in order

### 14.3 Migration Template

```sql
-- Migration: 002_add_user_table
-- Description: Adds user table for multi-user support
-- Date: 2026-01-19

CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
```

### 14.4 Running Migrations

**Manual:**
```bash
psql -d treechess -f migrations/001_init.sql
```

**Via Go migration tool (future):**
```bash
go-migrate -path migrations -database postgres://... up
```

---

## 15. Project README

### 15.1 README.md Template

Create a `README.md` file at project root:

```markdown
# TreeChess

Interactive chess opening repertoire builder with GitHub-style tree visualization.

## Quick Start

### Prerequisites

- Go 1.21+
- PostgreSQL 15+
- Node.js 18+

### Installation

```bash
# Clone repository
git clone https://github.com/yourusername/treechess.git
cd treechess

# Setup database
createdb treechess
psql -d treechess -f migrations/001_init.sql

# Install frontend dependencies
cd src && npm install

# Return to root
cd ..
```

### Running

**Option 1: Local (recommended)**

```bash
# Terminal 1: Backend with hot reload
cd cmd/server
air

# Terminal 2: Frontend
cd src
npm run dev
```

**Option 2: Docker**

```bash
docker-compose up --build
```

- Frontend: http://localhost:5173
- Backend: http://localhost:8080

### Project Structure

```
treechess/
├── cmd/server/           # Go backend
├── src/                  # React frontend
├── migrations/           # PostgreSQL migrations
├── docker-compose.yml    # Docker configuration
└── README.md
```

## Features

- Create and edit opening repertoires
- Import PGN files from Lichess exports
- Analyze games against your repertoire
- GitHub-style tree visualization
- Add missing lines directly from analysis

## Tech Stack

- React 18 + TypeScript + Vite
- Go + PostgreSQL + pgx
- chess.js for move validation
- D3.js/React Flow for tree visualization

## License

MIT
```

---

## 16. Change Log

| Version | Date | Author | Description |
|---------|------|--------|-------------|
| 1.0 | 2026-01-19 | - | Initial document |
| 2.0 | 2026-01-19 | - | PostgreSQL, single-user MVP, multi-user V2 |
| 3.0 | 2026-01-19 | - | Full English translation, added tests, logging, migrations, README sections |

---

*Document generated for TreeChess - Chess opening training web app*
