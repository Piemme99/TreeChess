import { useRef, useState, useEffect } from 'react';
import { ChessBoard } from '../../../shared/components/Board/ChessBoard';
import { Button } from '../../../shared/components/UI';

export interface GameBoardSectionProps {
  fen: string;
  orientation: 'white' | 'black';
  lastMove?: { from: string; to: string } | null;
  onFlip: () => void;
}

export function GameBoardSection({ fen, orientation, lastMove, onFlip }: GameBoardSectionProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [boardSize, setBoardSize] = useState(350);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const obs = new ResizeObserver((entries) => {
      const { width } = entries[0].contentRect;
      setBoardSize(Math.floor(Math.min(width, 500)));
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div className="flex flex-col gap-2 shrink-0 max-md:items-center max-md:w-full">
      <div ref={wrapperRef} className="w-full max-w-[500px]">
        <ChessBoard
          fen={fen}
          orientation={orientation}
          interactive={false}
          lastMove={lastMove}
          width={boardSize}
        />
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
