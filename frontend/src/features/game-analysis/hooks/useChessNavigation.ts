import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useMoveCursor } from '../../../shared/hooks/useMoveCursor';
import type { GameAnalysis } from '../../../types';

const DEFAULT_OPENING_PLIES = 20;

export function useChessNavigation(
  game: GameAnalysis | null,
  showFullGame: boolean,
  initialPly?: number,
  analysisId?: string
) {
  const maxDisplayedMoveIndex = useMemo(() => {
    if (!game) return -1;
    if (showFullGame) return game.moves.length - 1;
    return Math.min(DEFAULT_OPENING_PLIES - 1, game.moves.length - 1);
  }, [game, showFullGame]);

  const cursor = useMoveCursor(maxDisplayedMoveIndex);
  const { currentMoveIndex, setCurrentMoveIndex, goToMove } = cursor;

  // Tracks the game we last positioned, keyed on a composite of analysisId and
  // gameIndex. gameIndex is only unique within a single import, so stepping
  // across analyses in an analyse-session (analysis A game 0 -> analysis B
  // game 0) would otherwise short-circuit the reset and open the new game at
  // the prior game's stale ply.
  const positionedGameRef = useRef<string | null>(null);

  // Position the cursor once per game. The initial ply (e.g. a "worst mistake"
  // deep link) applies only to the first game shown; navigating to another game
  // in the session starts at the beginning.
  useEffect(() => {
    if (!game) return;
    const gameKey = `${analysisId ?? ''}:${game.gameIndex}`;
    if (positionedGameRef.current === gameKey) return;

    const isFirstGame = positionedGameRef.current === null;
    positionedGameRef.current = gameKey;

    if (isFirstGame && initialPly !== undefined && initialPly >= 0) {
      // plyNumber is 0-indexed, same as move index
      setCurrentMoveIndex(initialPly);
    } else {
      setCurrentMoveIndex(-1);
    }
  }, [game, initialPly, analysisId, setCurrentMoveIndex]);

  const hasMoreMoves = useMemo(() => {
    if (!game) return false;
    return game.moves.length > DEFAULT_OPENING_PLIES;
  }, [game]);

  // Guard navigation while no game is loaded; otherwise delegate to the cursor.
  const guardedGoToMove = useCallback((index: number) => {
    if (!game) return;
    goToMove(index);
  }, [game, goToMove]);

  const goFirst = useCallback(() => guardedGoToMove(-1), [guardedGoToMove]);
  const goPrev = useCallback(() => guardedGoToMove(currentMoveIndex - 1), [guardedGoToMove, currentMoveIndex]);
  const goNext = useCallback(() => guardedGoToMove(currentMoveIndex + 1), [guardedGoToMove, currentMoveIndex]);
  const goLast = useCallback(() => guardedGoToMove(maxDisplayedMoveIndex), [guardedGoToMove, maxDisplayedMoveIndex]);

  return {
    currentMoveIndex,
    maxDisplayedMoveIndex,
    hasMoreMoves,
    goToMove: guardedGoToMove,
    goFirst,
    goPrev,
    goNext,
    goLast
  };
}

export function useToggleFullGame() {
  const [showFullGame, setShowFullGame] = useState(false);

  const toggleFullGame = useCallback(() => {
    setShowFullGame(prev => !prev);
  }, []);

  return { showFullGame, toggleFullGame };
}
