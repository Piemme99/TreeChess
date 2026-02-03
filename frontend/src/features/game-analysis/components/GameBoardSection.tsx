import { useRef, useState, useEffect, useMemo } from 'react';
import { ChessBoard } from '../../../shared/components/Board/ChessBoard';
import { Button } from '../../../shared/components/UI';
import { EvalBar } from '../../repertoire/edit/components/EvalBar';
import type { EngineEvaluation } from '../../../types';

export interface GameBoardSectionProps {
  fen: string;
  orientation: 'white' | 'black';
  lastMove?: { from: string; to: string } | null;
  onFlip: () => void;
  engineEvaluation?: EngineEvaluation | null;
}

export function GameBoardSection({ fen, orientation, lastMove, onFlip, engineEvaluation }: GameBoardSectionProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [boardSize, setBoardSize] = useState(350);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const obs = new ResizeObserver((entries) => {
      const { width } = entries[0].contentRect;
      setBoardSize(Math.floor(Math.min(width, 700)));
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const bestMoveArrow = useMemo<[string, string, string?][]>(() => {
    if (engineEvaluation?.bestMoveFrom && engineEvaluation?.bestMoveTo) {
      return [[engineEvaluation.bestMoveFrom, engineEvaluation.bestMoveTo, 'rgba(230, 126, 34, 0.6)']];
    }
    return [];
  }, [engineEvaluation?.bestMoveFrom, engineEvaluation?.bestMoveTo]);

  return (
    <div className="flex flex-col gap-2 shrink-0 max-md:items-center max-md:w-full min-w-[700px] max-md:min-w-0">
      <div className="flex items-stretch gap-1">
        <EvalBar score={engineEvaluation?.score} mate={engineEvaluation?.mate} fen={fen} />
        <div ref={wrapperRef} className="w-[700px]">
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
      <Button
        variant="secondary"
        size="sm"
        onClick={onFlip}
        className="self-center"
      >
        Flip Board
      </Button>
    </div>
  );
}
