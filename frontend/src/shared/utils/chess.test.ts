import { describe, it, expect } from 'vitest';
import {
  STARTING_FEN,
  getTurn,
  getFullMoveNumber,
  getShortFEN,
  isValidMove,
  getLegalMoves,
  makeMove,
  createPositionFromFEN,
  getMoveSAN,
  ensureFullFEN,
  getMainlineFEN,
  deriveChildMoveNumber,
  formatNodeNotation
} from './chess';
import type { RepertoireNode } from '../../types';

function node(partial: Partial<RepertoireNode>): RepertoireNode {
  return {
    id: 'n',
    fen: STARTING_FEN,
    move: null,
    moveNumber: 0,
    colorToMove: 'w',
    parentId: null,
    children: [],
    ...partial,
  } as RepertoireNode;
}

describe('STARTING_FEN', () => {
  it('should be the standard starting position', () => {
    expect(STARTING_FEN).toBe('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
  });
});

describe('getTurn', () => {
  it('returns w for starting position', () => {
    expect(getTurn(STARTING_FEN)).toBe('w');
  });

  it('returns b for black to move', () => {
    const fen = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';
    expect(getTurn(fen)).toBe('b');
  });

  it('returns w for invalid FEN', () => {
    expect(getTurn('')).toBe('w');
    expect(getTurn('invalid')).toBe('w');
    expect(getTurn('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR')).toBe('w');
  });

  it('returns w for null/undefined input', () => {
    expect(getTurn(null as unknown as string)).toBe('w');
    expect(getTurn(undefined as unknown as string)).toBe('w');
  });

  it('returns w for FEN with invalid turn indicator', () => {
    expect(getTurn('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR x KQkq - 0 1')).toBe('w');
  });
});

describe('getFullMoveNumber', () => {
  it('returns 1 for starting position', () => {
    expect(getFullMoveNumber(STARTING_FEN)).toBe(1);
  });

  it('returns correct move number from FEN', () => {
    const fen = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';
    expect(getFullMoveNumber(fen)).toBe(1);

    const fen2 = 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3';
    expect(getFullMoveNumber(fen2)).toBe(3);
  });

  it('returns 1 for invalid FEN', () => {
    expect(getFullMoveNumber('')).toBe(1);
    expect(getFullMoveNumber('invalid')).toBe(1);
    expect(getFullMoveNumber(null as unknown as string)).toBe(1);
  });

  it('returns 1 for FEN with non-numeric move number', () => {
    expect(getFullMoveNumber('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 abc')).toBe(1);
  });
});

describe('getShortFEN', () => {
  it('returns first 4 parts of FEN', () => {
    const shortFen = getShortFEN(STARTING_FEN);
    expect(shortFen).toBe('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -');
  });

  it('returns original if less than 4 parts', () => {
    expect(getShortFEN('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR')).toBe(
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR'
    );
  });

  it('handles FEN with en passant square', () => {
    const fen = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';
    expect(getShortFEN(fen)).toBe('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3');
  });
});

describe('isValidMove', () => {
  it('returns true for valid moves', () => {
    expect(isValidMove(STARTING_FEN, 'e4')).toBe(true);
    expect(isValidMove(STARTING_FEN, 'Nf3')).toBe(true);
    expect(isValidMove(STARTING_FEN, 'd4')).toBe(true);
  });

  it('returns false for invalid moves', () => {
    expect(isValidMove(STARTING_FEN, 'e5')).toBe(false); // Can't move 2 squares that pawn
    expect(isValidMove(STARTING_FEN, 'Ke2')).toBe(false); // King can't move there
    expect(isValidMove(STARTING_FEN, 'xyz')).toBe(false); // Invalid notation
  });

  it('returns false for invalid FEN', () => {
    expect(isValidMove('invalid', 'e4')).toBe(false);
  });

  it('respects turn', () => {
    const blackToMove = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';
    expect(isValidMove(blackToMove, 'e5')).toBe(true); // Black can play e5
    expect(isValidMove(blackToMove, 'd4')).toBe(false); // White's move, not valid
  });
});

describe('getLegalMoves', () => {
  it('returns 20 legal moves from starting position', () => {
    const moves = getLegalMoves(STARTING_FEN);
    expect(moves.length).toBe(20); // 16 pawn moves + 4 knight moves
  });

  it('returns moves with correct structure', () => {
    const moves = getLegalMoves(STARTING_FEN);
    const e4Move = moves.find((m) => m.san === 'e4');
    expect(e4Move).toBeDefined();
    expect(e4Move?.from).toBe('e2');
    expect(e4Move?.to).toBe('e4');
  });

  it('returns empty array for invalid FEN', () => {
    expect(getLegalMoves('invalid')).toEqual([]);
  });

  it('returns empty array for checkmate position', () => {
    // Fool's mate position - black is checkmated
    const checkmate = 'rnb1kbnr/pppp1ppp/4p3/8/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3';
    expect(getLegalMoves(checkmate)).toEqual([]);
  });
});

describe('makeMove', () => {
  it('returns new FEN after valid move', () => {
    const newFen = makeMove(STARTING_FEN, 'e4');
    // chess.js may or may not include en passant square depending on version
    expect(newFen).toMatch(/^rnbqkbnr\/pppppppp\/8\/8\/4P3\/8\/PPPP1PPP\/RNBQKBNR b KQkq (e3|-) 0 1$/);
  });

  it('returns null for invalid move', () => {
    expect(makeMove(STARTING_FEN, 'e5')).toBeNull();
    expect(makeMove(STARTING_FEN, 'xyz')).toBeNull();
  });

  it('returns null for invalid FEN', () => {
    expect(makeMove('invalid', 'e4')).toBeNull();
  });

  it('chains moves correctly', () => {
    let fen: string | null = STARTING_FEN;
    fen = makeMove(fen, 'e4');
    expect(fen).not.toBeNull();
    fen = makeMove(fen!, 'e5');
    expect(fen).not.toBeNull();
    fen = makeMove(fen!, 'Nf3');
    expect(fen).not.toBeNull();
    expect(getTurn(fen!)).toBe('b');
    expect(getFullMoveNumber(fen!)).toBe(2);
  });
});

describe('createPositionFromFEN', () => {
  it('returns Chess instance for valid FEN', () => {
    const chess = createPositionFromFEN(STARTING_FEN);
    expect(chess).not.toBeNull();
    expect(chess?.fen()).toBe(STARTING_FEN);
  });

  it('returns null for invalid FEN', () => {
    expect(createPositionFromFEN('invalid')).toBeNull();
    expect(createPositionFromFEN('')).toBeNull();
  });
});

describe('getMoveSAN', () => {
  it('returns SAN for valid move coordinates', () => {
    expect(getMoveSAN(STARTING_FEN, 'e2', 'e4')).toBe('e4');
    expect(getMoveSAN(STARTING_FEN, 'g1', 'f3')).toBe('Nf3');
  });

  it('returns null for invalid move', () => {
    expect(getMoveSAN(STARTING_FEN, 'e2', 'e5')).toBeNull(); // Can't jump 3 squares
    expect(getMoveSAN(STARTING_FEN, 'a1', 'a3')).toBeNull(); // Rook blocked
  });

  it('returns null for invalid FEN', () => {
    expect(getMoveSAN('invalid', 'e2', 'e4')).toBeNull();
  });

  it('handles promotion', () => {
    const promoFen = '8/P7/8/8/8/8/8/4K2k w - - 0 1';
    // May include check symbol if the promotion gives check
    expect(getMoveSAN(promoFen, 'a7', 'a8', 'q')).toMatch(/^a8=Q\+?$/);
    expect(getMoveSAN(promoFen, 'a7', 'a8', 'n')).toBe('a8=N');
  });
});

describe('ensureFullFEN', () => {
  it('leaves a complete 6-field FEN untouched', () => {
    expect(ensureFullFEN(STARTING_FEN)).toBe(STARTING_FEN);
  });

  it('appends "0 1" to a 4-field FEN (short FEN)', () => {
    const short = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -';
    expect(ensureFullFEN(short)).toBe(`${short} 0 1`);
  });

  it('appends "0 1" to a 5-field FEN (boundary: still < 6 fields)', () => {
    const five = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0';
    // length === 5 → >= 4 branch → append "0 1"
    expect(ensureFullFEN(five)).toBe(`${five} 0 1`);
  });

  it('returns the input unchanged when it has fewer than 4 fields', () => {
    const board = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w';
    expect(ensureFullFEN(board)).toBe(board);
  });
});

describe('getMainlineFEN', () => {
  // 1.e4 (mainline) with a 1.d4 sibling, then 1...e5 etc.
  const fenE4 = makeMove(STARTING_FEN, 'e4')!;
  const fenD4 = makeMove(STARTING_FEN, 'd4')!;
  const fenE4E5 = makeMove(fenE4, 'e5')!;

  it('returns the root FEN (full) when the root has no children', () => {
    const root = node({ fen: getShortFEN(STARTING_FEN) });
    // Short FEN gets completed to a full FEN.
    expect(getMainlineFEN(root)).toBe(`${getShortFEN(STARTING_FEN)} 0 1`);
  });

  it('prefers the child flagged isMainLine over the first child', () => {
    const root = node({
      children: [
        node({ id: 'd4', fen: fenD4, move: 'd4', colorToMove: 'b' }),
        node({ id: 'e4', fen: fenE4, move: 'e4', colorToMove: 'b', isMainLine: true }),
      ],
    });
    expect(getMainlineFEN(root, 1)).toBe(fenE4);
  });

  it('falls back to the first child when none is flagged isMainLine', () => {
    const root = node({
      children: [
        node({ id: 'd4', fen: fenD4, move: 'd4', colorToMove: 'b' }),
        node({ id: 'e4', fen: fenE4, move: 'e4', colorToMove: 'b' }),
      ],
    });
    expect(getMainlineFEN(root, 1)).toBe(fenD4);
  });

  it('stops at maxDepth half-moves', () => {
    const e5 = node({ id: 'e5', fen: fenE4E5, move: 'e5', colorToMove: 'w' });
    const e4 = node({ id: 'e4', fen: fenE4, move: 'e4', colorToMove: 'b', children: [e5] });
    const root = node({ children: [e4] });
    // maxDepth 1 → stop after 1.e4, do not descend to 1...e5.
    expect(getMainlineFEN(root, 1)).toBe(fenE4);
    // maxDepth 2 → descend through both half-moves.
    expect(getMainlineFEN(root, 2)).toBe(fenE4E5);
  });

  it('stops early when a node runs out of children before maxDepth', () => {
    const e4 = node({ id: 'e4', fen: fenE4, move: 'e4', colorToMove: 'b' });
    const root = node({ children: [e4] });
    // Only one half-move available even though maxDepth is 6.
    expect(getMainlineFEN(root, 6)).toBe(fenE4);
  });
});

describe('deriveChildMoveNumber', () => {
  // Canonical convention (matches backend deriveMoveNumber / PGN parser / templates):
  // root = 0, white move = parent + 1, black move = parent.
  // colorToMove is the side to move *at the parent* (the side playing the child).

  it('numbers the first white move (e4) as 1 from a root of 0', () => {
    // root: White to move, moveNumber 0
    expect(deriveChildMoveNumber(0, 'w')).toBe(1);
  });

  it('numbers black replies (e5) the same as the preceding white move', () => {
    // after e4: e4 node has moveNumber 1, Black to move
    expect(deriveChildMoveNumber(1, 'b')).toBe(1);
  });

  it('increments to the next full move for the second white move (Nf3)', () => {
    // after e4 e5: e5 node has moveNumber 1, White to move
    expect(deriveChildMoveNumber(1, 'w')).toBe(2);
  });

  it('matches the full 1. e4 e5 2. Nf3 Nc6 sequence', () => {
    const e4 = deriveChildMoveNumber(0, 'w'); // root: white to move
    expect(e4).toBe(1);
    const e5 = deriveChildMoveNumber(e4, 'b'); // e4: black to move
    expect(e5).toBe(1);
    const nf3 = deriveChildMoveNumber(e5, 'w'); // e5: white to move
    expect(nf3).toBe(2);
    const nc6 = deriveChildMoveNumber(nf3, 'b'); // Nf3: black to move
    expect(nc6).toBe(2);
  });
});

describe('formatNodeNotation', () => {
  // colorToMove is the side to move *after* this node's move:
  // a white move leaves Black to move ('b') -> single dot; a black move -> ellipsis.

  it('formats a white move with a single dot', () => {
    expect(formatNodeNotation(1, 'b', 'e4')).toBe('1. e4');
    expect(formatNodeNotation(2, 'b', 'Nf3')).toBe('2. Nf3');
  });

  it('formats a black move with an ellipsis', () => {
    expect(formatNodeNotation(1, 'w', 'c5')).toBe('1... c5');
    expect(formatNodeNotation(2, 'w', 'Nc6')).toBe('2... Nc6');
  });
});
