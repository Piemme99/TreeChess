import { fenAfter } from '../../../shared/utils/chess';
import type { MoveAnalysis } from '../../../types';

/**
 * Compute the FEN of the position before a given move was played.
 * Replays the game up to (but not including) the target move.
 */
export function computeParentFEN(moves: MoveAnalysis[], targetMove: MoveAnalysis): string {
  const moveIndex = moves.findIndex((m) => m === targetMove);
  return fenAfter(moves, moveIndex - 1);
}
