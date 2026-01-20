# TICKETS.md

Centralized ticket registry for TreeChess project.

## Infrastructure (Epic 1)

### INFRA-001: Create Docker Compose configuration
**Description:** Create docker-compose.yml with postgres, backend, and frontend services.
**Acceptance:**
- [x] PostgreSQL 15 service with healthcheck
- [x] Backend Go service with hot reload
- [x] Frontend React service with hot reload
- [x] Services communicate via internal network
- [x] Ports 5432, 8080, 5173 exposed

### INFRA-002: Setup backend Go project
**Description:** Initialize Go module with Echo and pgx dependencies.
**Acceptance:**
- [x] go.mod created with go 1.24
- [x] Echo v4 imported
- [x] pgx v5 imported
- [x] UUID library imported

### INFRA-003: Setup frontend React project
**Description:** Initialize Vite project with TypeScript, React, and dependencies.
**Acceptance:**
- [x] package.json with React 18, TypeScript 5, Vite 5
- [x] chess.js imported
- [x] zustand imported
- [x] react-router-dom imported
- [x] vite.config.ts configured
- [x] react-chessboard imported (for board component)

### INFRA-004: Create database schema migration
**Description:** Create SQL migration for repertoires table.
**Acceptance:**
- [x] repertoires table with UUID primary key
- [x] color column (white/black) with unique constraint
- [x] tree_data JSONB column
- [x] metadata JSONB column with defaults
- [x] created_at and updated_at timestamps
- [x] Indexes on color and updated_at

### INFRA-005: Create backend Dockerfile
**Description:** Create Docker image for backend with hot reload support.
**Acceptance:**
- [x] Based on golang:1.24-alpine
- [x] Air installed for hot reload
- [x] Exposes port 8080
- [x] Mounts backend directory
- [x] Runs with proper environment variables

### INFRA-006: Create frontend Dockerfile
**Description:** Create Docker image for frontend dev server.
**Acceptance:**
- [x] Based on node:18-slim (Alpine had rollup issues)
- [x] Build essentials installed
- [x] npm install runs during build
- [x] Exposes port 5173
- [x] Runs npm run dev with host flag
- [x] Mounts src directory for hot reload

---

## Backend API (Epic 2)

### BACKEND-001: Create config loader
**Description:** Implement configuration loading from environment variables.
**Acceptance:**
- [x] DATABASE_URL loaded from env or default
- [x] PORT loaded from env or default 8080
- [x] Config struct exported
- [x] MustLoad function panics on error

### BACKEND-002: Create database connection
**Description:** Implement pgx connection pool initialization.
**Acceptance:**
- [x] Connection pool created from config
- [x] Ping succeeds on startup
- [x] Pool exposed via GetPool function
- [x] CloseDB function properly closes pool

### BACKEND-003: Define data models
**Description:** Create Go structs for RepertoireNode, Repertoire, and request types.
**Acceptance:**
- [x] Color type with White/Black constants
- [x] RepertoireNode struct with all fields
- [x] Repertoire struct with metadata
- [x] AddNodeRequest struct
- [x] Analysis-related structs (GameAnalysis, MoveAnalysis)
- [x] JSON tags on all exported fields
- [x] notnil/chess imported for move validation

### BACKEND-004: Implement repertoire repository
**Description:** Create repository methods for CRUD operations.
**Acceptance:**
- [x] GetRepertoireByColor returns full repertoire
- [x] CreateRepertoire creates empty tree with root node
- [x] SaveRepertoire updates tree_data and metadata
- [x] JSON marshaling/unmarshaling works

### BACKEND-004b: Implement import repository
**Description:** Create repository for PGN analyses.
**Acceptance:**
- [x] analyses table with UUID primary key
- [x] ImportAnalysis struct stored
- [x] CRUD operations for analyses

### BACKEND-005: Implement repertoire service
**Description:** Create service layer with business logic.
**Acceptance:**
- [x] CreateRepertoire validates color
- [x] GetRepertoire validates color
- [x] AddNode finds parent and appends child
- [x] DeleteNode removes node recursively
- [x] Metadata updated on mutations
- [x] Errors returned for invalid operations
- [x] Auto-create repertoires at startup if needed

