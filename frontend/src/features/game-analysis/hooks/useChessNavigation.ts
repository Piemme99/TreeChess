import { useState, useEffect, useCallback, useMemo } from 'react';
import type { GameAnalysis } from '../../../types';

const DEFAULT_OPENING_PLIES = 20;

export function useChessNavigation(
  game: GameAnalysis | null,
  showFullGame: boolean,
  initialPly?: number
) {
  const [currentMoveIndex, setCurrentMoveIndex] = useState(-1);
  const [initialPlyApplied, setInitialPlyApplied] = useState(false);

  // Apply initial ply when game loads (only once)
  useEffect(() => {
    if (!game) return;

    if (initialPly !== undefined && initialPly >= 0 && !initialPlyApplied) {
      // plyNumber is 0-indexed, same as move index
      setCurrentMoveIndex(initialPly);
      setInitialPlyApplied(true);
    } else if (!initialPlyApplied) {
      // No initial ply, reset to start
      setCurrentMoveIndex(-1);
      setInitialPlyApplied(true);
    }
  }, [game, initialPly, initialPlyApplied]);

  const maxDisplayedMoveIndex = useMemo(() => {
    if (!game) return -1;
    if (showFullGame) return game.moves.length - 1;
    return Math.min(DEFAULT_OPENING_PLIES - 1, game.moves.length - 1);
  }, [game, showFullGame]);

  const hasMoreMoves = useMemo(() => {
    if (!game) return false;
    return game.moves.length > DEFAULT_OPENING_PLIES;
  }, [game]);

  const goToMove = useCallback((index: number) => {
    if (!game) return;
    setCurrentMoveIndex(Math.max(-1, Math.min(index, maxDisplayedMoveIndex)));
  }, [game, maxDisplayedMoveIndex]);

  const goFirst = useCallback(() => goToMove(-1), [goToMove]);
  const goPrev = useCallback(() => goToMove(currentMoveIndex - 1), [goToMove, currentMoveIndex]);
  const goNext = useCallback(() => goToMove(currentMoveIndex + 1), [goToMove, currentMoveIndex]);
  const goLast = useCallback(() => goToMove(maxDisplayedMoveIndex), [goToMove, maxDisplayedMoveIndex]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
      return;
    }

    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        goPrev();
        break;
      case 'ArrowRight':
        e.preventDefault();
        goNext();
        break;
      case 'Home':
        e.preventDefault();
        goFirst();
        break;
      case 'End':
        e.preventDefault();
        goLast();
        break;
    }
  }, [goFirst, goPrev, goNext, goLast]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return {
    currentMoveIndex,
    maxDisplayedMoveIndex,
    hasMoreMoves,
    goToMove,
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