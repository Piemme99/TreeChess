# Architecture Contract

**Version:** 1.0
**Date:** January 19, 2026

This document defines the **interface contracts** between frontend and backend. All agents must follow these contracts when implementing their respective epics.

---

## 1. Database Schema

### 1.1 Repertoires Table

```sql
CREATE TABLE repertoires (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    color VARCHAR(5) NOT NULL CHECK (color IN ('white', 'black')),
    tree_data JSONB NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{"totalNodes": 0, "totalMoves": 0, "deepestDepth": 0}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT one_repertoire_per_color UNIQUE (color)
);

CREATE INDEX idx_repertoires_color ON repertoires(color);
CREATE INDEX idx_repertoires_updated ON repertoires(updated_at DESC);
```

**Note:** Repertoires are auto-created on first startup (REQ-001).

### 1.2 Analyses Table

```sql
CREATE TABLE analyses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    color VARCHAR(5) NOT NULL CHECK (color IN ('white', 'black')),
    filename VARCHAR(255) NOT NULL,
    game_count INTEGER NOT NULL,
    results JSONB NOT NULL,           -- GameAnalysis[]
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_analyses_color ON analyses(color);
CREATE INDEX idx_analyses_uploaded ON analyses(uploaded_at DESC);
```

---

## 2. Data Types

### 2.1 TypeScript Types (Frontend)

```typescript
// Repertoire Node - Core data structure
interface RepertoireNode {
  id: string;
  fen: string;
  move: string | null;           // SAN notation, null for root
  moveNumber: number;             // 0 = root, increments each ply
  colorToMove: 'w' | 'b';
  parentId: string | null;        // UUID, null for root
  children: RepertoireNode[];
}

// Full Repertoire
interface Repertoire {
  id: string;
  color: 'white' | 'black';
  treeData: RepertoireNode;
  metadata: RepertoireMetadata;
  createdAt: string;              // ISO 8601
  updatedAt: string;              // ISO 8601
}

// Metadata tracking
interface RepertoireMetadata {
  totalNodes: number;
  totalMoves: number;
  deepestDepth: number;
}

// Request types
interface AddNodeRequest {
  parentId: string;
  move: string;                   // SAN notation
  fen: string;                    // Position after move
  moveNumber: number;
  colorToMove: 'w' | 'b';
}

// PGN types
interface PGNHeaders {
  Event?: string;
  Site?: string;
  Date?: string;                  // YYYY.MM.DD format
  Round?: string;
  White?: string;
  Black?: string;
  Result?: string;                // 1-0, 0-1, 1/2-1/2, *
  ECO?: string;
}

interface MoveAnalysis {
  plyNumber: number;              // 0-indexed ply count
  san: string;                    // Move in SAN
  fen: string;                    // Position before move
  status: 'in-repertoire' | 'out-of-repertoire' | 'opponent-new';
  expectedMove?: string;          // If out-of-repertoire
  isUserMove: boolean;            // True if this is user's color move
}

interface GameAnalysis {
  gameIndex: number;
  headers: PGNHeaders;
  moves: MoveAnalysis[];
}

interface AnalysisSummary {
  id: string;
  filename: string;
  gameCount: number;
  uploadedAt: string;
}

interface AnalysisDetail extends AnalysisSummary {
  results: GameAnalysis[];
}
```

### 2.2 Go Types (Backend)