### BACKEND-005b: Implement import service
**Description:** Create service for PGN parsing and analysis.
**Acceptance:**
- [x] notnil/chess.GamesFromPGN for parsing
- [x] Move classification (in-repertoire, out-of-repertoire, opponent-new)
- [x] Full FEN generation with notnil/chess

### BACKEND-006: Create health handler
**Description:** Implement /api/health endpoint.
**Acceptance:**
- [x] GET /api/health returns 200
- [x] Response is JSON with status field

### BACKEND-007: Create repertoire handler
**Description:** Implement API endpoints for repertoire operations.
**Acceptance:**
- [x] GET /api/repertoire/:color returns repertoire (auto-created at startup)
- [x] POST /api/repertoire/:color/node adds node
- [x] DELETE /api/repertoire/:color/node/:id deletes node
- [x] Proper error handling with HTTP status codes

### BACKEND-008: Wire main.go
**Description:** Connect all backend components in main.go.
**Acceptance:**
- [x] Config loaded at startup
- [x] Database initialized
- [x] Repertoires auto-created for white and black if not exist
- [x] Echo instance created with middleware
- [x] CORS configured for localhost:5173
- [x] Logger middleware active
- [x] Routes registered
- [x] Server starts on configured port

### BACKEND-009: Create import/analysis handler
**Description:** Implement API endpoints for PGN import and analysis.
**Acceptance:**
- [x] POST /api/imports handles JSON body with pgn and color
- [x] PGN parsed and analyzed immediately against specified repertoire
- [x] Results stored in analyses table with color
- [x] GET /api/analyses returns list
- [x] GET /api/analyses/:id returns full details
- [x] DELETE /api/analyses/:id removes analysis
- [x] Proper error handling with HTTP status codes

---

## Chess Logic (Epic 3)

### CHESS-001: Implement chess utilities (Frontend)
**Description:** Create utilities wrapping chess.js.
**Acceptance:**
- [x] createInitialPosition() returns Chess instance
- [x] createPositionFromFEN() validates and loads position
- [x] getShortFEN() strips halfmove/fullmove counters
- [x] isValidMove() validates SAN against FEN
- [x] getMoveSAN() gets SAN from from/to squares
- [x] getLegalMoves() returns all valid moves with details
- [x] makeMove() applies move and returns new FEN
- [x] getTurn() returns w or b
- [x] getMoveNumber() calculates move number

### CHESS-002: Implement TypeScript types
**Description:** Define TypeScript interfaces for the application.
**Acceptance:**
- [x] Color type ('w' | 'b')
- [x] GameResult type
- [x] RepertoireNode interface with children
- [x] Repertoire interface
- [x] MoveAnalysis interface
- [x] PgnImport interface
- [x] ApiError interface

---

## Frontend Core (Epic 4)

### FRONTEND-001: Setup React entry points
**Description:** Configure main.tsx and App.tsx with routing.
**Acceptance:**
- [x] BrowserRouter wraps App
- [x] App component renders (single-page for now)
- [x] ToastContainer not yet implemented

### FRONTEND-002: Create API client
**Description:** Implement Axios-based API client.
**Acceptance:**
- [x] Base URL /api
- [x] repertoireApi.get(color)
- [x] repertoireApi.addNode(color, parentId, fen, san)
- [x] repertoireApi.deleteNode(color, nodeId)
- [x] importApi.upload(pgn)
- [x] importApi.list()
- [x] importApi.get(id)
- [x] importApi.delete(id)
- [x] healthApi.check()

### FRONTEND-003: Create repertoire store
**Description:** Implement Zustand store for repertoire state.
**Acceptance:**
- [x] whiteRepertoire and blackRepertoire state
- [x] selectedNodeId state
- [x] loading and error state
- [x] setRepertoire(color, repertoire) action
- [x] selectNode(nodeId) action
- [x] addMove(color, parentId, san, fenBefore) action - updates local state
- [x] deleteNode(color, nodeId) action

### FRONTEND-004: Create ChessBoard component
**Description:** Implement board using react-chessboard.
**Acceptance:**
- [x] Position displayed from FEN
- [x] Pieces rendered with react-chessboard (Wikimedia SVGs)
- [x] boardOrientation prop for white/black view
- [x] onPieceDrop callback
- [x] onSquareClick callback
- [x] customSquareStyles for selection and possible moves

