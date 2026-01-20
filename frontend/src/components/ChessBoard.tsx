import { useEffect, useRef } from 'react';
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

const PIECE_SVGS: Record<string, string> = {
  'P': '<svg viewBox="0 0 45 45" xmlns="http://www.w3.org/2000/svg"><path d="M22.5 9c-2.21 0-4 1.79-4 4 0 .89.29 1.71.78 2.38C17.33 16.5 16 18.59 16 21c0 2.03.94 3.84 2.41 5.03-3 1.06-7.41 5.55-7.41 13.47h23c0-8-4.41-12.41-7.41-13.47 1.47-1.19 2.41-3 2.41-5.03 0-2.41-1.33-4.5-3.28-5.62.49-.67.78-1.49.78-2.38 0-2.21-1.79-4-4-4z" fill="white" stroke="black" stroke-width="1.5"/></svg>',
  'N': '<svg viewBox="0 0 45 45" xmlns="http://www.w3.org/2000/svg"><path d="M22 10c-10.5 0-15 5.5-15 10 0 2.5 1.5 4.5 3 6-1.5 1-2 3-2 5 0 2.5 2 4.5 4.5 4.5h12c2.5 0 4.5-2 4.5-4.5 0-2-1-4-2-5 1.5-1.5 3-3.5 3-6 0-4.5-4.5-10-15-10z" fill="white" stroke="black" stroke-width="1.5"/><path d="M18 23h9" stroke="black" stroke-width="2"/><path d="M18 27h9" stroke="black" stroke-width="2"/></svg>',
  'B': '<svg viewBox="0 0 45 45" xmlns="http://www.w3.org/2000/svg"><path d="M22 10c-5 0-8 5-8 9 0 2.5 1.5 4.5 3 5.5-1.5 1-2 3-2 4.5 0 3 2 4.5 5 4.5h8c3 0 5-1.5 5-4.5 0-1.5-.5-3.5-2-4.5 1.5-1 3-3 3-5.5 0-4-3-9-8-9z" fill="white" stroke="black" stroke-width="1.5"/><circle cx="22" cy="19" r="3" fill="white" stroke="black"/></svg>',
  'R': '<svg viewBox="0 0 45 45" xmlns="http://www.w3.org/2000/svg"><rect x="9" y="12" width="27" height="5" fill="white" stroke="black" stroke-width="1.5"/><rect x="10" y="17" width="25" height="3" fill="white" stroke="black" stroke-width="1.5"/><rect x="11" y="20" width="23" height="2" fill="white" stroke="black" stroke-width="1.5"/><rect x="13" y="22" width="19" height="2" fill="white" stroke="black" stroke-width="1.5"/><path d="M11 24v10c0 2.5 2.5 4.5 5 4.5h13c2.5 0 5-2 5-4.5V24" fill="white" stroke="black" stroke-width="1.5"/></svg>',
  'Q': '<svg viewBox="0 0 45 45" xmlns="http://www.w3.org/2000/svg"><path d="M22 10c-4 0-7 3-7 7 0 2 1 3.5 2.5 4.5-1.5 1-2.5 3-2.5 5 0 2.5 2 4 4.5 4h9c2.5 0 4.5-1.5 4.5-4 0-2-1-4-2.5-5 1.5-1 2.5-2.5 2.5-4.5 0-4-3-7-7-7z" fill="white" stroke="black" stroke-width="1.5"/><circle cx="22" cy="18" r="2.5" fill="white" stroke="black"/><circle cx="22" cy="26" r="2.5" fill="white" stroke="black"/><circle cx="19" cy="22" r="2.5" fill="white" stroke="black"/><circle cx="25" cy="22" r="2.5" fill="white" stroke="black"/></svg>',
  'K': '<svg viewBox="0 0 45 45" xmlns="http://www.w3.org/2000/svg"><path d="M22 10c-4 0-7 3-7 7 0 2 1 3.5 2.5 4.5-1.5 1-2.5 3-2.5 5 0 2.5 2 4 4.5 4h9c2.5 0 4.5-1.5 4.5-4 0-2-1-4-2.5-5 1.5-1 2.5-2.5 2.5-4.5 0-4-3-7-7-7z" fill="white" stroke="black" stroke-width="1.5"/><path d="M18 24h14M22 24v12" stroke="black" stroke-width="2"/></svg>',
  'p': '<svg viewBox="0 0 45 45" xmlns="http://www.w3.org/2000/svg"><path d="M22.5 9c-2.21 0-4 1.79-4 4 0 .89.29 1.71.78 2.38C17.33 16.5 16 18.59 16 21c0 2.03.94 3.84 2.41 5.03-3 1.06-7.41 5.55-7.41 13.47h23c0-8-4.41-12.41-7.41-13.47 1.47-1.19 2.41-3 2.41-5.03 0-2.41-1.33-4.5-3.28-5.62.49-.67.78-1.49.78-2.38 0-2.21-1.79-4-4-4z" fill="black" stroke="white" stroke-width="1.5"/></svg>',
  'n': '<svg viewBox="0 0 45 45" xmlns="http://www.w3.org/2000/svg"><path d="M22 10c-10.5 0-15 5.5-15 10 0 2.5 1.5 4.5 3 6-1.5 1-2 3-2 5 0 2.5 2 4.5 4.5 4.5h12c2.5 0 4.5-2 4.5-4.5 0-2-1-4-2-5 1.5-1.5 3-3.5 3-6 0-4.5-4.5-10-15-10z" fill="black" stroke="white" stroke-width="1.5"/><path d="M18 23h9" stroke="white" stroke-width="2"/><path d="M18 27h9" stroke="white" stroke-width="2"/></svg>',
  'b': '<svg viewBox="0 0 45 45" xmlns="http://www.w3.org/2000/svg"><path d="M22 10c-5 0-8 5-8 9 0 2.5 1.5 4.5 3 5.5-1.5 1-2 3-2 4.5 0 3 2 4.5 5 4.5h8c3 0 5-1.5 5-4.5 0-1.5-.5-3.5-2-4.5 1.5-1 3-3 3-5.5 0-4-3-9-8-9z" fill="black" stroke="white" stroke-width="1.5"/><circle cx="22" cy="19" r="3" fill="black" stroke="white"/></svg>',
  'r': '<svg viewBox="0 0 45 45" xmlns="http://www.w3.org/2000/svg"><rect x="9" y="12" width="27" height="5" fill="black" stroke="white" stroke-width="1.5"/><rect x="10" y="17" width="25" height="3" fill="black" stroke="white" stroke-width="1.5"/><rect x="11" y="20" width="23" height="2" fill="black" stroke="white" stroke-width="1.5"/><rect x="13" y="22" width="19" height="2" fill="black" stroke="white" stroke-width="1.5"/><path d="M11 24v10c0 2.5 2.5 4.5 5 4.5h13c2.5 0 5-2 5-4.5V24" fill="black" stroke="white" stroke-width="1.5"/></svg>',
  'q': '<svg viewBox="0 0 45 45" xmlns="http://www.w3.org/2000/svg"><path d="M22 10c-4 0-7 3-7 7 0 2 1 3.5 2.5 4.5-1.5 1-2.5 3-2.5 5 0 2.5 2 4 4.5 4h9c2.5 0 4.5-1.5 4.5-4 0-2-1-4-2.5-5 1.5-1 2.5-2.5 2.5-4.5 0-4-3-7-7-7z" fill="black" stroke="white" stroke-width="1.5"/><circle cx="22" cy="18" r="2.5" fill="black" stroke="white"/><circle cx="22" cy="26" r="2.5" fill="black" stroke="white"/><circle cx="19" cy="22" r="2.5" fill="black" stroke="white"/><circle cx="25" cy="22" r="2.5" fill="black" stroke="white"/></svg>',
  'k': '<svg viewBox="0 0 45 45" xmlns="http://www.w3.org/2000/svg"><path d="M22 10c-4 0-7 3-7 7 0 2 1 3.5 2.5 4.5-1.5 1-2.5 3-2.5 5 0 2.5 2 4 4.5 4h9c2.5 0 4.5-1.5 4.5-4 0-2-1-4-2.5-5 1.5-1 2.5-2.5 2.5-4.5 0-4-3-7-7-7z" fill="black" stroke="white" stroke-width="1.5"/><path d="M18 24h14M22 24v12" stroke="white" stroke-width="2"/></svg>'
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
  const chessRef = useRef<Chess | null>(null);

  if (!chessRef.current) {
    chessRef.current = new Chess(fen);
  }

  useEffect(() => {
    try {
      chessRef.current?.load(fen);
    } catch {
    }
  }, [fen]);

  useEffect(() => {
    drawBoard();
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
    if (!chessRef.current) return null;
    const board = chessRef.current.board();
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
        const pieceKey = piece[1].toLowerCase();
        const svg = PIECE_SVGS[pieceKey];
        if (svg) {
          const img = new Image();
          const svgBlob = new Blob([svg], { type: 'image/svg+xml' });
          const url = URL.createObjectURL(svgBlob);
          
          img.onload = () => {
            const padding = squareSize * 0.1;
            ctx.drawImage(img, x + padding, y + padding, squareSize - padding * 2, squareSize - padding * 2);
            URL.revokeObjectURL(url);
          };
          img.src = url;
        }
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
        const move = chessRef.current?.move({ from: selectedSquare, to: square, promotion: 'q' });
        if (move) {
          onMove(move.san);
        }
      } catch {
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