```go
package models

type Color string

const (
    ColorWhite Color = "white"
    ColorBlack Color = "black"
)

type RepertoireNode struct {
    ID          string            `json:"id"`
    FEN         string            `json:"fen"`
    Move        *string           `json:"move,omitempty"`        // nil for root
    MoveNumber  int               `json:"moveNumber"`
    ColorToMove Color             `json:"colorToMove"`
    ParentID    *string           `json:"parentId,omitempty"`    // nil for root
    Children    []*RepertoireNode `json:"children"`
}

type Repertoire struct {
    ID        string          `json:"id"`
    Color     Color           `json:"color"`
    TreeData  RepertoireNode  `json:"treeData"`
    Metadata  Metadata        `json:"metadata"`
    CreatedAt time.Time       `json:"createdAt"`
    UpdatedAt time.Time       `json:"updatedAt"`
}

type Metadata struct {
    TotalNodes   int `json:"totalNodes"`
    TotalMoves   int `json:"totalMoves"`
    DeepestDepth int `json:"deepestDepth"`
}

type AddNodeRequest struct {
    ParentID    string  `json:"parentId"`
    Move        string  `json:"move"`
    FEN         string  `json:"fen"`
    MoveNumber  int     `json:"moveNumber"`
    ColorToMove Color   `json:"colorToMove"`
}

type PGNHeaders map[string]string

type MoveAnalysis struct {
    PlyNumber    int    `json:"plyNumber"`
    SAN          string `json:"san"`
    FEN          string `json:"fen"`
    Status       string `json:"status"`                 // in-repertoire | out-of-repertoire | opponent-new
    ExpectedMove string `json:"expectedMove,omitempty"`
    IsUserMove   bool   `json:"isUserMove"`
}

type GameAnalysis struct {
    GameIndex int             `json:"gameIndex"`
    Headers   PGNHeaders      `json:"headers"`
    Moves     []MoveAnalysis  `json:"moves"`
}

type UploadResponse struct {
    ID        string `json:"id"`
    GameCount int    `json:"gameCount"`
}

type AnalysisSummary struct {
    ID        string    `json:"id"`
    Filename  string    `json:"filename"`
    GameCount int       `json:"gameCount"`
    UploadedAt time.Time `json:"uploadedAt"`
}
```

---

## 3. API Endpoints

### 3.1 Health Check

| Method | Path | Response |
|--------|------|----------|
| GET | `/api/health` | `{"status":"ok"}` |

---

### 3.2 Repertoire Endpoints

**Note:** Repertoires are auto-created at startup. No POST endpoint needed.

| Method | Path | Description | Response |
|--------|------|-------------|----------|
| GET | `/api/repertoire/:color` | Get White or Black repertoire | Full Repertoire |
| POST | `/api/repertoire/:color/node` | Add a node | Updated Repertoire |
| DELETE | `/api/repertoire/:color/node/:id` | Delete a node | Updated Repertoire |

**GET /api/repertoire/:color**

Response (200):
```json
{
  "id": "uuid",
  "color": "white",
  "treeData": { /* full tree */ },
  "metadata": {
    "totalNodes": 1,
    "totalMoves": 0,
    "deepestDepth": 0
  },
  "createdAt": "2026-01-19T10:00:00Z",
  "updatedAt": "2026-01-19T10:00:00Z"
}
```

Error (404):
```json
{
  "error": "repertoire not found"
}
```

---

**POST /api/repertoire/:color/node**

Request:
```json
{
  "parentId": "parent-uuid",
  "move": "e4",
  "fen": "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3",
  "moveNumber": 1,
  "colorToMove": "b"
}
```

Response (200):
```json
{
  "id": "uuid",
  "color": "white",
  "treeData": { /* updated full tree */ },
  "metadata": {
    "totalNodes": 2,
    "totalMoves": 1,
    "deepestDepth": 1
  },
  "createdAt": "2026-01-19T10:00:00Z",
  "updatedAt": "2026-01-19T10:05:00Z"
}
```

Error (404):
```json
{
  "error": "parent node not found"
}
```

---

**DELETE /api/repertoire/:color/node/:id**

Response (200): Updated repertoire

Error (404):
```json
{
  "error": "node not found"
}
```

---

### 3.3 Import & Analysis Endpoints

| Method | Path | Description | Response |
|--------|------|-------------|----------|
| POST | `/api/imports` | Upload PGN + auto analyze | `{id, gameCount}` |
| GET | `/api/analyses` | List all analyses | AnalysisSummary[] |
| GET | `/api/analyses/:id` | Get analysis details | AnalysisDetail |
| DELETE | `/api/analyses/:id` | Delete analysis | 200 |

---

**POST /api/imports**

Upload PGN file. Parsing and analysis happen automatically against the specified repertoire color.

Content-Type: multipart/form-data

Form fields:
- `file`: The PGN file to upload
- `color`: The repertoire color to analyze against ("white" or "black")

Response (201):
```json
{
  "id": "uuid",
  "gameCount": 5
}
```

Error (400):
```json
{
  "error": "invalid pgn format"
}
```

---

**GET /api/analyses**

List all analyses with summary info.

Response (200):
```json
[
  {
    "id": "uuid",
    "filename": "games.pgn",
    "gameCount": 5,
    "uploadedAt": "2026-01-19T10:00:00Z"
  },
  {
    "id": "uuid",
    "filename": "tournament.pgn",
    "gameCount": 12,
    "uploadedAt": "2026-01-18T14:30:00Z"
  }
]
```

