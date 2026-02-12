import { useState, useEffect, useRef, type RefObject } from 'react';

interface UseResizableSplitResult {
  boardWidthPercent: number;
  isDragging: boolean;
  containerRef: RefObject<HTMLDivElement>;
  startDragging: () => void;
}

/**
 * Manages a resizable horizontal split between two panels.
 * Tracks pointer events globally while dragging to allow smooth resizing
 * even when the cursor moves outside the handle.
 */
export function useResizableSplit(initialPercent = 50): UseResizableSplitResult {
  const [boardWidthPercent, setBoardWidthPercent] = useState(initialPercent);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null!);

  useEffect(() => {
    if (!isDragging) return;
    const handlePointerMove = (e: PointerEvent) => {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const percent = ((e.clientX - rect.left) / rect.width) * 100;
      setBoardWidthPercent(Math.min(75, Math.max(25, percent)));
    };
    const handlePointerUp = () => setIsDragging(false);
    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', handlePointerUp);
    return () => {
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);
    };
  }, [isDragging]);

  return {
    boardWidthPercent,
    isDragging,
    containerRef,
    startDragging: () => setIsDragging(true),
  };
}
