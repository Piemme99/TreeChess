import { Chess } from 'chess.js';
import { STARTING_FEN } from '../../../shared/utils/chess';
import type { MoveAnalysis } from '../../../types';

/**
 * Compute the FEN of the position before a given move was played.
 * Replays the game up to (but not including) the target move.
 */
export function computeParentFEN(moves: MoveAnalysis[], targetMove: MoveAnalysis): string {
  const moveIndex = moves.findIndex((m) => m === targetMove);
  if (moveIndex <= 0) return STARTING_FEN;

  const chess = new Chess();
  for (let i = 0; i < moveIndex; i++) {
    try {
      chess.move(moves[i].san);
    } catch {
      break;
    }
  }
  return chess.fen();
}