---

**GET /api/analyses/:id**

Get full analysis details with all games.

Response (200):
```json
{
  "id": "uuid",
  "filename": "games.pgn",
  "gameCount": 5,
  "uploadedAt": "2026-01-19T10:00:00Z",
  "results": [
    {
      "gameIndex": 0,
      "headers": {
        "Event": "Casual Game",
        "White": "Player",
        "Black": "Opponent",
        "Result": "1-0"
      },
      "moves": [
        {
          "plyNumber": 0,
          "san": "e4",
          "fen": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -",
          "status": "in-repertoire",
          "isUserMove": true
        },
        {
          "plyNumber": 1,
          "san": "c5",
          "fen": "rnbqkbnr/pppppppp/8/8/4p3/PPPP1PPP/RNBQKBNR w KQkq c6",
          "status": "in-repertoire",
          "isUserMove": false
        }
      ]
    }
  ]
}
```

Error (404):
```json
{
  "error": "analysis not found"
}
```

---

**DELETE /api/analyses/:id**

Response (200)

Error (404):
```json
{
  "error": "analysis not found"
}
```

---

## 4. FEN Format

### 4.1 Standard FEN Format

```
<piece placement>/<active color>/<castling rights>/<en passant>/<halfmove>/<fullmove>

Example: rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1
```

### 4.2 TreeChess Root FEN

```
rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -
```

Note: Halfmove and fullmove numbers are not stored in RepertoireNode FEN.

---

## 5. SAN Format

### 5.1 Valid SAN Patterns

| Pattern | Example | Description |
|---------|---------|-------------|
| Pawn move | e4 | Pawn to e4 |
| Pawn capture | exd5 | Pawn from e captures d5 |
| Piece move | Nf3 | Knight to f3 |
| Disambiguation | Nge2 | Knight from g-file to e2 |
| Promotion | e8=Q | Pawn promotes to Queen |
| Castling kingside | O-O | Kingside castling |
| Castling queenside | O-O-O | Queenside castling |
| Check | Nf6+ | Move gives check |
| Checkmate | Qh5# | Move gives checkmate |

### 5.2 Invalid SAN

- Moves without proper disambiguation
- Illegal moves from current position
- Moves violating castling rules
- Promotions without piece designation

---

## 6. Move Numbering

### 6.1 Ply vs Move

