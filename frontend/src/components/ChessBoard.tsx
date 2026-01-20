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

const PIECE_SVGS: Record<string, string> = {
  P: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><g fill="none" stroke="#000" stroke-width="2"><path d="M50 15c-10 0-18 8-18 18 0 5 3 10 8 14-5 3-8 8-8 14 0 6 5 11 12 11h4c7 0 12-5 12-11 0-6-3-11-8-14 5-4 8-9 8-14 0-10-8-18-18-18z" fill="#fff"/><circle cx="50" cy="52" r="8"/><path d="M30 65v10M70 65v10M50 70v8"/></g></svg>`,
  N: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><g fill="none" stroke="#000" stroke-width="2"><path d="M50 15c-15 0-25 10-25 22 0 6 4 11 8 15-6 4-10 10-10 17 0 8 7 13 14 13h30c7 0 14-5 14-13 0-7-4-13-10-17 4-4 8-9 8-15 0-12-10-22-25-22z" fill="#fff"/><path d="M35 50h30M50 50v25" stroke-width="3"/></g></svg>`,
  B: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><g fill="none" stroke="#000" stroke-width="2"><path d="M50 15c-12 0-20 12-20 22 0 7 5 12 9 15-6 4-10 10-10 18 0 8 6 12 14 12h24c8 0 14-4 14-12 0-8-4-14-10-18 4-3 9-8 9-15 0-10-8-22-20-22z" fill="#fff"/><circle cx="50" cy="45" r="6" fill="#fff"/><ellipse cx="50" cy="60" rx="12" ry="8" fill="#fff"/></g></svg>`,
  R: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><g fill="none" stroke="#000" stroke-width="2"><rect x="20" y="25" width="60" height="12" fill="#fff"/><rect x="23" y="37" width="54" height="6" fill="#fff"/><rect x="26" y="43" width="48" height="4" fill="#fff"/><path d="M30 47v25c0 8 8 12 20 12s20-4 20-12V47" fill="#fff"/><line x1="30" y1="55" x2="70" y2="55"/><line x1="35" y1="62" x2="65" y2="62"/><line x1="40" y1="69" x2="60" y2="69"/></g></svg>`,
  Q: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><g fill="none" stroke="#000" stroke-width="2"><path d="M50 15c-10 0-18 10-18 20 0 6 4 11 9 14-5 4-9 10-9 17 0 7 6 11 14 11h20c8 0 14-4 14-11 0-7-4-13-9-17 5-3 9-8 9-14 0-10-8-20-18-20z" fill="#fff"/><circle cx="50" cy="40" r="5" fill="#fff"/><circle cx="35" cy="50" r="5" fill="#fff"/><circle cx="65" cy="50" r="5" fill="#fff"/><circle cx="50" cy="60" r="5" fill="#fff"/><circle cx="35" cy="70" r="5" fill="#fff"/><circle cx="65" cy="70" r="5" fill="#fff"/></g></svg>`,
  K: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><g fill="none" stroke="#000" stroke-width="2"><path d="M50 15c-10 0-18 10-18 20 0 6 4 11 9 14-5 4-9 10-9 17 0 7 6 11 14 11h20c8 0 14-4 14-11 0-7-4-13-9-17 5-3 9-8 9-14 0-10-8-20-18-20z" fill="#fff"/><path d="M35 50h30M42 50v20M58 50v20M50 50v25" stroke-width="3"/></g></svg>`,
  p: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><g fill="none" stroke="#000" stroke-width="2"><path d="M50 15c-10 0-18 8-18 18 0 5 3 10 8 14-5 3-8 8-8 14 0 6 5 11 12 11h4c7 0 12-5 12-11 0-6-3-11-8-14 5-4 8-9 8-14 0-10-8-18-18-18z" fill="#000"/><circle cx="50" cy="52" r="8" fill="#000"/><path d="M30 65v10M70 65v10M50 70v8"/></g></svg>`,
  n: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><g fill="none" stroke="#000" stroke-width="2"><path d="M50 15c-15 0-25 10-25 22 0 6 4 11 8 15-6 4-10 10-10 17 0 8 7 13 14 13h30c7 0 14-5 14-13 0-7-4-13-10-17 4-4 8-9 8-15 0-12-10-22-25-22z" fill="#000"/><path d="M35 50h30M50 50v25" stroke-width="3" stroke="#000"/></g></svg>`,
  b: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><g fill="none" stroke="#000" stroke-width="2"><path d="M50 15c-12 0-20 12-20 22 0 7 5 12 9 15-6 4-10 10-10 18 0 8 6 12 14 12h24c8 0 14-4 14-12 0-8-4-14-10-18 4-3 9-8 9-15 0-10-8-22-20-22z" fill="#000"/><circle cx="50" cy="45" r="6" fill="#000"/><ellipse cx="50" cy="60" rx="12" ry="8" fill="#000"/></g></svg>`,
  r: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><g fill="none" stroke="#000" stroke-width="2"><rect x="20" y="25" width="60" height="12" fill="#000"/><rect x="23" y="37" width="54" height="6" fill="#000"/><rect x="26" y="43" width="48" height="4" fill="#000"/><path d="M30 47v25c0 8 8 12 20 12s20-4 20-12V47" fill="#000"/><line x1="30" y1="55" x2="70" y2="55"/><line x1="35" y1="62" x2="65" y2="62"/><line x1="40" y1="69" x2="60" y2="69"/></g></svg>`,
  q: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><g fill="none" stroke="#000" stroke-width="2"><path d="M50 15c-10 0-18 10-18 20 0 6 4 11 9 14-5 4-9 10-9 17 0 7 6 11 14 11h20c8 0 14-4 14-11 0-7-4-13-9-17 5-3 9-8 9-14 0-10-8-20-18-20z" fill="#000"/><circle cx="50" cy="40" r="5" fill="#000"/><circle cx="35" cy="50" r="5" fill="#000"/><circle cx="65" cy="50" r="5" fill="#000"/><circle cx="50" cy="60" r="5" fill="#000"/><circle cx="35" cy="70" r="5" fill="#000"/><circle cx="65" cy="70" r="5" fill="#000"/></g></svg>`,
  k: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><g fill="none" stroke="#000" stroke-width="2"><path d="M50 15c-10 0-18 10-18 20 0 6 4 11 9 14-5 4-9 10-9 17 0 7 6 11 14 11h20c8 0 14-4 14-11 0-7-4-13-9-17 5-3 9-8 9-14 0-10-8-20-18-20z" fill="#000"/><path d="M35 50h30M42 50v20M58 50v20M50 50v25" stroke-width="3"/></g></svg>`
};

