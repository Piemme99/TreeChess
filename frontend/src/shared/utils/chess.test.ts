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
  getMoveSAN
} from './chess';

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
