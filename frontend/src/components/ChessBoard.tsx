import { useState, useCallback } from 'react';
import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.js';

interface ChessBoardProps {
  fen: string;
  onMove: (san: string) => void;
  onSquareClick?: (square: string) => void;
  orientation?: 'w' | 'b';
  selectedSquare?: string | null;
  possibleMoves?: string[];
  lastMove?: { from: string; to: string } | null;
  width?: number;
}

export function ChessBoard({
  fen,
  onMove,
  onSquareClick,
  orientation = 'w',
  selectedSquare,
  possibleMoves = [],
  width = 480
}: ChessBoardProps) {
  const [game, setGame] = useState(() => new Chess(fen));

  const onPieceDrop = useCallback((sourceSquare: string, targetSquare: string) => {
    try {
      const move = game.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: 'q'
      });
      if (move) {
        onMove(move.san);
        setGame(new Chess(game.fen()));
        return true;
      }
    } catch {
    }
    return false;
  }, [game, onMove]);

  return (
    <div style={{ width, height: width }}>
      <Chessboard
        position={fen}
        onPieceDrop={onPieceDrop}
        onSquareClick={onSquareClick}
        boardOrientation={orientation}
        boardWidth={width}
        customSquareStyles={{
          ...(selectedSquare && {
            [selectedSquare]: { backgroundColor: 'rgba(255, 255, 0, 0.3)' }
          }),
          ...possibleMoves.reduce((acc, square) => ({
            ...acc,
            [square]: {
              backgroundImage: 'radial-gradient(circle, rgba(0,0,0,0.2) 20%, transparent 20%)',
              backgroundSize: '30%',
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat'
            }
          }), {})
        }}
        animationDuration={200}
      />
    </div>
  );
}