function svgToUrl(svg: string): string {
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

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
  const imagesRef = useRef<Record<string, HTMLImageElement>>({});
  const [imagesLoaded, setImagesLoaded] = useState(false);

  if (!chessRef.current) {
    chessRef.current = new Chess(fen);
  }

  useEffect(() => {
    const images: Record<string, HTMLImageElement> = {};
    let loadedCount = 0;
    const totalPieces = Object.keys(PIECE_SVGS).length;

    Object.entries(PIECE_SVGS).forEach(([key, svg]) => {
      const img = new Image();
      img.onload = () => {
        loadedCount++;
        if (loadedCount === totalPieces) {
          setImagesLoaded(true);
        }
      };
      img.src = svgToUrl(svg);
      images[key] = img;
    });
    imagesRef.current = images;
  }, []);

  useEffect(() => {
    try {
      chessRef.current?.load(fen);
    } catch {
    }
    drawBoard();
  }, [fen]);

  useEffect(() => {
    drawBoard();
  }, [orientation, selectedSquare, possibleMoves, lastMove, imagesLoaded]);

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
        const img = imagesRef.current[pieceKey];
        if (img && imagesLoaded) {
          const padding = squareSize * 0.1;
          ctx.drawImage(img, x + padding, y + padding, squareSize - padding * 2, squareSize - padding * 2);
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
