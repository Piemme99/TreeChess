import type { GameAnalysis } from '../../../types';

/**
 * Number of opponent-new / out-of-repertoire moves in a game — the
 * "needs attention" signal surfaced as a badge in the session navigation.
 */
export function countDivergences(game: GameAnalysis): number {
  return game.moves.filter(
    (m) => m.status === 'opponent-new' || m.status === 'out-of-repertoire'
  ).length;
}
