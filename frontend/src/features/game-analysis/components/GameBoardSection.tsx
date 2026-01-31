import { ChessBoard } from '../../../shared/components/Board/ChessBoard';
import { Button } from '../../../shared/components/UI';

export interface GameBoardSectionProps {
  fen: string;
  orientation: 'white' | 'black';
  lastMove?: { from: string; to: string } | null;
  onFlip: () => void;
}

export function GameBoardSection({ fen, orientation, lastMove, onFlip }: GameBoardSectionProps) {
  return (
    <div className="flex flex-col gap-2 shrink-0 max-md:items-center">
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
        className="self-center"
      >
        Flip Board
      </Button>
    </div>
  );
}
