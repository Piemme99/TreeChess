# Epic 4b: Board Component

**Objective:** Create an interactive chess board component with move input and position display

**Status:** Not Started  
**Dependencies:** Epic 4 (Frontend Core) for component structure

---

## 1. Objective

Create a chess board component that:
- Displays the current position from FEN
- Allows piece selection and move input
- Shows legal moves for selected piece
- Highlights selected square and last move
- Supports drag-and-drop or click-to-move
- Displays move history
- Integrates with chess.js for validation

---

## 2. Definition of Done

- [ ] Board displays correctly from FEN
- [ ] Pieces render correctly (using SVG or unicode)
- [ ] Click-to-select works
- [ ] Legal move highlighting works
- [ ] Move execution works (validated by chess.js)
- [ ] Move history is displayed
- [ ] Undo last move works
- [ ] Board orientation can be flipped
- [ ] Promotions show dialog (when pawn reaches 8th/1st rank)
- [ ] Castling moves are handled correctly

---

## 3. Tasks

### 3.1 Chess Board Component

**File: `src/components/Board/ChessBoard.tsx`**

```typescript
import React, { useState, useCallback, useEffect } from 'react';
import { Chess, Move, Square } from 'chess.js';
import { ChessValidator } from '../../utils/chessValidator';

interface ChessBoardProps {
  initialFEN?: string;
  onMove?: (move: { from: Square; to: Square; promotion?: string }) => void;
  onPositionChange?: (fen: string) => void;
  interactive?: boolean;
  orientation?: 'white' | 'black';
  selectedSquare?: string | null;
  onSquareSelect?: (square: string | null) => void;
  legalMoves?: Map<string, string[]>; // square -> SAN moves
}

export function ChessBoard({
  initialFEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -',
  onMove,
  onPositionChange,
  interactive = true,
  orientation = 'white',
  selectedSquare,
  onSquareSelect,
  legalMoves,
}: ChessBoardProps) {
  const [game] = useState(() => new Chess(initialFEN));
  const [board, setBoard] = useState<string[][]>([]);
  const [possibleMoves, setPossibleMoves] = useState<Map<string, string[]>>(new Map());

  // Initialize board
  useEffect(() => {
    const boardArray = game.board();
    setBoard(boardArray.map((row) => row.map((piece) => piece?.symbol || '')));
  }, [game]);

  // Handle square click
  const handleSquareClick = useCallback(
    (square: string) => {
      if (!interactive || !onSquareSelect) return;

      // If clicking on a piece of current turn's color, select it
      const turn = game.turn();
      const piece = getPieceAt(square, board);
      
      if (piece && getPieceColor(piece) === turn) {
        onSquareSelect(square);
        
        // Calculate possible moves for this piece
        if (legalMoves) {
          setPossibleMoves(legalMoves);
        } else {
          const moves = game.moves({ square: square as Square, verbose: true });
          const moveMap = new Map<string, string[]>();
          moveMap.set(square, moves.map((m) => m.san));
          setPossibleMoves(moveMap);
        }
        return;
      }

      // If a piece is already selected, try to move
      if (selectedSquare) {
        try {
          const move = game.move({
            from: selectedSquare as Square,
            to: square as Square,
            promotion: 'q', // Default to queen
          });

          if (move) {
            onSquareSelect(null);
            setPossibleMoves(new Map());
            
            const newBoard = game.board();
            setBoard(newBoard.map((row) => row.map((p) => p?.symbol || '')));
            
            onPositionChange?.(game.fen());
            onMove?.({ from: selectedSquare as Square, to: square as Square });
          }
        } catch {
          // Invalid move, deselect
          onSquareSelect(null);
          setPossibleMoves(new Map());
        }
      }
    },
    [game, board, selectedSquare, onSquareSelect, onMove, onPositionChange, legalMoves, interactive]
  );

  // Render board squares
  const squares = [];
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const square = getSquareName(row, col);
      const isLight = (row + col) % 2 === 0;
      const piece = board[row][col];
      const isSelected = selectedSquare === square;
      const isPossibleMove = isSquareInPossibleMoves(square, possibleMoves);

      squares.push(
        <div
          key={square}
          className={`board-square board-square--${isLight ? 'light' : 'dark'} ${
            isSelected ? 'board-square--selected' : ''
          } ${isPossibleMove ? 'board-square--possible' : ''}`}
          onClick={() => handleSquareClick(square)}
          data-square={square}
        >
          {piece && <span className={`piece piece--${piece.toLowerCase()}`}>{piece}</span>}
          {isPossibleMove && !piece && <div className="possible-move-dot" />}
          {isPossibleMove && piece && <div className="possible-move-capture" />}
        </div>
      );
    }
  }

  const boardClass = orientation === 'white' ? 'board--white' : 'board--black';

  return (
    <div className={`chess-board ${boardClass}`}>
      <div className="board">{squares}</div>
    </div>
  );
}

// Helper functions
function getSquareName(row: number, col: number): string {
  const files = 'abcdefgh';
  return `${files[col]}${8 - row}`;
}

function getPieceAt(square: string, board: string[][]): string | null {
  const col = square.charCodeAt(0) - 97;
  const row = 8 - parseInt(square[1]);
  return board[row]?.[col] || null;
}

function getPieceColor(piece: string): 'w' | 'b' {
  return piece === piece.toUpperCase() ? 'w' : 'b';
}

function isSquareInPossibleMoves(square: string, moves: Map<string, string[]>): boolean {
  for (const [, moveList] of moves) {
    if (moveList.some((m) => m.includes(square))) {
      return true;
    }
  }
  return false;
}
```

