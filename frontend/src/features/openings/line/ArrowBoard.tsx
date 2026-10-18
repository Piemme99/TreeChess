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

const HALO = 'oklch(0.97 0.02 85)';

export function ArrowBoard({ path, flipped, arrows = [] }: { path: readonly string[]; flipped: boolean; arrows?: BoardArrow[] }) {
  const squares = useMemo(() => arrowSquares(path, arrows.map((arrow) => arrow.san)), [path, arrows]);
  const centre = (square: string) => {
    const file = square.charCodeAt(0) - 97;
    const rank = Number(square[1]) - 1;
    return { x: (flipped ? 7 - file : file) + 0.5, y: (flipped ? rank : 7 - rank) + 0.5 };
  };

  return (
    <div className="relative">
      <WorkshopBoard path={path} flipped={flipped} />
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
            const width = 0.09 + 0.2 * Math.sqrt(arrow.share);
            const head = Math.max(0.28, width * 2.1);
            const tipX = b.x - ux * 0.12;
            const tipY = b.y - uy * 0.12;
            const baseX = tipX - ux * head;
            const baseY = tipY - uy * head;
            const points = `${tipX},${tipY} ${baseX - uy * head * 0.6},${baseY + ux * head * 0.6} ${baseX + uy * head * 0.6},${baseY - ux * head * 0.6}`;
            const ink = arrow.colour ?? INK[arrow.tone];
            // Le liseré crème détache la flèche des cases vertes, quelle que soit sa couleur.
            return (
              <g key={arrow.san} opacity={arrow.emphasis ? 0.95 : 0.8}>
                <line x1={a.x} y1={a.y} x2={baseX} y2={baseY} stroke={HALO} strokeWidth={width + 0.09} strokeLinecap="round" />
                <polygon points={points} fill={HALO} stroke={HALO} strokeWidth={0.09} strokeLinejoin="round" />
                <line x1={a.x} y1={a.y} x2={baseX} y2={baseY} stroke={ink} strokeWidth={width} strokeLinecap="round" />
                <polygon points={points} fill={ink} />
              </g>
            );
          })}
      </svg>
    </div>
  );
}
