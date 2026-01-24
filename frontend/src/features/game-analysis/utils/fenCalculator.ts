import { Chess } from 'chess.js';
import type { MoveAnalysis } from '../../../types';

export const STARTING_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export function computeFEN(moves: MoveAnalysis[], upToIndex: number): string {
  if (upToIndex < 0) return STARTING_FEN;

  const chess = new Chess();
  for (let i = 0; i <= upToIndex && i < moves.length; i++) {
    try {
      chess.move(moves[i].san);
    } catch {
      console.error('Invalid move:', moves[i].san);
      break;
    }
  }
  return chess.fen();
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