### FRONTEND-005: Create RepertoireTree component
**Description:** Implement tree visualization component.
**Acceptance:**
- [x] Recursive tree rendering
- [x] Move notation displayed
- [x] Selected node highlighted
- [x] Color coding (green=repertoire, red=opponent)
- [x] Click to select node

### FRONTEND-006: Create App component
**Description:** Build main application with board, tree, and controls.
**Acceptance:**
- [x] ChessBoard rendered
- [x] RepertoireTreeView rendered
- [x] White/Black repertoire toggle
- [x] PGN import textarea
- [x] Import button with API call
- [x] Loading state
- [x] Error display

---

## Board Component (Epic 4b)

### BOARD-001: Render chess board from FEN
**Description:** Create board component that displays position.
**Acceptance:**
- [x] Using react-chessboard library
- [x] 8x8 grid rendered
- [x] Light/dark square colors (green/cream)
- [x] Pieces displayed using Wikimedia SVGs (Staunton set)
- [x] Orientation can be white or black

### BOARD-002: Implement piece selection
**Description:** Allow clicking to select pieces.
**Acceptance:**
- [x] Click selects own piece
- [x] Selected square highlighted
- [x] onSquareClick callback fires

### BOARD-003: Implement move execution
**Description:** Allow playing moves on board.
**Acceptance:**
- [x] Drag and drop via react-chessboard
- [x] Move validated by chess.js internally
- [x] Legal moves shown as dots
- [x] Invalid move rejected
- [x] onMove callback fired on success

---

## Tree Visualization (Epic 5)

### TREE-001: Design tree data structures
**Description:** Define TypeScript interfaces for tree layout.
**Acceptance:**
- [x] RepertoireNode interface already defined

### TREE-002: Implement tree rendering
**Description:** Display tree using React components.
**Acceptance:**
- [x] RepertoireTree recursive component
- [x] Children spread vertically
- [x] Move numbers shown
- [x] Indentation for depth

---

## Repertoire CRUD (Epic 6)

### CRUD-001: Build repertoire editing
**Description:** Allow adding moves to repertoire.
**Acceptance:**
- [x] Board shows current position from selected node
- [x] Making a move calls API to add node
- [x] Tree updates after move added
- [x] API integration in handleMove

---

## PGN Import (Epic 7)

### PGN-001: Build Import UI
**Description:** Create UI for PGN import.
**Acceptance:**
- [x] Textarea for pasting PGN
- [x] Import button calls API
- [x] Status messages shown
- [x] Reloads repertoires after import

---

## Tests Status

### Backend Tests (Go)
- Config tests: PASS
- DB tests: PASS
- Repository tests: PASS
- Service tests: PASS
- Handler tests: PASS (3 skipped - require DB)

### Frontend Tests (TypeScript)
- TypeScript compilation: PASS
- ESLint: PASS
- [ ] Cannot delete root node

---

## PGN Import (Epic 7)

### PGN-001: Build Analysis List page
**Description:** Create page for listing and managing analyses.
**Acceptance:**
- [ ] Upload button for .pgn files
- [ ] Drag and drop support
- [ ] List of analyses with filename and game count
- [ ] Upload date displayed
- [ ] View Analysis button for each entry
- [ ] Delete button for each entry
- [ ] List persists in localStorage

### PGN-002: Implement file upload with auto-analysis
**Description:** Handle PGN upload to backend. Analysis happens automatically.
**Acceptance:**
- [ ] File type validation (.pgn only)
- [ ] POST /api/imports endpoint
- [ ] Parsing and analysis happen server-side
- [ ] Response includes id and gameCount
- [ ] Loading state during upload
- [ ] Error handling for failed uploads
- [ ] Navigate to analysis page after upload

### PGN-003: Build Analysis Detail page
**Description:** Create page showing full analysis results.
**Acceptance:**
- [ ] GET /api/analyses/:id endpoint used
- [ ] Summary cards (In Repertoire, Errors, New Lines)
- [ ] Errors section with move details
- [ ] New Lines section with move details
- [ ] Add to repertoire buttons
- [ ] Ignore buttons

### PGN-004: Implement analysis deletion
**Description:** Allow deleting analyses.
**Acceptance:**
- [ ] DELETE /api/analyses/:id endpoint
- [ ] Confirmation dialog before delete
- [ ] List updates after deletion
- [ ] Success toast displayed
