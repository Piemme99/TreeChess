# Epic 4b: Board Component

**Objective:** Create an interactive chess board component with move input and position display using chess.js.

---

## Definition of Done

- [ ] Board displays correctly from FEN
- [ ] Pieces render correctly using unicode symbols
- [ ] Click-to-select works for own pieces
- [ ] Legal move highlighting works
- [ ] Move execution works (validated by chess.js)
- [ ] Move history is displayed
- [ ] Board orientation can be flipped
- [ ] Promotions default to Queen (MVP)

---

## Tickets

### BOARD-001: Render chess board from FEN
**Description:** Create board component that displays position from FEN string.
**Acceptance:**
- [ ] 8x8 grid rendered
- [ ] Light/dark square colors correct
- [ ] Pieces displayed using unicode symbols
- [ ] Orientation can be white or black
- [ ] FEN string determines initial position
**Dependencies:** None

### BOARD-002: Implement piece selection
**Description:** Allow clicking to select pieces of the current turn's color.
**Acceptance:**
- [ ] Click selects own piece
- [ ] Selected square highlighted
- [ ] Clicking same piece deselects
- [ ] Clicking different piece changes selection
**Dependencies:** BOARD-001

### BOARD-003: Implement move execution
**Description:** Allow playing moves on board with chess.js validation.
**Acceptance:**
- [ ] Click source then destination
- [ ] Move validated by chess.js
- [ ] Legal moves highlighted
- [ ] Capture moves shown differently
- [ ] Invalid move shows error
- [ ] onMove callback fired on success
- [ ] onPositionChange callback fired on success
**Dependencies:** BOARD-002, CHESS-001

### BOARD-004: Implement move history
**Description:** Display sequence of played moves.
**Acceptance:**
- [ ] Moves displayed in SAN
- [ ] Move numbers shown
- [ ] White and black moves paired
- [ ] Scrollable if many moves
- [ ] Latest move highlighted
**Dependencies:** BOARD-001

---

## Board Interface

```typescript
interface ChessBoardProps {
  initialFEN?: string;
  onMove?: (move: { from: string; to: string; promotion?: string }) => void;
  onPositionChange?: (fen: string) => void;
  interactive?: boolean;
  orientation?: 'white' | 'black';
  selectedSquare?: string | null;
  onSquareSelect?: (square: string | null) => void;
}
```

---

## Dependencies to Other Epics

- Chess Logic (Epic 3) provides chess.js integration
- Repertoire CRUD (Epic 6) uses this component for editing
