import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { GameAnalysis } from '../../../types';

const DEFAULT_OPENING_PLIES = 20;

export function useChessNavigation(
  game: GameAnalysis | null,
  showFullGame: boolean,
  initialPly?: number
) {
  const [currentMoveIndex, setCurrentMoveIndex] = useState(-1);
  // Tracks the gameIndex we last positioned, so stepping to another game in the
  // same analyse-session resets the cursor instead of keeping the prior one.
  const positionedGameRef = useRef<number | null>(null);

  // Position the cursor once per game. The initial ply (e.g. a "worst mistake"
  // deep link) applies only to the first game shown; navigating to another game
  // in the session starts at the beginning.
  useEffect(() => {
    if (!game) return;
    if (positionedGameRef.current === game.gameIndex) return;

    const isFirstGame = positionedGameRef.current === null;
    positionedGameRef.current = game.gameIndex;

    if (isFirstGame && initialPly !== undefined && initialPly >= 0) {
      // plyNumber is 0-indexed, same as move index
      setCurrentMoveIndex(initialPly);
    } else {
      setCurrentMoveIndex(-1);
    }
  }, [game, initialPly]);

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