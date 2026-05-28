import { Chess } from 'chess.js';
import type { MoveAnalysis } from '../../../types';
import { STARTING_FEN } from '../../../shared/utils/chess';

// Re-export for backward compatibility
export { STARTING_FEN };

export function computeFEN(moves: MoveAnalysis[], upToIndex: number): string {
  if (upToIndex < 0) return STARTING_FEN;

  const chess = new Chess();
  for (let i = 0; i <= upToIndex && i < moves.length; i++) {
    try {
      chess.move(moves[i].san);
    } catch {
      break;
    }
  }
  return chess.fen();
}

// Returns every FEN from the starting position up to (and including) upToIndex,
// in order — the path used to resolve the current opening name.
export function computeFENPath(moves: MoveAnalysis[], upToIndex: number): string[] {
  const chess = new Chess();
  const path = [chess.fen()];
  for (let i = 0; i <= upToIndex && i < moves.length; i++) {
    try {
      chess.move(moves[i].san);
    } catch {
      break;
    }
    path.push(chess.fen());
  }
  return path;
}

export function getLastMove(moves: MoveAnalysis[], currentIndex: number): { from: string; to: string } | null {
  if (currentIndex < 0 || currentIndex >= moves.length) return null;

  const chess = new Chess();
  for (let i = 0; i <= currentIndex && i < moves.length; i++) {
    try {
      const move = chess.move(moves[i].san);
      if (i === currentIndex && move) {
        return { from: move.from, to: move.to };
      }
    } catch {
      break;
    }
  }
  return null;
}