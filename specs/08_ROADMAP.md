# Roadmap: Execution Order

**Version:** 1.0  
**Date:** January 19, 2026

---

## Execution Order

This document specifies the order in which epics should be developed, along with dependencies and estimated effort.

---

## Phase 1: Foundations

### 1. Infrastructure (Epic 1)

**Estimated:** 1-2 days  
**Status:** Not Started

**Deliverables:**
- [ ] Docker Compose configuration
- [ ] Backend Go scaffold
- [ ] Frontend React scaffold
- [ ] Database schema + migrations
- [ ] Hot reload setup

**Verification:**
- `docker-compose up --build` starts all services
- Frontend at http://localhost:5173
- Backend at http://localhost:8080/api/health

---

## Phase 2: Backend Development

### 2. Backend API (Epic 2)

**Estimated:** 4-5 days  
**Status:** Not Started  
**Dependencies:** Epic 1 completed

**Deliverables:**
- [ ] Configuration loading
- [ ] PostgreSQL connection (pgx)
- [ ] Repository pattern for repertoires
- [ ] API handlers (GET, POST, DELETE)
- [ ] Logging middleware
- [ ] Unit tests (50% coverage)

**Verification:**
- All API endpoints return correct responses
- Database operations persist data
- Tests pass

---

### 3. Chess Logic (Epic 3)

**Estimated:** 2-3 days  
**Status:** Not Started  
**Dependencies:** None (can be done in parallel with Epic 2)

**Deliverables:**
- [ ] Move validation (chess.js integration)
- [ ] PGN parser (headers + moves)
- [ ] FEN generation
- [ ] Transposition policy (documented)
- [ ] Promotion handling

**Verification:**
- Validates legal chess moves
- Parses PGN files correctly
- Generates correct FEN after moves

---

## Phase 3: Frontend Core

### 4. Frontend Core (Epic 4)

**Estimated:** 3-4 days  
**Status:** Not Started  
**Dependencies:** Epic 1 completed

**Deliverables:**
- [ ] React + TypeScript setup
- [ ] Routing (React Router)
- [ ] Zustand state management
- [ ] API client
- [ ] Base UI components (Button, Modal, Toast)
- [ ] Dashboard page
- [ ] Repertoires list page

**Verification:**
- Frontend builds without errors
- Routing works between pages
- Toast notifications display

---

### 4b. Board Component (Epic 4b)

**Estimated:** 2-3 days  
**Status:** Not Started  
**Dependencies:** Epic 4 completed

**Deliverables:**
- [ ] Chess board rendering
- [ ] Piece selection
- [ ] Move input (click-to-move)
- [ ] Legal move highlighting
- [ ] Move history display
- [ ] Board flip

**Verification:**
- Board displays correctly
- Moves are validated
- Legal moves are highlighted

---

## Phase 4: Visualization & CRUD

### 5. Tree Visualization (Epic 5)

**Estimated:** 4-5 days  
**Status:** Not Started  
**Dependencies:** Epic 4b completed

**Deliverables:**
- [ ] Tree layout algorithm
- [ ] SVG rendering
- [ ] Node display (SAN notation)
- [ ] Edge rendering (Bézier curves)
- [ ] Zoom and pan
- [ ] Node selection

**Verification:**
- Tree renders from repertoire data
- Layout is readable
- Zoom/pan works smoothly

---

### 6. Repertoire CRUD (Epic 6)

**Estimated:** 3-4 days  
**Status:** Not Started  
**Dependencies:** Epic 5 and Epic 4b completed

**Deliverables:**
- [ ] Repertoire edit page
- [ ] Add move modal
- [ ] Board integration with tree
- [ ] Delete branch functionality
- [ ] Navigation through tree
- [ ] Error handling

**Verification:**
- Can add moves to repertoire
- Can delete branches
- Tree updates in real-time
- Board reflects selected node

---

## Phase 5: Workflow Integration

### 7. PGN Import Workflow (Epic 7)

**Estimated:** 3-4 days  
**Status:** Not Started  
**Dependencies:** Epic 6 and Epic 3 completed

**Deliverables:**
- [ ] File upload (drag & drop)
- [ ] PGN parsing
- [ ] Game analysis against repertoire
- [ ] Results display (OK/errors/new lines)
- [ ] Add to repertoire navigation
- [ ] Import history

**Verification:**
- Can import PGN files
- Games are analyzed correctly
- Can add missing lines to repertoire

---

## Phase 6: Polish & Testing

### Final Integration

**Estimated:** 2-3 days  
**Status:** Not Started  
**Dependencies:** All epics completed

**Tasks:**
- [ ] Connect all components
- [ ] End-to-end testing
- [ ] Bug fixes
- [ ] UI polish
- [ ] Loading states
- [ ] Error messages

---

## Summary Timeline

| Phase | Epics | Estimated Total |
|-------|-------|-----------------|
| 1. Foundations | 1 | 1-2 days |
| 2. Backend | 2, 3 | 6-8 days |
| 3. Frontend Core | 4, 4b | 5-7 days |
| 4. Visualization | 5, 6 | 7-9 days |
| 5. Workflow | 7 | 3-4 days |
| 6. Polish | Integration | 2-3 days |
| **Total** | | **~24-33 days** |

---

## Parallel Development Opportunities

Some epics can be developed in parallel:

```
Week 1: Epic 1 (Infrastructure) + Epic 3 (Chess Logic)
Week 2: Epic 2 (Backend API)
Week 3: Epic 4 (Frontend Core) + Backend testing
Week 4: Epic 4b (Board) + Epic 5 (Tree)
Week 5: Epic 6 (CRUD)
Week 6: Epic 7 (PGN Import)
Week 7: Integration + Polish
```

---

## Definition of "Done"

A feature is considered "done" when:
1. Code is written and reviewed
2. Tests pass (50% coverage for MVP)
3. Verified manually in browser
4. No blocking bugs
5. Documentation updated (if needed)

---

## Milestones

| Milestone | Description | Target |
|-----------|-------------|--------|
| M1 | Infrastructure running | Day 2 |
| M2 | Backend API functional | Day 7 |
| M3 | Board component working | Day 14 |
| M4 | Tree visualization working | Day 21 |
| M5 | Full CRUD working | Day 28 |
| M6 | PGN import working | Day 32 |
| M7 | MVP complete | Day 35 |

---

## Notes

### Testing Strategy

- Unit tests for backend: 50% coverage target
- Integration tests for critical paths
- Manual testing for UI components

### Code Review

All code should be reviewed before merging (even for solo development, take breaks and review your own PRs).

### Documentation

Inline comments for complex logic. README updated as needed. No separate documentation files for MVP.
