import { STARTING_FEN, fenAfter, allFens, lastMoveAt } from '../../../shared/utils/chess';
import type { MoveAnalysis } from '../../../types';

// Re-export for backward compatibility
export { STARTING_FEN };

export function computeFEN(moves: MoveAnalysis[], upToIndex: number): string {
  return fenAfter(moves, upToIndex);
}

// Returns every FEN from the starting position up to (and including) upToIndex,
// in order — the path used to resolve the current opening name.
export function computeFENPath(moves: MoveAnalysis[], upToIndex: number): string[] {
  return allFens(moves).slice(0, upToIndex + 2);
}

export function getLastMove(moves: MoveAnalysis[], currentIndex: number): { from: string; to: string } | null {
  return lastMoveAt(moves, currentIndex);
}
