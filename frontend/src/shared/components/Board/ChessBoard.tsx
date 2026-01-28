import { useState, useCallback, useEffect, useMemo } from 'react';
import { Chessboard } from 'react-chessboard';
import { Chess, Square } from 'chess.js';

interface ChessBoardProps {
  fen: string;
  onMove?: (move: { from: string; to: string; san: string; promotion?: string }) => void;
  onSquareClick?: (square: string) => void;
  interactive?: boolean;
  orientation?: 'white' | 'black';
  highlightSquares?: string[];
  lastMove?: { from: string; to: string } | null;
  width?: number;
  bestMoveFrom?: string;
  bestMoveTo?: string;
}

export function ChessBoard({
  fen,
  onMove,
  onSquareClick,
  interactive = true,
  orientation = 'white',
  highlightSquares = [],
  lastMove,
  width = 400,
  bestMoveFrom,
  bestMoveTo
}: ChessBoardProps) {
  const [game, setGame] = useState(() => {
    try {
      return new Chess(fen);
    } catch {
      return new Chess();
    }
  });
  const [internalSelectedSquare, setInternalSelectedSquare] = useState<Square | null>(null);
  const [legalMoves, setLegalMoves] = useState<Square[]>([]);

  useEffect(() => {
    try {
      const newGame = new Chess(fen);
      setGame(newGame);
      setInternalSelectedSquare(null);
      setLegalMoves([]);
    } catch {
      console.error('Invalid FEN:', fen);
    }
  }, [fen]);

  const getLegalMovesForSquare = useCallback((square: Square) => {
    const moves = game.moves({ square, verbose: true });
    return moves.map((m) => m.to as Square);
  }, [game]);

  const handleSquareClick = useCallback((square: Square) => {
    if (onSquareClick) {
      onSquareClick(square);
      return;
    }
    if (!interactive) return;

    if (internalSelectedSquare && legalMoves.includes(square)) {
      try {
        const move = game.move({
          from: internalSelectedSquare,
          to: square,
          promotion: 'q'
        });
        if (move && onMove) {
          onMove({
            from: move.from,
            to: move.to,
            san: move.san,
            promotion: move.promotion
          });
        }
      } catch {
        // Invalid move - silently ignore
      }
      setInternalSelectedSquare(null);
      setLegalMoves([]);
      return;
    }

    const piece = game.get(square);
    if (piece && piece.color === game.turn()) {
      if (internalSelectedSquare === square) {
        setInternalSelectedSquare(null);
        setLegalMoves([]);
      } else {
        setInternalSelectedSquare(square);
        setLegalMoves(getLegalMovesForSquare(square));
      }
    } else {
      setInternalSelectedSquare(null);
      setLegalMoves([]);
    }
  }, [game, interactive, internalSelectedSquare, legalMoves, onMove, onSquareClick, getLegalMovesForSquare]);

  const handlePieceDrop = useCallback(
    (sourceSquare: string, targetSquare: string): boolean => {
      if (!interactive) return false;

      try {
        const move = game.move({
          from: sourceSquare as Square,
          to: targetSquare as Square,
          promotion: 'q'
        });
        if (move && onMove) {
          onMove({
            from: move.from,
            to: move.to,
            san: move.san,
            promotion: move.promotion
          });
        }
        setInternalSelectedSquare(null);
        setLegalMoves([]);
        return !!move;
      } catch {
        return false;
      }
    },
    [game, interactive, onMove]
  );

  const customSquareStyles = useMemo(() => {
    const styles: Record<string, React.CSSProperties> = {};

    if (internalSelectedSquare) {
      styles[internalSelectedSquare] = {
        backgroundColor: 'rgba(255, 255, 0, 0.5)'
      };
    }

    highlightSquares.forEach((square) => {
      const piece = game.get(square as Square);
      styles[square] = {
        ...styles[square],
        background: piece
          ? 'radial-gradient(circle, rgba(255, 0, 0, 0.4) 85%, transparent 85%)'
          : 'radial-gradient(circle, rgba(0, 0, 0, 0.2) 25%, transparent 25%)',
        borderRadius: '50%'
      };
    });

    if (lastMove) {
      styles[lastMove.from] = {
        ...styles[lastMove.from],
        backgroundColor: 'rgba(155, 199, 0, 0.4)'
      };
      styles[lastMove.to] = {
        ...styles[lastMove.to],
        backgroundColor: 'rgba(155, 199, 0, 0.4)'
      };
    }

    highlightSquares.forEach((square) => {
      styles[square] = {
        ...styles[square],
        boxShadow: 'inset 0 0 0 3px rgba(66, 133, 244, 0.8)'
      };
    });

    if (bestMoveFrom && bestMoveTo) {
      styles[bestMoveFrom] = {
        ...styles[bestMoveFrom],
        boxShadow: 'inset 0 0 0 4px #2196f3'
      };
      styles[bestMoveTo] = {
        ...styles[bestMoveTo],
        boxShadow: 'inset 0 0 0 4px #2196f3'
      };
    }

    return styles;
  }, [game, internalSelectedSquare, highlightSquares, lastMove, bestMoveFrom, bestMoveTo]);

  return (
    <div className="chessboard-wrapper" style={{ width }}>
      <Chessboard
        position={fen}
        onSquareClick={handleSquareClick}
        onPieceDrop={handlePieceDrop}
        boardOrientation={orientation}
        boardWidth={width}
        customSquareStyles={customSquareStyles}
        animationDuration={200}
        arePiecesDraggable={interactive}
        isDraggablePiece={() => interactive}
      />
    </div>
  );
}
