# Epic 7: PGN Import Workflow

**Objective:** Implement PGN file import, game analysis, and repertoire enrichment workflow.

---

## Definition of Done

- [ ] File upload works (drag & drop + file picker)
- [ ] PGN parsing extracts games correctly
- [ ] Each game is analyzed against repertoire
- [ ] Results show: in-repertoire, out-of-repertoire, new lines
- [ ] Clicking "Add" navigates to correct repertoire position
- [ ] Clicking "Ignore" marks the line as ignored
- [ ] Import history is saved in localStorage
- [ ] Same file can be re-analyzed

---

## Tickets

### PGN-001: Build Import List page
**Description:** Create page for listing and managing imported PGN files.
**Acceptance:**
- [ ] Upload button for .pgn files
- [ ] Color selector (White/Black) for which repertoire to analyze against
- [ ] Drag and drop support
- [ ] List of previously imported files
- [ ] Filename and game count displayed
- [ ] Upload date displayed
- [ ] Analyze button for each file
- [ ] Delete button for each file
- [ ] History persists in localStorage
**Dependencies:** FRONTEND-004

### PGN-002: Implement file upload with auto-analysis
**Description:** Handle PGN file upload to backend via multipart form. Analysis happens automatically.
**Acceptance:**
- [ ] File type validation (.pgn only)
- [ ] Color parameter sent with upload
- [ ] POST /api/imports endpoint
- [ ] Parsing and analysis happen server-side
- [ ] Response includes id and gameCount
- [ ] Loading state during upload
- [ ] Error handling for failed uploads
- [ ] Navigate to analysis page after upload
**Dependencies:** PGN-001, BACKEND-009

### PGN-003: Build Import Detail page
**Description:** Create page showing analysis results with summary cards.
**Acceptance:**
- [ ] GET /api/analyses/:id endpoint used
- [ ] Summary cards (In Repertoire, Errors, New Lines)
- [ ] Errors section with move details
- [ ] New Lines section with move details
- [ ] Moves in Repertoire section (collapsed by default)
- [ ] Add to repertoire buttons
- [ ] Ignore buttons
- [ ] Loading state during analysis
**Dependencies:** PGN-002, CHESS-003

### PGN-004: Implement analysis deletion
**Description:** Allow deleting analyses.
**Acceptance:**
- [ ] DELETE /api/analyses/:id endpoint
- [ ] Confirmation dialog before delete
- [ ] List updates after deletion
- [ ] Success toast displayed
**Dependencies:** PGN-001

---

## Move Classification

For each move in a game:

1. **In Repertoire**: Move exists as a child of the current node
2. **Out of Repertoire**: Move doesn't exist and it's the user's move
3. **New Line**: Move doesn't exist and it's the opponent's move

**Color Handling:**
- User's moves (White when analyzing White repertoire) → in-repertoire or out-of-repertoire
- Opponent's moves → in-repertoire or new-line

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/imports | Upload PGN file + auto analyze |
| GET | /api/analyses | List all analyses |
| GET | /api/analyses/:id | Get analysis details |
| DELETE | /api/analyses/:id | Delete analysis |

**POST /api/imports Request:**
- Content-Type: multipart/form-data
- Fields: file (PGN), color (white | black)

---

## User Flows

### Uploading and Analyzing

1. User clicks "Import PGN" on Dashboard
2. User selects color (White or Black) to analyze against
3. User selects .pgn file (drag & drop or file picker)
4. File validated (.pgn extension)
5. POST /api/imports sent with file and color
6. Backend parses PGN and analyzes each game
7. Results stored in analyses table
8. Response returns id and gameCount
9. Navigate to Import Detail page

### Viewing Analysis Results

1. Import Detail page loads
2. GET /api/analyses/:id fetches full results
3. Summary cards show counts:
   - In Repertoire: moves that exist
   - Errors: user's moves not in repertoire
   - New Lines: opponent's moves not in repertoire
4. User can expand each section to see details
5. "Add to Repertoire" button on errors/new lines
6. "Ignore" button dismisses the entry

### Adding to Repertoire from Analysis

1. User clicks "Add" on an error/new line entry
2. Navigation context stored in sessionStorage:
   ```json
   {"color":"white","parentId":"uuid","fen":"...","moveSAN":"e4"}
   ```
3. Navigate to /repertoire/:color/edit
4. RepertoireEdit page reads context and:
   - Selects the parent node
   - Opens Add Move modal pre-filled with the move
   - Clears context after use

---

## Dependencies to Other Epics

- Repertoire CRUD (Epic 6) for navigation to edit page
- Chess Logic (Epic 3) for move validation
- Backend API (Epic 2) for import endpoints
