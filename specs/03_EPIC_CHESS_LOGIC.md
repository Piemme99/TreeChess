# Epic 3: Chess Logic

**Chess Library:** notnil/chess (backend)
**Frontend Library:** chess.js

**Objective:** Implement chess rules validation, move generation, and PGN parsing using existing libraries.

---

## Definition of Done

- [ ] notnil/chess validates legal moves correctly (backend)
- [ ] chess.js validates legal moves correctly (frontend)
- [ ] PGN parser extracts headers correctly
- [ ] PGN parser extracts moves in SAN format
- [ ] SAN move can be converted to board position
- [ ] FEN is generated correctly after each move
- [ ] Transpositions are handled (policy: not merged)
- [ ] Promotions default to Queen
- [ ] All edge cases handled (castling, en passant)

---

## Tickets

### CHESS-001: Implement chess.js validator (Frontend)
**Description:** Create ChessValidator class wrapping chess.js for move validation.
**Acceptance:**
- [ ] Constructor accepts optional FEN
- [ ] validateMove() returns move details or null
- [ ] getLegalMoves() returns SAN moves
- [ ] getFEN() returns current position
- [ ] getTurn() returns 'w' or 'b'
- [ ] getMoveNumber() returns integer
- [ ] undo() and reset() work
- [ ] loadFEN() validates and loads position
**Dependencies:** None

### CHESS-002: Implement SAN validation (Frontend)
**Description:** Create utility for SAN format validation.
**Acceptance:**
- [ ] Piece moves validated (Nf3, e4, etc.)
- [ ] Captures validated (exd5, etc.)
- [ ] Castling validated (O-O, O-O-O)
- [ ] Promotions validated (e8=Q, etc.)
- [ ] Check/checkmate suffixes optional
**Dependencies:** CHESS-001

### CHESS-003: Implement PGN parser (Backend)
**Description:** Create PGN parser for game extraction using notnil/chess.
**Acceptance:**
- [ ] ParseGames() splits multiple games
- [ ] Headers extracted (Event, Date, White, Black, Result)
- [ ] Moves extracted in SAN format
- [ ] Comments and variations stripped
- [ ] NAGs stripped
- [ ] Result markers handled
**Dependencies:** None

### CHESS-004: Implement move validation (Backend)
**Description:** Create chess move validation using notnil/chess.
**Acceptance:**
- [ ] ValidateMove() checks legality with notnil/chess
- [ ] GenerateFENAfterMove() returns new position
- [ ] GetLegalMoves() returns all valid SAN
- [ ] Errors returned for invalid moves
**Dependencies:** None

---

## Transposition Policy

**For MVP, transpositions are NOT merged automatically.**

Each path through the tree is kept as-is. If the user adds:
- 1.e4 e5 2.Nf3 → creates path "e4 → e5 → Nf3"
- 1.Nf3 e5 2.e4 → creates separate path "Nf3 → e5 → e4"

Both paths lead to the same position but are stored as separate branches.

**Rationale:** Simpler implementation, matches user's actual game experience.

---

## Promotion Handling

**Default Behavior:** When a promotion is encountered without explicit piece:
- Default to Queen promotion (most common)

**Frontend Input:** When user plays a move to the 8th/1st rank:
- Show promotion dialog
- Allow user to choose Q, R, B, N
- Default to Queen if no choice made

**Storage:** Store full SAN with promotion (e8=Q, etc.)

---

## Dependencies to Other Epics

- Backend API (Epic 2) uses this for PGN import validation
- Frontend Core (Epic 4) uses this for move input validation
- PGN Import (Epic 7) uses this for analyzing games against repertoire
