import { useCallback, useRef, useEffect, useState } from 'react';
import { ChessBoard } from '../../../shared/components/Board/ChessBoard';
import { ArrowLeft, ArrowUpDown } from 'lucide-react';

interface ExplorerTrainingBoardProps {
  fen: string;
  orientation: 'white' | 'black';
  interactive: boolean;
  lastMove: { from: string; to: string } | null;
  moveCount: number;
  onMove: (san: string, from: string, to: string) => void;
  onSwitchColor: () => void;
  onBack: () => void;
}

export function ExplorerTrainingBoard({
  fen,
  orientation,
  interactive,
  lastMove,
  moveCount,
  onMove,
  onSwitchColor,
  onBack,
}: ExplorerTrainingBoardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [boardSize, setBoardSize] = useState(400);

  useEffect(() => {
    function updateSize() {
      if (containerRef.current) {
        const width = containerRef.current.clientWidth;
        setBoardSize(Math.min(width - 16, 560));
      }
    }
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  const handleMove = useCallback(
    (move: { from: string; to: string; san: string }) => {
      onMove(move.san, move.from, move.to);
    },
    [onMove],
  );

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={onBack}
          className="p-2 rounded-xl border border-primary/10 bg-bg-card hover:bg-primary-light/50 text-text-muted hover:text-text transition-all duration-150 cursor-pointer"
          title="Back to selection"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 text-sm text-text-muted">
            <span>Move {Math.ceil(moveCount / 2) || 1}</span>
            <span className="text-text-muted/40">|</span>
            <span>Explorer Training</span>
          </div>
        </div>
      </div>

      {/* Board */}
      <div ref={containerRef} className="relative flex justify-center mb-4">
        <ChessBoard
          fen={fen}
          onMove={handleMove}
          interactive={interactive}
          orientation={orientation}
          lastMove={lastMove}
          width={boardSize}
        />
      </div>

      {/* Controls */}
      <div>
        <button
          onClick={onSwitchColor}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-primary/10 bg-bg-card hover:bg-primary-light/50 text-text-muted hover:text-text transition-all duration-150 cursor-pointer text-sm"
          title="Switch color"
        >
          <ArrowUpDown className="w-3.5 h-3.5" />
          <span>{orientation === 'white' ? 'White' : 'Black'}</span>
        </button>
      </div>
    </div>
  );
}
