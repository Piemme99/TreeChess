import { Chess, type Move } from 'chess.js';

export function createInitialPosition(): Chess {
  return new Chess();
}

export function createPositionFromFEN(fen: string): Chess | null {
  try {
    const chess = new Chess(fen);
    return chess;
  } catch {
    return null;
  }
}

export function getShortFEN(fullFEN: string): string {
  const parts = fullFEN.split(' ');
  if (parts.length >= 4) {
    return `${parts[0]} ${parts[1]} ${parts[2]} ${parts[3]}`;
  }
  return fullFEN;
}

export function isValidMove(fen: string, san: string): boolean {
  try {
    const chess = new Chess(fen);
    const move = chess.move(san);
    return move !== null;
  } catch {
    return false;
  }
}

export function getMoveSAN(fen: string, from: string, to: string, promotion?: string): string | null {
  try {
    const chess = new Chess(fen);
    const move = chess.move({
      from,
      to,
      promotion: promotion || 'q'
    });
    return move ? move.san : null;
  } catch {
    return null;
  }
}

export function getLegalMoves(fen: string): { from: string; to: string; san: string }[] {
  try {
    const chess = new Chess(fen);
    const moves: { from: string; to: string; san: string }[] = [];
    chess.moves({ verbose: true }).forEach((move: Move) => {
      if (move.from && move.to && move.san) {
        moves.push({ from: move.from, to: move.to, san: move.san });
      }
    });
    return moves;
  } catch {
    return [];
  }
}

export function makeMove(fen: string, san: string): string | null {
  try {
    const chess = new Chess(fen);
    const move = chess.move(san);
    if (move) {
      return chess.fen();
    }
    return null;
  } catch {
    return null;
  }
}

export function getTurn(fen: string): 'w' | 'b' {
  const parts = fen.split(' ');
  return parts[1] === 'w' ? 'w' : 'b';
}

export function getFullMoveNumber(fen: string): number {
  const parts = fen.split(' ');
  if (parts.length >= 6) {
    return parseInt(parts[5], 10);
  }
  return 1;
}

export function getMoveNumber(fen: string): number {
  const fullMoveNumber = getFullMoveNumber(fen);
  const turn = getTurn(fen);
  return turn === 'w' ? fullMoveNumber : fullMoveNumber;
}
