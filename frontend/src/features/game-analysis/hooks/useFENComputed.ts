import { useMemo } from 'react';
import { computeFEN, getLastMove, STARTING_FEN } from '../utils/fenCalculator';
import type { GameAnalysis } from '../../../types';

export function useFENComputed(game: GameAnalysis | null, currentMoveIndex: number) {
  const currentFEN = useMemo(() => {
    if (!game) return STARTING_FEN;
    return computeFEN(game.moves, currentMoveIndex);
  }, [game, currentMoveIndex]);

  const lastMove = useMemo(() => {
    if (!game) return null;
    return getLastMove(game.moves, currentMoveIndex);
  }, [game, currentMoveIndex]);

  return { currentFEN, lastMove };
}