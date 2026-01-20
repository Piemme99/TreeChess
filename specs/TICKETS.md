# TICKETS.md

Centralized ticket registry for TreeChess project.

## Infrastructure (Epic 1)

### INFRA-001: Create Docker Compose configuration
**Description:** Create docker-compose.yml with postgres, backend, and frontend services.
**Acceptance:**
- [ ] PostgreSQL 15 service with healthcheck
- [ ] Backend Go service with hot reload
- [ ] Frontend React service with hot reload
- [ ] Services communicate via internal network
- [ ] Ports 5432, 8080, 5173 exposed

### INFRA-002: Setup backend Go project
**Description:** Initialize Go module with Echo and pgx dependencies.
**Acceptance:**
- [ ] go.mod created with go 1.21
- [ ] Echo v4 imported
- [ ] pgx v5 imported
- [ ] UUID library imported

### INFRA-003: Setup frontend React project
**Description:** Initialize Vite project with TypeScript, React, and dependencies.
**Acceptance:**
- [ ] package.json with React 18, TypeScript 5, Vite 5
- [ ] chess.js imported
- [ ] zustand imported
- [ ] react-router-dom imported
- [ ] vite.config.ts configured

### INFRA-004: Create database schema migration
**Description:** Create SQL migration for repertoires table.
**Acceptance:**
- [ ] repertoires table with UUID primary key
- [ ] color column (white/black) with unique constraint
- [ ] tree_data JSONB column
- [ ] metadata JSONB column with defaults
- [ ] created_at and updated_at timestamps
- [ ] Indexes on color and updated_at

### INFRA-005: Create backend Dockerfile
**Description:** Create Docker image for backend with hot reload support.
**Acceptance:**
- [ ] Based on golang:1.21-alpine
- [ ] Air installed for hot reload
- [ ] Exposes port 8080
- [ ] Mounts backend directory
- [ ] Runs with proper environment variables

### INFRA-006: Create frontend Dockerfile
**Description:** Create Docker image for frontend dev server.
**Acceptance:**
- [ ] Based on node:18-alpine
- [ ] npm install runs during build
- [ ] Exposes port 5173
- [ ] Runs npm run dev with host flag
- [ ] Mounts src directory for hot reload

---

## Backend API (Epic 2)

### BACKEND-001: Create config loader
**Description:** Implement configuration loading from environment variables.
**Acceptance:**
- [ ] DATABASE_URL loaded from env or default
- [ ] PORT loaded from env or default 8080
- [ ] Config struct exported
- [ ] MustLoad function panics on error

### BACKEND-002: Create database connection
**Description:** Implement pgx connection pool initialization.
**Acceptance:**
- [ ] Connection pool created from config
- [ ] Ping succeeds on startup
- [ ] Pool exposed via GetPool function
- [ ] CloseDB function properly closes pool

### BACKEND-003: Define data models
**Description:** Create Go structs for RepertoireNode, Repertoire, and request types.
**Acceptance:**
- [ ] Color type with White/Black constants
- [ ] RepertoireNode struct with all fields
- [ ] Repertoire struct with metadata
- [ ] AddNodeRequest struct
- [ ] Analysis-related structs (GameAnalysis, MoveAnalysis)
- [ ] JSON tags on all exported fields
**Dependencies:** None (run `go get github.com/notnil/chess` first)

### BACKEND-004: Implement repertoire repository
**Description:** Create repository methods for CRUD operations.
**Acceptance:**
- [ ] GetRepertoireByColor returns full repertoire
- [ ] CreateRepertoire creates empty tree with root node
- [ ] SaveRepertoire updates tree_data and metadata
- [ ] JSON marshaling/unmarshaling works

### BACKEND-004b: Implement import repository
**Description:** Create repository methods for analyses.
**Acceptance:**
- [ ] SaveAnalysis stores filename, color, gameCount, results
- [ ] GetAnalyses returns list with summary (filtered by color optional)
- [ ] GetAnalysisByID returns full analysis with results
- [ ] DeleteAnalysis removes analysis
- [ ] Results stored as JSONB

### BACKEND-005: Implement repertoire service
**Description:** Create service layer with business logic.
**Acceptance:**
- [ ] CreateRepertoire validates color
- [ ] GetRepertoire validates color
- [ ] AddNode finds parent and appends child
- [ ] DeleteNode removes node recursively
- [ ] Metadata updated on mutations
- [ ] Errors returned for invalid operations
- [ ] Auto-create repertoires at startup if needed

### BACKEND-005b: Implement import service
**Description:** Create service layer for PGN parsing and analysis.
**Acceptance:**
- [ ] ParsePGN extracts games and headers
- [ ] AnalyzeGame classifies each move against repertoire
- [ ] Results structured as GameAnalysis[]
- [ ] Color parameter determines which repertoire to analyze against
- [ ] Errors returned for invalid PGN

