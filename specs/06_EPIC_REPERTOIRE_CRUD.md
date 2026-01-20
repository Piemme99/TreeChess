# Epic 6: Repertoire CRUD

**Objective:** Implement repertoire creation, editing, and deletion operations with tree-board integration.

---

## Definition of Done

- [ ] Repertoires are loaded on edit page mount
- [ ] Adding a move works (from SAN input)
- [ ] Deleting a node works
- [ ] Deleting a branch (with children) works
- [ ] Tree updates in real-time after mutations
- [ ] Board updates when node is selected
- [ ] Error handling for invalid operations
- [ ] Loading states during API calls
- [ ] Confirmation dialog before deletion

---

## Tickets

### CRUD-001: Build Repertoire Edit page
**Description:** Create main editing interface combining tree and board panels.
**Acceptance:**
- [ ] Header with Back button and title (White/Black)
- [ ] Tree panel on left side
- [ ] Board panel on right side
- [ ] Selected node displayed on board
- [ ] Add Move button enabled when node selected
- [ ] Delete Branch button enabled when node selected
- [ ] Go to Root button navigates to root
**Dependencies:** TREE-003, BOARD-001

### CRUD-002: Implement Add Move modal
**Description:** Create dialog for adding new moves with validation.
**Acceptance:**
- [ ] Modal opens on Add Move click
- [ ] SAN input field with placeholder examples
- [ ] Validation via chess.js before submission
- [ ] API call to add node
- [ ] Success toast on add
- [ ] Error toast on invalid move
- [ ] Modal closes after add or cancel
**Dependencies:** CRUD-001, CHESS-001, FRONTEND-003

### CRUD-003: Implement Delete Branch
**Description:** Allow deleting nodes and all their children with confirmation.
**Acceptance:**
- [ ] Confirmation dialog before delete
- [ ] Node and all children removed from tree
- [ ] Tree updates immediately after API response
- [ ] Board returns to parent position
- [ ] Success toast displayed
- [ ] Cannot delete root node (button disabled)
**Dependencies:** CRUD-001, FRONTEND-003

---

## User Flows

### Adding a Move

1. User clicks on a node in the tree
2. Board updates to show that position
3. User clicks "+ Add Move" button
4. Modal opens with SAN input
5. User types move (e.g., "Nf3")
6. System validates move via chess.js
7. If valid, API is called to add node
8. Tree updates, toast shows success

### Deleting a Branch

1. User clicks on a node in the tree
2. User clicks "Delete Branch" button
3. Confirmation dialog appears
4. User confirms
5. API is called to delete node and children
6. Tree updates, toast shows success

---

## Validation Rules

**Move Validation:**
- Move must be legal from current position
- SAN notation must be valid format
- For promotions, must include piece (e8=Q)

**Unique Response Constraint:**
- For a given parent node, only one move with the same SAN can exist
- Show message: "This move already exists in the repertoire"

**Deletion Rules:**
- Can delete any node except the root
- When deleting a node, all children are also deleted
- Confirmation required before deletion

---

## Dependencies to Other Epics

- Tree Visual (Epic 5) for tree display
- Board Component (Epic 4b) for board display
- Backend API (Epic 2) for CRUD operations
- Chess Logic (Epic 3) for move validation