### 3.2 Board with Controls

**File: `src/components/Board/BoardWithControls.tsx`**

```typescript
import React, { useState } from 'react';
import { ChessBoard } from './ChessBoard';
import { Button } from '../UI/Button';
import { MoveHistory } from './MoveHistory';

interface BoardWithControlsProps {
  initialFEN?: string;
  onMove?: (move: { from: string; to: string }) => void;
  onPositionChange?: (fen: string) => void;
}

export function BoardWithControls({
  initialFEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -',
  onMove,
  onPositionChange,
}: BoardWithControlsProps) {
  const [fen, setFEN] = useState(initialFEN);
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [orientation, setOrientation] = useState<'white' | 'black'>('white');
  const [moveHistory, setMoveHistory] = useState<string[]>([]);

  const handleMove = (move: { from: string; to: string; promotion?: string }) => {
    const moveSAN = `${move.from}${move.to}`;
    setMoveHistory((prev) => [...prev, moveSAN]);
    onMove?.(move);
  };

  const handlePositionChange = (newFEN: string) => {
    setFEN(newFEN);
    onPositionChange?.(newFEN);
  };

  const handleUndo = () => {
    if (moveHistory.length > 0) {
      const newHistory = moveHistory.slice(0, -1);
      setMoveHistory(newHistory);
      // Note: For true undo, we'd need to track the game state
      // This is a simplified version
    }
  };

  const handleFlip = () => {
    setOrientation((prev) => (prev === 'white' ? 'black' : 'white'));
  };

  return (
    <div className="board-with-controls">
      <div className="board-controls">
        <Button variant="secondary" size="sm" onClick={handleFlip}>
          Flip Board
        </Button>
        <Button variant="secondary" size="sm" onClick={handleUndo} disabled={moveHistory.length === 0}>
          Undo
        </Button>
      </div>

      <div className="board-container">
        <ChessBoard
          initialFEN={fen}
          onMove={handleMove}
          onPositionChange={handlePositionChange}
          selectedSquare={selectedSquare}
          onSquareSelect={setSelectedSquare}
          orientation={orientation}
        />
      </div>

      <MoveHistory moves={moveHistory} />
    </div>
  );
}
```

### 3.3 Move History Component

**File: `src/components/Board/MoveHistory.tsx`**

```typescript
import React from 'react';

interface MoveHistoryProps {
  moves: string[];
  maxDisplay?: number;
}

export function MoveHistory({ moves, maxDisplay = 10 }: MoveHistoryProps) {
  if (moves.length === 0) {
    return (
      <div className="move-history">
        <h3>Move History</h3>
        <p className="text-muted">No moves yet</p>
      </div>
    );
  }

  const displayMoves = moves.slice(-maxDisplay);
  const startMoveNumber = Math.floor((moves.length - maxDisplay) / 2) + 1;

  // Group moves into pairs (1. e4 e5, 2. Nf3 Nf6, etc.)
  const pairs: { number: number; white: string; black?: string }[] = [];
  for (let i = 0; i < displayMoves.length; i += 2) {
    pairs.push({
      number: startMoveNumber + Math.floor(i / 2),
      white: displayMoves[i],
      black: displayMoves[i + 1],
    });
  }

  return (
    <div className="move-history">
      <h3>Move History</h3>
      {moves.length > maxDisplay && (
        <p className="text-muted">... and {moves.length - maxDisplay} more moves</p>
      )}
      <div className="move-list">
        {pairs.map((pair) => (
          <div key={pair.number} className="move-pair">
            <span className="move-number">{pair.number}.</span>
            <span className="move-white">{pair.white}</span>
            {pair.black && <span className="move-black">{pair.black}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
```

### 3.4 CSS for Board

**File: `src/components/Board/Board.css`**

