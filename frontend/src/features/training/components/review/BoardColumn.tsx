import { useState, useEffect, useMemo, useRef } from 'react';
import { ChessBoard } from '../../../../shared/components/Board/ChessBoard';
import { EvalBar } from '../../../repertoire/edit/components/EvalBar';
import { GameNavigation } from '../../../game-analysis/components/GameNavigation';
import { useEngine } from '../../../../shared/hooks/useEngine';

interface BoardColumnProps {
  fen: string;
  orientation: 'white' | 'black';
  lastMove: { from: string; to: string } | null;
  currentMoveIndex: number;
  maxIndex: number;
  goFirst: () => void;
  goPrev: () => void;
  goNext: () => void;
  goLast: () => void;
}

/** Board + eval bar + engine best-move arrow + navigation controls. */
export function BoardColumn({
  fen,
  orientation,
  lastMove,
  currentMoveIndex,
  maxIndex,
  goFirst,
  goPrev,
  goNext,
  goLast,
}: BoardColumnProps) {
  const boardWrapperRef = useRef<HTMLDivElement>(null);
  const [boardSize, setBoardSize] = useState(400);

  // Board sizing — responsive
  useEffect(() => {
    const el = boardWrapperRef.current;
    if (!el) return;
    const obs = new ResizeObserver((entries) => {
      const { width } = entries[0].contentRect;
      setBoardSize(Math.floor(Math.min(width, 560)));
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Stockfish analysis of the current position
  const engine = useEngine();

  useEffect(() => {
    engine.analyze(fen);
  }, [fen, engine]);

  const bestMoveArrow = useMemo<[string, string, string?][]>(() => {
    if (engine.currentEvaluation?.bestMoveFrom && engine.currentEvaluation?.bestMoveTo) {
      return [[engine.currentEvaluation.bestMoveFrom, engine.currentEvaluation.bestMoveTo, '#e67e22']];
    }
    return [];
  }, [engine.currentEvaluation?.bestMoveFrom, engine.currentEvaluation?.bestMoveTo]);

  return (
    <div className="flex flex-col gap-2 shrink-0 max-md:items-center max-md:w-full">
      <div className="flex items-stretch gap-1">
        <EvalBar
          score={engine.currentEvaluation?.score}
          mate={engine.currentEvaluation?.mate}
          fen={fen}
        />
        <div ref={boardWrapperRef} className="w-full max-w-[560px]">
          <ChessBoard
            fen={fen}
            orientation={orientation}
            interactive={false}
            lastMove={lastMove}
            width={boardSize}
            customArrows={bestMoveArrow}
          />
        </div>
      </div>
      <GameNavigation
        currentMoveIndex={currentMoveIndex}
        maxDisplayedMoveIndex={maxIndex}
        goFirst={goFirst}
        goPrev={goPrev}
        goNext={goNext}
        goLast={goLast}
      />
    </div>
  );
}
