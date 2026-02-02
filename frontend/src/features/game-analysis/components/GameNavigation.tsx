import { memo } from 'react';

export interface GameNavigationProps {
  currentMoveIndex: number;
  maxDisplayedMoveIndex: number;
  goFirst: () => void;
  goPrev: () => void;
  goNext: () => void;
  goLast: () => void;
}

const navBtnClass = 'w-9 h-9 flex items-center justify-center rounded-md text-lg text-text-muted bg-transparent border-none cursor-pointer transition-colors duration-150 hover:not-disabled:bg-bg hover:not-disabled:text-text disabled:opacity-30 disabled:cursor-default';

export const GameNavigation = memo(function GameNavigation({
  currentMoveIndex,
  maxDisplayedMoveIndex,
  goFirst,
  goPrev,
  goNext,
  goLast
}: GameNavigationProps) {
  return (
    <div className="flex items-center justify-center gap-2 py-3 mt-4">
      <button className={navBtnClass} onClick={goFirst} disabled={currentMoveIndex === -1}>
        ⟪
      </button>
      <button className={navBtnClass} onClick={goPrev} disabled={currentMoveIndex === -1}>
        ⟨
      </button>
      <span className="font-mono text-sm text-text-muted min-w-[120px] text-center">
        Move {currentMoveIndex + 1} / {maxDisplayedMoveIndex + 1}
      </span>
      <button className={navBtnClass} onClick={goNext} disabled={currentMoveIndex >= maxDisplayedMoveIndex}>
        ⟩
      </button>
      <button className={navBtnClass} onClick={goLast} disabled={currentMoveIndex >= maxDisplayedMoveIndex}>
        ⟫
      </button>
    </div>
  );
});
