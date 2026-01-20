# Epic 4: Frontend Core

**Objective:** Build React application structure, routing, state management, API client, and base UI components.

---

## Definition of Done

- [ ] React app runs at http://localhost:5173
- [ ] Routing works (Dashboard, Repertoires, Imports, Edit pages)
- [ ] Zustand store manages application state
- [ ] API client can fetch/save repertoires and manage imports
- [ ] Base UI components are available (Button, Modal, Toast, Loading)
- [ ] Toast notifications display and auto-dismiss
- [ ] Loading states are handled
- [ ] Error handling displays appropriate messages
- [ ] TypeScript strict mode passes without errors

---

## Tickets

### FRONTEND-001: Setup React entry points
**Description:** Configure main.tsx and App.tsx with routing.
**Acceptance:**
- [ ] BrowserRouter wraps App
- [ ] Routes defined for all pages
- [ ] ToastContainer renders globally
- [ ] 404 handling for unknown routes
**Dependencies:** None

### FRONTEND-002: Create API client
**Description:** Implement Axios-based API client for backend communication.
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
**Dependencies:** None

### FRONTEND-003: Create repertoire store
**Description:** Implement Zustand store for repertoire state management.
**Acceptance:**
- [ ] whiteRepertoire and blackRepertoire state
- [ ] selectedColor and selectedNode state
- [ ] isLoading and error state
- [ ] loadRepertoire(color) action
- [ ] setSelectedNode(node) action
- [ ] addNode(parentId, move, fen, moveNumber) action
- [ ] deleteNode(nodeId) action
**Dependencies:** FRONTEND-002

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
**Dependencies:** None

### FRONTEND-005: Create Dashboard page
**Description:** Build main landing page with repertoire overview.
**Acceptance:**
- [ ] Title "TreeChess" displayed
- [ ] White repertoire card with Edit button
- [ ] Black repertoire card with Edit button
- [ ] Import PGN button
- [ ] Clicking Edit navigates to repertoire edit page
**Dependencies:** FRONTEND-004

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
**Dependencies:** None

---

## Routing Structure

| Route | Component | Description |
|-------|-----------|-------------|
| / | Dashboard | Home page with repertoire summary |
| /repertoires | RepertoireList | List of all repertoires |
| /repertoire/:color/edit | RepertoireEdit | Edit a specific repertoire |
| /imports | ImportList | List of imported PGN files |
| /import/:id | ImportDetail | View analysis of imported file |

---

## Frontend Directory Structure

```
frontend/src/
├── App.tsx
├── main.tsx
├── index.css
├── components/
│   ├── UI/
│   │   ├── Button.tsx
│   │   ├── Modal.tsx
│   │   ├── Toast.tsx
│   │   └── Loading.tsx
│   ├── Dashboard/
│   │   └── Dashboard.tsx
│   └── Import/
│       └── ImportList.tsx
├── services/
│   └── api.ts
├── stores/
│   ├── repertoireStore.ts
│   └── toastStore.ts
├── types/
│   └── index.ts
└── utils/
    └── chessValidator.ts
```

---

## Dependencies to Other Epics

- Chess Logic (Epic 3) provides validation utilities
- Board Component (Epic 4b) will be integrated into RepertoireEdit
- Tree Visual (Epic 5) will be integrated into RepertoireEdit
- PGN Import (Epic 7) uses the API client from this epic
