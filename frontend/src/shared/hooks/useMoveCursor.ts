import { useState, useEffect, useCallback } from 'react';

export interface MoveCursor {
  currentMoveIndex: number;
  /**
   * Sets the cursor without clamping. Intended for callers that reposition the
   * cursor in response to external state (e.g. a new game or a deep-link ply);
   * prefer `goToMove` for user-driven navigation.
   */
  setCurrentMoveIndex: (index: number) => void;
  goToMove: (index: number) => void;
  goFirst: () => void;
  goPrev: () => void;
  goNext: () => void;
  goLast: () => void;
}

interface MoveCursorOptions {
  /** Starting cursor position; defaults to -1 (before the first move). */
  initialIndex?: number;
  /**
   * Whether arrow/Home/End keys drive the cursor. Defaults to true. The listener
   * ignores key events originating from text inputs and textareas.
   */
  keyboard?: boolean;
}

/**
 * Move-list cursor with clamped navigation (`-1 .. maxIndex`) and optional
 * keyboard control (Arrow keys + Home/End). Shared by the game-analysis and
 * explorer-training review views so the navigation/keyboard logic lives in one
 * place.
 */
export function useMoveCursor(maxIndex: number, options: MoveCursorOptions = {}): MoveCursor {
  const { initialIndex = -1, keyboard = true } = options;
  const [currentMoveIndex, setCurrentMoveIndex] = useState(initialIndex);

  const goToMove = useCallback((index: number) => {
    setCurrentMoveIndex(Math.max(-1, Math.min(index, maxIndex)));
  }, [maxIndex]);

  const goFirst = useCallback(() => goToMove(-1), [goToMove]);
  const goPrev = useCallback(() => goToMove(currentMoveIndex - 1), [goToMove, currentMoveIndex]);
  const goNext = useCallback(() => goToMove(currentMoveIndex + 1), [goToMove, currentMoveIndex]);
  const goLast = useCallback(() => goToMove(maxIndex), [goToMove, maxIndex]);

  useEffect(() => {
    if (!keyboard) return;

    function handleKeyDown(e: KeyboardEvent) {
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
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [keyboard, goFirst, goPrev, goNext, goLast]);

  return { currentMoveIndex, setCurrentMoveIndex, goToMove, goFirst, goPrev, goNext, goLast };
}
