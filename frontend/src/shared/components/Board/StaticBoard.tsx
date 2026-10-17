import { memo, useMemo } from 'react';
import { PIECE_SVG } from './pieceSvg';

/**
 * Lightweight static chessboard renderer using the same cburnett SVG piece set
 * as react-chessboard. Pure SVG — no chess.js, no event handlers.
 * Designed for thumbnail / preview use where performance matters.
 */

const LIGHT = '#F0D9B5';
const DARK = '#B58863';

// Map FEN characters to piece keys
const FEN_TO_KEY: Record<string, string> = {
  K: 'wK', Q: 'wQ', R: 'wR', B: 'wB', N: 'wN', P: 'wP',
  k: 'bK', q: 'bQ', r: 'bR', b: 'bB', n: 'bN', p: 'bP',
};

interface StaticBoardProps {
  fen: string;
  orientation?: 'white' | 'black';
  className?: string;
  /** Arrows to draw on the board: [fromSquare, toSquare, color?][] */
  arrows?: [string, string, string?][];
}

const DEFAULT_ARROW_COLOR = 'rgb(255,170,0)';

// Allowlist of color formats safe to interpolate into raw SVG markup. Matches
// #rgb / #rgba / #rrggbb / #rrggbbaa hex, rgb()/rgba() functions, and plain
// CSS named colors (letters only). Anything else (e.g. markup, url(), unclosed
// quotes) is rejected to prevent SVG/attribute injection.
const SAFE_COLOR_RE =
  /^(#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})|rgba?\([\d.,\s%]+\)|[a-z]+)$/i;

/** Returns a color string safe to interpolate into raw SVG, or the default. */
function safeArrowColor(color: string | undefined): string {
  if (color && SAFE_COLOR_RE.test(color.trim())) {
    return color.trim();
  }
  return DEFAULT_ARROW_COLOR;
}

// Board dimensions in the viewBox coordinate system
const SQUARE_SIZE = 45; // 360 / 8

/** Convert algebraic square (e.g. "e4") to pixel center within the 360×360 viewBox */
function squareToPixel(square: string, flipped: boolean): { x: number; y: number } {
  const col = square.charCodeAt(0) - 97; // 'a' = 0 .. 'h' = 7
  const row = 8 - parseInt(square[1], 10);  // '8' = 0 .. '1' = 7
  const displayCol = flipped ? 7 - col : col;
  const displayRow = flipped ? 7 - row : row;
  return { x: displayCol * SQUARE_SIZE + SQUARE_SIZE / 2, y: displayRow * SQUARE_SIZE + SQUARE_SIZE / 2 };
}

/**
 * Build SVG markup for arrows — matches react-chessboard v5 arrow style:
 * - strokeWidth = squareSize / 5
 * - marker: 2×2.5 with polygon "0.3 0, 2 1.25, 0.3 2.5"
 * - L-shaped paths for knight moves (2+1 or 1+2 square patterns)
 * - straight paths for all other moves
 * - line shortened by squareSize/8 (or squareSize/4 for overlapping targets)
 * - opacity 0.65
 */
function buildArrowsSVG(arrows: [string, string, string?][], flipped: boolean): string {
  if (arrows.length === 0) return '';

  const strokeWidth = SQUARE_SIZE / 5;
  const defaultShorten = SQUARE_SIZE / 8;
  const overlapShorten = SQUARE_SIZE / 4;
  // Distance for a knight move: sqrt(1^2 + 2^2) * squareSize
  const knightDistance = Math.hypot(1, 2) * SQUARE_SIZE;

  const parts: string[] = [];
  for (let i = 0; i < arrows.length; i++) {
    const [from, to, color] = arrows[i];
    if (from === to) continue;
    const arrowColor = safeArrowColor(color);
    const markerId = `ah${i}`;
    const p1 = squareToPixel(from, flipped);
    const p2 = squareToPixel(to, flipped);

    // Shorten more when multiple arrows target the same square (matching react-chessboard)
    const hasOverlap = arrows.some(
      (other, j) => j !== i && other[0] !== from && other[1] === to
    );
    const shorten = hasOverlap ? overlapShorten : defaultShorten;

    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const r = Math.hypot(dx, dy);

    let pathD: string;

    // Knight move — draw an L-shaped arrow
    if (Math.abs(r - knightDistance) < 0.5) {
      // Draw the long leg first for visual clarity
      const isVerticalFirst = Math.abs(dx) < Math.abs(dy);

      // Corner where the L-shape turns
      const corner = isVerticalFirst
        ? { x: p1.x, y: p2.y }
        : { x: p2.x, y: p1.y };

      // Shorten the final leg (always 1 square for knight moves)
      const dxFinal = p2.x - corner.x;
      const dyFinal = p2.y - corner.y;
      const finalLen = SQUARE_SIZE;
      const endX = corner.x + (dxFinal * (finalLen - shorten)) / finalLen;
      const endY = corner.y + (dyFinal * (finalLen - shorten)) / finalLen;

      pathD = `M${p1.x},${p1.y} L${corner.x},${corner.y} L${endX},${endY}`;
    } else {
      // Straight arrow
      const endX = p1.x + (dx * (r - shorten)) / r;
      const endY = p1.y + (dy * (r - shorten)) / r;
      pathD = `M${p1.x},${p1.y} L${endX},${endY}`;
    }

    parts.push(
      `<marker id="${markerId}" markerWidth="2" markerHeight="2.5" refX="1.25" refY="1.25" orient="auto">` +
        `<polygon points="0.3 0, 2 1.25, 0.3 2.5" fill="${arrowColor}"/>` +
      `</marker>` +
      `<path d="${pathD}" fill="none" ` +
        `stroke="${arrowColor}" stroke-width="${strokeWidth}" ` +
        `marker-end="url(#${markerId})" opacity="0.65"/>`
    );
  }
  return parts.join('');
}

function parseFEN(fen: string): (string | null)[][] {
  const rows = fen.split(' ')[0].split('/');
  const board: (string | null)[][] = [];
  for (const row of rows) {
    const rank: (string | null)[] = [];
    for (const ch of row) {
      if (ch >= '1' && ch <= '8') {
        for (let i = 0; i < parseInt(ch, 10); i++) rank.push(null);
      } else {
        rank.push(ch);
      }
    }
    board.push(rank);
  }
  return board;
}

export const StaticBoard = memo(function StaticBoard({
  fen,
  orientation = 'white',
  className,
  arrows = [],
}: StaticBoardProps) {
  const board = useMemo(() => parseFEN(fen), [fen]);
  const flipped = orientation === 'black';

  // Build SVG string for dangerouslySetInnerHTML (much faster than creating React elements for 12 pieces)
  const svgContent = useMemo(() => {
    const parts: string[] = [];

    // Draw squares
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const displayRow = flipped ? 7 - row : row;
        const displayCol = flipped ? 7 - col : col;
        const isLight = (displayRow + displayCol) % 2 === 0;
        parts.push(
          `<rect x="${col * 45}" y="${row * 45}" width="45" height="45" fill="${isLight ? LIGHT : DARK}"/>`
        );
      }
    }

    // Draw pieces
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const displayRow = flipped ? 7 - row : row;
        const displayCol = flipped ? 7 - col : col;
        const piece = board[displayRow]?.[displayCol];
        if (piece) {
          const key = FEN_TO_KEY[piece];
          const svg = key ? PIECE_SVG[key] : null;
          if (svg) {
            parts.push(
              `<g transform="translate(${col * 45},${row * 45})">${svg}</g>`
            );
          }
        }
      }
    }

    // Draw arrows on top of pieces
    if (arrows.length > 0) {
      parts.push(buildArrowsSVG(arrows, flipped));
    }

    return parts.join('');
  }, [board, flipped, arrows]);

  return (
    <svg
      viewBox="0 0 360 360"
      className={className}
      style={{ width: '100%', height: '100%', display: 'block' }}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: svgContent }}
    />
  );
});
