import { ChessBoard } from '../../../shared/components/Board/ChessBoard';
import { Button } from '../../../shared/components/UI';

export interface GameBoardSectionProps {
  fen: string;
  orientation: 'white' | 'black';
  lastMove?: { from: string; to: string } | null;
  flipped: boolean;
  onFlip: () => void;
}

export function GameBoardSection({ fen, orientation, lastMove, onFlip }: GameBoardSectionProps) {
  return (
    <div className="game-analysis-board-section">
      <ChessBoard
        fen={fen}
        orientation={orientation}
        interactive={false}
        lastMove={lastMove}
        width={350}
      />
      <Button
        variant="secondary"
        size="sm"
        onClick={onFlip}
        className="flip-board-btn"
      >
        Flip Board
      </Button>
    </div>
  );
}