### BACKEND-006: Create health handler
**Description:** Implement /api/health endpoint.
**Acceptance:**
- [ ] GET /api/health returns 200
- [ ] Response is JSON with status field

### BACKEND-007: Create repertoire handler
**Description:** Implement API endpoints for repertoire operations.
**Acceptance:**
- [ ] GET /api/repertoire/:color returns repertoire (auto-created at startup)
- [ ] POST /api/repertoire/:color/node adds node
- [ ] DELETE /api/repertoire/:color/node/:id deletes node
- [ ] Proper error handling with HTTP status codes

### BACKEND-008: Wire main.go
**Description:** Connect all backend components in main.go.
**Acceptance:**
- [ ] Config loaded at startup
- [ ] Database initialized
- [ ] Repertoires auto-created for white and black if not exist
- [ ] Echo instance created with middleware
- [ ] CORS configured for localhost:5173
- [ ] Logger middleware active
- [ ] Routes registered
- [ ] Server starts on configured port

### BACKEND-009: Create import/analysis handler
**Description:** Implement API endpoints for PGN import and analysis.
**Acceptance:**
- [ ] POST /api/imports handles multipart upload with color parameter
- [ ] PGN parsed and analyzed immediately against specified repertoire
- [ ] Results stored in analyses table with color
- [ ] GET /api/analyses returns list
- [ ] GET /api/analyses/:id returns full details
- [ ] DELETE /api/analyses/:id removes analysis
- [ ] Proper error handling with HTTP status codes

---

## Chess Logic (Epic 3)

### CHESS-001: Implement chess.js validator (Frontend)
**Description:** Create ChessValidator class wrapping chess.js.
**Acceptance:**
- [ ] Constructor accepts optional FEN
- [ ] validateMove() returns move details or null
- [ ] getLegalMoves() returns SAN moves
- [ ] getFEN() returns current position
- [ ] getTurn() returns w or b
- [ ] getMoveNumber() returns integer
- [ ] undo() and reset() work
- [ ] loadFEN() validates and loads position

### CHESS-002: Implement SAN validation (Frontend)
**Description:** Create utility for SAN format validation.
**Acceptance:**
- [ ] Piece moves validated (Nf3, e4, etc.)
- [ ] Captures validated (exd5, etc.)
- [ ] Castling validated (O-O, O-O-O)
- [ ] Promotions validated (e8=Q, etc.)
- [ ] Check/checkmate suffixes optional

### CHESS-003: Implement PGN parser (Backend)
**Description:** Create PGN parser for game extraction.
**Acceptance:**
- [ ] ParseGames() splits multiple games
- [ ] Headers extracted (Event, Date, White, Black, Result)
- [ ] Moves extracted in SAN format
- [ ] Comments and variations stripped
- [ ] NAGs stripped
- [ ] Result markers handled

### CHESS-004: Implement move validation (Backend)
**Description:** Create chess move validation using notnil/chess.
**Acceptance:**
- [ ] ValidateMove() checks legality
- [ ] GenerateFENAfterMove() returns new position
- [ ] GetLegalMoves() returns all valid SAN
- [ ] Errors returned for invalid moves

---

## Frontend Core (Epic 4)

### FRONTEND-001: Setup React entry points
**Description:** Configure main.tsx and App.tsx with routing.
**Acceptance:**
- [ ] BrowserRouter wraps App
- [ ] Routes defined for all pages
- [ ] ToastContainer renders globally
- [ ] 404 handling for unknown routes

### FRONTEND-002: Create API client
**Description:** Implement Axios-based API client.
**Acceptance:**
- [ ] Base URL from environment variable
- [ ] getRepertoire(color) endpoint
- [ ] addNode(color, data) endpoint
- [ ] deleteNode(color, nodeId) endpoint
- [ ] uploadImport(file, color) - POST multipart/form-data with file and color fields, returns {id, gameCount}
- [ ] getAnalyses() endpoint - returns list of analyses
- [ ] getAnalysis(id) endpoint - returns full analysis details
- [ ] deleteAnalysis(id) endpoint
- [ ] Error interceptor logs errors

### FRONTEND-003: Create repertoire store
**Description:** Implement Zustand store for repertoire state.
**Acceptance:**
- [ ] whiteRepertoire and blackRepertoire state
- [ ] selectedColor and selectedNode state
- [ ] isLoading and error state
- [ ] loadRepertoire(color) action
- [ ] setSelectedNode(node) action
- [ ] addNode(parentId, move, fen, moveNumber) action
- [ ] deleteNode(nodeId) action