- **Ply**: Half-move (one player's turn)
- **Move**: Full move (White + Black)

### 6.2 RepertoireNode.moveNumber

```
Root: moveNumber = 0
After White's first move: moveNumber = 1
After Black's first move: moveNumber = 2
After White's second move: moveNumber = 3
```

This maps to ply number directly.

---

## 7. Naming Conventions

### 7.1 Database

| Entity | Convention | Example |
|--------|------------|---------|
| Table names | snake_case | repertoires |
| Column names | snake_case | created_at |
| UUID primary key | id | id |

### 7.2 API

| Entity | Convention | Example |
|--------|------------|---------|
| URL paths | kebab-case | /api/repertoire/:color |
| JSON keys | camelCase | treeData |
| Enum values | lowercase | white, black |

### 7.3 Frontend

| Entity | Convention | Example |
|--------|------------|---------|
| Files | camelCase.ts | repertoireStore.ts |
| Components | PascalCase.tsx | ChessBoard.tsx |
| Interfaces | PascalCase | RepertoireNode |
| Variables | camelCase | whiteRepertoire |

### 7.4 Backend

| Entity | Convention | Example |
|--------|------------|---------|
| Files | snake_case.go | repertoire_service.go |
| Packages | lowercase | repository |
| Structs | PascalCase | RepertoireNode |
| Fields | camelCase | moveNumber |

---

## 8. Error Handling

### 8.1 HTTP Status Codes

| Code | Meaning | Usage |
|------|---------|-------|
| 200 | OK | Successful GET, successful DELETE |
| 201 | Created | Successful POST (creation) |
| 400 | Bad Request | Invalid request body |
| 404 | Not Found | Resource doesn't exist |
| 500 | Internal Server Error | Server failure |

### 8.2 Error Response Format

```json
{
  "error": "human-readable error message"
}
```

---

## 9. CORS Configuration

### 9.1 Allowed Origins

Development: `http://localhost:5173`

### 9.2 Allowed Methods

- GET
- POST
- DELETE
- OPTIONS

### 9.3 Allowed Headers

- Content-Type

---

## 10. Session Storage Keys

For cross-page navigation (e.g., PGN import to repertoire edit):

| Key | Purpose | Format |
|-----|---------|--------|
| pendingAddNode | Node to add after import | `{"color":"white","parentId":"uuid","fen":"..."}` |
| analysisNavigate | Navigate context from analysis | `{"color":"white","parentFEN":"...","moveSAN":"..."}` |

Both expire on page unload.

---

## 11. Chess.js Integration (Frontend)

### 11.1 Validator Methods Required

```typescript
class ChessValidator {
  constructor(fen?: string);
  validateMove(san: string): ValidatedMove | null;
  getLegalMoves(): string[];
  getFEN(): string;
  getTurn(): 'w' | 'b';
  getMoveNumber(): number;
  undo(): boolean;
  reset(): void;
  loadFEN(fen: string): boolean;
}
```

### 11.2 ValidatedMove Interface

```typescript
interface ValidatedMove {
  san: string;
  lan: string;
  from: string;
  to: string;
  piece: string;
  captured?: string;
  promotion?: string;
  isCheck: boolean;
  isCheckmate: boolean;
  isCastling: boolean;
}
```

---

## 12. notnil/chess Integration (Backend)

### 12.1 Required Operations

```go
type ChessService interface {
  ValidateMove(fen, san string) (*ValidatedMove, error)
  GenerateFENAfterMove(fen, san string) (string, error)
  GetLegalMoves(fen string) ([]string, error)
}
```

### 12.2 ValidatedMove (Go)

```go
type ValidatedMove struct {
  SAN           string
  FEN           string
  Piece         string
  From          string
  To            string
  IsCheck       bool
  IsCheckmate   bool
  IsPromotion   bool
  PromotionTo   string
}
```

---

## 13. Configuration

### 13.1 Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| DATABASE_URL | Yes | - | PostgreSQL connection string |
| PORT | No | 8080 | Backend listen port |
| VITE_API_URL | No | http://localhost:8080 | Frontend API URL |

### 13.2 DATABASE_URL Format

```
postgres://username:password@host:port/database?sslmode=disable
```

---

## 14. File Structure Reference

### 14.1 Frontend

```
frontend/src/
├── components/
│   ├── UI/
│   │   ├── Button.tsx
│   │   ├── Modal.tsx
│   │   ├── Toast.tsx
│   │   └── Loading.tsx
│   ├── Board/
│   │   ├── ChessBoard.tsx
│   │   └── MoveHistory.tsx
│   ├── Tree/
│   │   ├── RepertoireTree.tsx
│   │   ├── treeTypes.ts
│   │   └── treeLayout.ts
│   ├── Repertoire/
│   │   ├── RepertoireEdit.tsx
│   │   └── RepertoireList.tsx
│   ├── Import/
│   │   ├── ImportList.tsx
│   │   └── ImportDetail.tsx
│   └── Dashboard/
│       └── Dashboard.tsx
├── services/
│   └── api.ts
├── stores/
│   ├── repertoireStore.ts
│   └── toastStore.ts
├── utils/
│   ├── chessValidator.ts
│   └── pgnParser.ts
├── App.tsx
├── main.tsx
└── index.css
```

### 14.2 Backend

```
backend/
├── main.go
├── config/
│   └── config.go
├── internal/
│   ├── handlers/
│   │   ├── health.go
│   │   ├── repertoire.go
│   │   └── import.go
│   ├── middleware/
│   │   └── logger.go
│   ├── models/
│   │   └── repertoire.go
│   ├── repository/
│   │   ├── db.go
│   │   ├── repertoire_repo.go
│   │   └── import_repo.go
│   ├── services/
│   │   ├── repertoire_service.go
│   │   ├── chess_service.go
│   │   └── import_service.go
│   └── utils/
│       └── chess.go
└── go.mod
```

---

## 15. Complete Endpoint Reference

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/repertoire/:color` | Get repertoire |
| POST | `/api/repertoire/:color/node` | Add node |
| DELETE | `/api/repertoire/:color/node/:id` | Delete node |
| POST | `/api/imports` | Upload PGN + auto analyze |
| GET | `/api/analyses` | List all analyses |
| GET | `/api/analyses/:id` | Get analysis details |
| DELETE | `/api/analyses/:id` | Delete analysis |

**Total: 10 endpoints**
