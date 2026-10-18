import { useMemo } from 'react';
import { WorkshopBoard } from '../board/WorkshopBoard';
import type { Tone } from '../flame/tone';
import { arrowSquares, INK } from './tone';

export interface BoardArrow {
  san: string;
  tone: Tone;
  colour?: string;
  /** Part des parties, pour l'épaisseur. */
  share: number;
  emphasis?: boolean;
}

export function ArrowBoard({ path, flipped, arrows = [], hidden }: { path: readonly string[]; flipped: boolean; arrows?: BoardArrow[]; hidden?: string }) {
  const squares = useMemo(() => arrowSquares(path, arrows.map((arrow) => arrow.san)), [path, arrows]);
  const centre = (square: string) => {
    const file = square.charCodeAt(0) - 97;
    const rank = Number(square[1]) - 1;
    return { x: (flipped ? 7 - file : file) + 0.5, y: (flipped ? rank : 7 - rank) + 0.5 };
  };

  return (
    <div className="relative">
      <WorkshopBoard path={path} flipped={flipped} hidden={hidden} />
      <svg viewBox="0 0 8 8" className="pointer-events-none absolute inset-2.5" aria-hidden="true">
        {arrows
          .map((arrow, index) => ({ arrow, ...squares[index] }))
          .sort((a, b) => b.arrow.share - a.arrow.share)
          .map(({ arrow, from, to }) => {
            const a = centre(from);
            const b = centre(to);
            const length = Math.hypot(b.x - a.x, b.y - a.y);
            const ux = (b.x - a.x) / length;
            const uy = (b.y - a.y) / length;
            const width = 0.1 + 0.07 * Math.sqrt(arrow.share);
            const head = width * 3;
            const tipX = b.x - ux * 0.1;
            const tipY = b.y - uy * 0.1;
            const baseX = tipX - ux * head;
            const baseY = tipY - uy * head;
            const points = `${tipX},${tipY} ${baseX - uy * width * 2},${baseY + ux * width * 2} ${baseX + uy * width * 2},${baseY - ux * width * 2}`;
            const ink = arrow.colour ?? INK[arrow.tone];
            // Transparence portée par le groupe, comme sur Lichess : le trait et la pointe se fondent
            // en une seule forme et la pièce reste visible à travers.
            return (
              <g key={arrow.san} opacity={arrow.emphasis ? 0.75 : 0.5}>
                <line x1={a.x} y1={a.y} x2={baseX + ux * 0.02} y2={baseY + uy * 0.02} stroke={ink} strokeWidth={width} strokeLinecap="round" />
                <polygon points={points} fill={ink} />
              </g>
            );
          })}
      </svg>
    </div>
  );
}