### FRONTEND-004: Create base UI components
**Description:** Build reusable Button, Modal, Toast, Loading components.
**Acceptance:**
- [ ] Button with variants (primary, secondary, danger, ghost)
- [ ] Button with sizes (sm, md, lg)
- [ ] Button with loading state
- [ ] Modal with title, content, size variants
- [ ] Modal closes on Escape key
- [ ] Modal closes on overlay click
- [ ] ToastContainer displays notifications
- [ ] Toast auto-dismisses after 5s
- [ ] Loading spinner with size variants

### FRONTEND-005: Create Dashboard page
**Description:** Build main landing page.
**Acceptance:**
- [ ] Title "TreeChess" displayed
- [ ] White repertoire card with Edit button
- [ ] Black repertoire card with Edit button
- [ ] Import PGN button
- [ ] Clicking Edit navigates to repertoire edit page

### FRONTEND-006: Create CSS theming
**Description:** Define CSS variables and base styles.
**Acceptance:**
- [ ] Color variables (primary, danger, success, warning)
- [ ] Spacing variables (xs, sm, md, lg, xl)
- [ ] Border radius variables
- [ ] Font family defined
- [ ] Button styles implemented
- [ ] Modal styles implemented
- [ ] Toast styles implemented

---

## Board Component (Epic 4b)

### BOARD-001: Render chess board from FEN
**Description:** Create board component that displays position.
**Acceptance:**
- [ ] 8x8 grid rendered
- [ ] Light/dark square colors correct
- [ ] Pieces displayed using unicode symbols
- [ ] Orientation can be white or black
- [ ] FEN string determines position

### BOARD-002: Implement piece selection
**Description:** Allow clicking to select pieces.
**Acceptance:**
- [ ] Click selects own piece
- [ ] Selected square highlighted
- [ ] Clicking same piece deselects
- [ ] Clicking different piece changes selection

### BOARD-003: Implement move execution
**Description:** Allow playing moves on board.
**Acceptance:**
- [ ] Click source then destination
- [ ] Move validated by chess.js
- [ ] Legal moves highlighted
- [ ] Capture moves shown differently
- [ ] Invalid move shows error
- [ ] onMove callback fired on success
- [ ] onPositionChange callback fired on success

### BOARD-004: Implement move history
**Description:** Display sequence of played moves.
**Acceptance:**
- [ ] Moves displayed in SAN
- [ ] Move numbers shown
- [ ] White and black moves paired
- [ ] Scrollable if many moves
- [ ] Latest move highlighted

---

## Tree Visualization (Epic 5)

### TREE-001: Design tree data structures
**Description:** Define TypeScript interfaces for tree layout.
**Acceptance:**
- [ ] TreeNodeData interface
- [ ] TreeLayout interface
- [ ] LayoutNode interface
- [ ] LayoutEdge interface
- [ ] Helper function to convert RepertoireNode

### TREE-002: Implement layout algorithm
**Description:** Calculate positions for tree nodes.
**Acceptance:**
- [ ] Root positioned at left edge
- [ ] Children spread vertically
- [ ] Subtree heights calculated
- [ ] No overlapping nodes
- [ ] Bézier curves for edges
- [ ] Consistent spacing between levels

### TREE-003: Render SVG tree
**Description:** Display tree using SVG.
**Acceptance:**
- [ ] All nodes rendered as circles/rects
- [ ] SAN notation displayed on nodes
- [ ] Edges rendered as paths
- [ ] Arrowheads on edges
- [ ] Root node visually distinct
- [ ] Selected node highlighted

### TREE-004: Implement zoom and pan
**Description:** Add interactive controls for large trees.
**Acceptance:**
- [ ] Mouse wheel zooms in/out
- [ ] Ctrl+wheel prevents page scroll
- [ ] Click and drag pans view
- [ ] Zoom limits (0.2x to 3x)
- [ ] Reset button restores default view

---

## Repertoire CRUD (Epic 6)

### CRUD-001: Build Repertoire Edit page
**Description:** Create main editing interface combining tree and board.
**Acceptance:**
- [ ] Header with Back button and title
- [ ] Tree panel on left
- [ ] Board panel on right
- [ ] Selected node displayed on board
- [ ] Add Move button enabled when node selected
- [ ] Delete Branch button enabled when node selected

### CRUD-002: Implement Add Move modal
**Description:** Create dialog for adding new moves.
**Acceptance:**
- [ ] Modal opens on Add Move click
- [ ] SAN input field with placeholder
- [ ] Validation via chess.js
- [ ] Success toast on add
- [ ] Error toast on invalid move
- [ ] Modal closes after add or cancel

### CRUD-003: Implement Delete Branch
**Description:** Allow deleting nodes and their children.
**Acceptance:**
- [ ] Confirmation dialog before delete
- [ ] Node and all children removed
- [ ] Tree updates immediately
- [ ] Board returns to parent position
- [ ] Success toast displayed
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
