import { useEffect, useRef, useState } from 'react';
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

const PIECE_UNICODE: Record<string, string> = {
  'P': '♙', 'N': '♘', 'B': '♗', 'R': '♖', 'Q': '♕', 'K': '♔',
  'p': '♟', 'n': '♞', 'b': '♝', 'r': '♜', 'q': '♛', 'k': '♚'
};

const SQUARES = [
  'a8', 'b8', 'c8', 'd8', 'e8', 'f8', 'g8', 'h8',
  'a7', 'b7', 'c7', 'd7', 'e7', 'f7', 'g7', 'h7',
  'a6', 'b6', 'c6', 'd6', 'e6', 'f6', 'g6', 'h6',
  'a5', 'b5', 'c5', 'd5', 'e5', 'f5', 'g5', 'h5',
  'a4', 'b4', 'c4', 'd4', 'e4', 'f4', 'g4', 'h4',
  'a3', 'b3', 'c3', 'd3', 'e3', 'f3', 'g3', 'h3',
  'a2', 'b2', 'c2', 'd2', 'e2', 'f2', 'g2', 'h2',
  'a1', 'b1', 'c1', 'd1', 'e1', 'f1', 'g1', 'h1'
];

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1'];

export function ChessBoard({
  fen,
  onMove,
  onSquareClick,
  orientation = 'w',
  selectedSquare,
  possibleMoves = [],
  lastMove,
  width = 480
}: ChessBoardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [chess] = useState(() => new Chess(fen));

  useEffect(() => {
    try {
      chess.load(fen);
    } catch {
      // Ignore FEN load errors
    }
  }, [fen, chess]);

  useEffect(() => {
    drawBoard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fen, orientation, selectedSquare, possibleMoves, lastMove]);

  const getSquareColor = (square: string): string => {
    const file = square.charCodeAt(0) - 97;
    const rank = 8 - parseInt(square[1]);
    return (file + rank) % 2 === 0 ? '#779556' : '#ebecd0';
  };

  const getSquareXY = (square: string): { x: number; y: number } => {
    const file = square.charCodeAt(0) - 97;
    const rank = 8 - parseInt(square[1]);
    const isWhiteOrientation = orientation === 'w';
    const x = isWhiteOrientation ? file : 7 - file;
    const y = isWhiteOrientation ? rank : 7 - rank;
    return { x: x * (width / 8), y: y * (width / 8) };
  };

  const getSquareFromXY = (x: number, y: number): string => {
    const isWhiteOrientation = orientation === 'w';
    const fileIndex = isWhiteOrientation
      ? Math.floor(x / (width / 8))
      : 7 - Math.floor(x / (width / 8));
    const rankIndex = isWhiteOrientation
      ? 7 - Math.floor(y / (width / 8))
      : Math.floor(y / (width / 8));
    return `${FILES[fileIndex]}${RANKS[rankIndex]}`;
  };

  const getPieceAt = (square: string): string | null => {
    const board = chess.board();
    const file = square.charCodeAt(0) - 97;
    const rank = 8 - parseInt(square[1]);
    const piece = board[rank]?.[file];
    return piece ? piece.color + piece.type : null;
  };

  const drawBoard = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const squareSize = width / 8;

    ctx.clearRect(0, 0, width, width);

    for (const square of SQUARES) {
      const { x, y } = getSquareXY(square);
      const color = getSquareColor(square);

      ctx.fillStyle = color;
      ctx.fillRect(x, y, squareSize, squareSize);

      if (lastMove && (square === lastMove.from || square === lastMove.to)) {
        ctx.fillStyle = 'rgba(255, 255, 0, 0.3)';
        ctx.fillRect(x, y, squareSize, squareSize);
      }

      if (selectedSquare === square) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.fillRect(x, y, squareSize, squareSize);
      }

      if (possibleMoves.includes(square)) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.beginPath();
        ctx.arc(x + squareSize / 2, y + squareSize / 2, squareSize / 6, 0, Math.PI * 2);
        ctx.fill();
      }

      const piece = getPieceAt(square);
      if (piece) {
        const colorPrefix = piece[0] === 'w' ? 'P' : 'p';
        const type = piece[1].toUpperCase();
        const pieceStr = colorPrefix + type;
        ctx.font = `${squareSize * 0.8}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = piece[0] === 'w' ? '#ffffff' : '#000000';
        ctx.fillText(PIECE_UNICODE[pieceStr], x + squareSize / 2, y + squareSize / 2);
      }

      if (['a1', 'a8'].includes(square)) {
        ctx.font = '12px sans-serif';
        ctx.fillStyle = square[1] === '8' ? '#000000' : '#ffffff';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(square[0], x + 2, square[1] === '8' ? 2 : y + squareSize - 14);
      }
    }
  };

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const square = getSquareFromXY(x, y);

    if (selectedSquare && possibleMoves.includes(square)) {
      try {
        const move = chess.move({ from: selectedSquare, to: square, promotion: 'q' });
        if (move) {
          onMove(move.san);
        }
      } catch {
        // Ignore invalid move errors
      }
    } else {
      const piece = getPieceAt(square);
      if (piece && piece[0] === (orientation === 'w' ? 'w' : 'b')) {
        onSquareClick?.(square);
      }
    }
  };

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={width}
      onClick={handleClick}
      style={{ cursor: 'pointer', borderRadius: '4px' }}
    />
  );
}
