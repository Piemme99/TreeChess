import { memo } from 'react';
import { Button } from '../../../shared/components/UI';

export interface GameNavigationProps {
  currentMoveIndex: number;
  maxDisplayedMoveIndex: number;
  goFirst: () => void;
  goPrev: () => void;
  goNext: () => void;
  goLast: () => void;
}

export const GameNavigation = memo(function GameNavigation({
  currentMoveIndex,
  maxDisplayedMoveIndex,
  goFirst,
  goPrev,
  goNext,
  goLast
}: GameNavigationProps) {
  return (
    <div className="flex items-center justify-center gap-4 p-4 bg-bg-card rounded-md mt-6">
      <Button variant="secondary" size="sm" onClick={goFirst} disabled={currentMoveIndex === -1}>
        ⟪
      </Button>
      <Button variant="secondary" size="sm" onClick={goPrev} disabled={currentMoveIndex === -1}>
        ⟨
      </Button>
      <span className="font-mono text-text-muted min-w-[120px] text-center">
        Move {currentMoveIndex + 1} / {maxDisplayedMoveIndex + 1}
      </span>
      <Button variant="secondary" size="sm" onClick={goNext} disabled={currentMoveIndex >= maxDisplayedMoveIndex}>
        ⟩
      </Button>
      <Button variant="secondary" size="sm" onClick={goLast} disabled={currentMoveIndex >= maxDisplayedMoveIndex}>
        ⟫
      </Button>
    </div>
  );
});
