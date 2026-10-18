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

  // Sous les pièces, comme une surbrillance de case : la flèche indique sans masquer la position.
  const underlay = (
    <svg viewBox="0 0 8 8" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
      {arrows
        .map((arrow, index) => ({ arrow, ...squares[index] }))
        .sort((a, b) => b.arrow.share - a.arrow.share)
        .map(({ arrow, from, to }) => {
          const a = centre(from);
          const b = centre(to);
          const length = Math.hypot(b.x - a.x, b.y - a.y);
          const ux = (b.x - a.x) / length;
          const uy = (b.y - a.y) / length;
          const width = 0.08 + 0.08 * Math.sqrt(arrow.share);
          const head = Math.max(0.3, width * 2.5);
          const baseX = b.x - ux * head;
          const baseY = b.y - uy * head;
          const points = `${b.x},${b.y} ${baseX - uy * head * 0.6},${baseY + ux * head * 0.6} ${baseX + uy * head * 0.6},${baseY - ux * head * 0.6}`;
          const ink = arrow.colour ?? INK[arrow.tone];
          // Le liseré crème détache la flèche des cases vertes, quelle que soit sa couleur.
          return (
            <g key={arrow.san} opacity={arrow.emphasis ? 0.9 : 0.6}>
              <line x1={a.x} y1={a.y} x2={baseX} y2={baseY} stroke={HALO} strokeWidth={width + 0.05} strokeLinecap="round" />
              <polygon points={points} fill={HALO} stroke={HALO} strokeWidth={0.05} strokeLinejoin="round" />
              <line x1={a.x} y1={a.y} x2={baseX} y2={baseY} stroke={ink} strokeWidth={width} strokeLinecap="round" />
              <polygon points={points} fill={ink} />
            </g>
          );
        })}
    </svg>
  );

  return <WorkshopBoard path={path} flipped={flipped} underlay={underlay} />;
}