```css
.chess-board {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.board {
  display: grid;
  grid-template-columns: repeat(8, 60px);
  grid-template-rows: repeat(8, 60px);
  border: 2px solid #333;
  user-select: none;
}

.board-square {
  width: 60px;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 40px;
  cursor: pointer;
  position: relative;
}

.board-square--light {
  background-color: #f0d9b5;
}

.board-square--dark {
  background-color: #b58863;
}

.board-square--selected {
  background-color: #7b61a3 !important;
}

.board-square--possible {
  cursor: pointer;
}

.piece {
  z-index: 1;
  cursor: grab;
}

.piece:active {
  cursor: grabbing;
}

.piece--k { color: #fff; text-shadow: 0 0 2px #000; } /* White king */
.piece--q { color: #fff; text-shadow: 0 0 2px #000; }
.piece--r { color: #fff; text-shadow: 0 0 2px #000; }
.piece--b { color: #fff; text-shadow: 0 0 2px #000; }
.piece--n { color: #fff; text-shadow: 0 0 2px #000; }
.piece--p { color: #fff; text-shadow: 0 0 2px #000; }

.piece--k { color: #000; } /* Black king - no shadow */
.piece--q { color: #000; }
.piece--r { color: #000; }
.piece--b { color: #000; }
.piece--n { color: #000; }
.piece--p { color: #000; }

.possible-move-dot {
  position: absolute;
  width: 20px;
  height: 20px;
  background-color: rgba(0, 0, 0, 0.2);
  border-radius: 50%;
}

.possible-move-capture {
  position: absolute;
  width: 100%;
  height: 100%;
  border: 4px solid rgba(0, 0, 0, 0.3);
  border-radius: 0;
}

.board-controls {
  display: flex;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-md);
}

.board-container {
  margin-bottom: var(--spacing-md);
}

/* Board orientation - flipped */
.board--black .board {
  transform: rotate(180deg);
}

.board--black .board-square--selected {
  background-color: #7b61a3 !important;
}

/* Responsive */
@media (max-width: 600px) {
  .board {
    grid-template-columns: repeat(8, 40px);
    grid-template-rows: repeat(8, 40px);
  }
  
  .board-square {
    width: 40px;
    height: 40px;
    font-size: 28px;
  }
}

/* Move History */
.move-history {
  max-width: 300px;
  padding: var(--spacing-md);
  background: var(--color-bg-card);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
}

.move-history h3 {
  margin-bottom: var(--spacing-sm);
  font-size: 16px;
}

.move-list {
  max-height: 200px;
  overflow-y: auto;
}

.move-pair {
  display: flex;
  gap: var(--spacing-sm);
  padding: 2px 0;
  font-size: 14px;
}

.move-number {
  color: var(--color-text-muted);
  min-width: 24px;
}

.move-white {
  min-width: 50px;
}

.move-black {
  color: var(--color-text-muted);
}
```

---

## 4. Usage Examples

### 4.1 Basic Usage

```typescript
import { ChessBoard } from './components/Board/ChessBoard';

function App() {
  return (
    <ChessBoard
      initialFEN="rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -"
      onMove={(move) => console.log('Moved:', move)}
    />
  );
}
```

### 4.2 With Controls

```typescript
import { BoardWithControls } from './components/Board/BoardWithControls';

function App() {
  return (
    <BoardWithControls
      initialFEN="rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -"
      onMove={(move) => console.log('Moved:', move)}
    />
  );
}
```

### 4.3 Display Only (Non-interactive)

```typescript
<ChessBoard
  initialFEN="r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq -"
  interactive={false}
  orientation="black"
/>
```

---

## 5. Promotion Handling

When a pawn reaches the 8th (White) or 1st (Black) rank, show a promotion dialog:

**File: `src/components/Board/PromotionDialog.tsx`**

```typescript
interface PromotionDialogProps {
  color: 'w' | 'b';
  onSelect: (piece: 'q' | 'r' | 'b' | 'n') => void;
  onCancel: () => void;
}

export function PromotionDialog({ color, onSelect, onCancel }: PromotionDialogProps) {
  const pieces = ['q', 'r', 'b', 'n'];
  
  return (
    <div className="promotion-dialog">
      <h3>Choose promotion piece</h3>
      <div className="promotion-options">
        {pieces.map((piece) => (
          <button
            key={piece}
            className="promotion-option"
            onClick={() => onSelect(piece as 'q' | 'r' | 'b' | 'n')}
          >
            {getPieceSymbol(piece, color)}
          </button>
        ))}
      </div>
      <Button variant="secondary" onClick={onCancel}>Cancel</Button>
    </div>
  );
}

function getPieceSymbol(piece: string, color: string): string {
  const symbols: Record<string, string> = {
    q: color === 'w' ? '♛' : '♕',
    r: color === 'w' ? '♜' : '♖',
    b: color === 'w' ? '♝' : '♗',
    n: color === 'w' ? '♞' : '♘',
  };
  return symbols[piece];
}
```

---

## 6. Dependencies to Other Epics

- Frontend Core (Epic 4) provides base component structure
- Chess Logic (Epic 3) provides chess.js integration
- Repertoire CRUD (Epic 6) uses this component for editing

---

## 7. Notes

### 7.1 Piece Rendering

For MVP, using unicode chess symbols. Future options:
- SVG pieces from Wikimedia Commons
- Chess font (like `react-chessboard`)
- Custom SVG components

### 7.2 Board Size

Default 60px squares (480px total). Responsive to 40px squares on mobile.

### 7.3 Drag and Drop

Not implementing drag-and-drop for MVP. Click-to-select + click-to-move is simpler and works better on mobile.
