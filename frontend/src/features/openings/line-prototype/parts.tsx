// PROTOTYPE — petites pièces communes aux variantes de la vue de ligne. À jeter avec le dossier.
import { useMemo, type ReactNode } from 'react';
import { useOpeningName } from '../../../shared/hooks/useOpeningName';
import { WorkshopBoard } from '../board/WorkshopBoard';
import { figurineLine } from '../domain/notation';
import type { Side } from '../domain/playedGame';
import { formatPercent } from '../flame/format';
import { replayLine } from '../position/replay';
import { COLOURS, tile } from '../workshop/theme';
import { arrowsAt, toneOf, type LineStudy, type Tone } from './study';
import { INK } from './ui';

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
  const squares = useMemo(() => arrowsAt(path, arrows.map((arrow) => arrow.san)), [path, arrows]);
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

export function LineHeader({ study, path, side, onBack, children }: { study: LineStudy; path: readonly string[]; side: Side; onBack: () => void; children?: ReactNode }) {
  const fens = useMemo(() => replayLine(path).fens, [path]);
  const opening = useOpeningName(fens);
  const entryStep = study.steps[study.entry - 1];
  return (
    <header className="flex flex-wrap items-end gap-x-8 gap-y-3">
      <div className="flex min-w-0 flex-col gap-2">
        <button type="button" onClick={onBack} className="self-start rounded-full px-3 py-1 text-[13px] font-semibold" style={tile(COLOURS.sand)}>
          ← Openings
        </button>
        <h1 className="flex flex-col gap-1">
          <span className="text-[30px] leading-none font-extrabold tracking-[-0.03em]">{opening?.name ?? 'Unnamed line'}</span>
          <span className="text-[15px] font-medium" style={{ color: COLOURS.leafSoft }}>
            {figurineLine(path)}
          </span>
        </h1>
      </div>
      <div className="flex items-end gap-2">
        <Stat label={side === 'w' ? 'as White' : 'as Black'} value={`${entryStep?.games ?? 0}`} unit="games" />
        <Stat label={`vs ${formatPercent(study.average)} avg`} value={entryStep ? formatPercent(entryStep.rate) : '—'} unit="score" tone={entryStep ? INK[toneOf(entryStep.rate, entryStep.games, study.average)] : undefined} />
        <span className="pb-1 text-[12px] font-medium" style={{ color: COLOURS.leafSoft }}>
          Last 12 months
        </span>
      </div>
      {children}
    </header>
  );
}

function Stat({ label, value, unit, tone }: { label: string; value: string; unit: string; tone?: string }) {
  return (
    <span className="flex flex-col items-center rounded-xl px-3 py-1.5" style={tile(COLOURS.sand)}>
      <span className="text-[20px] leading-tight font-extrabold" style={tone ? { color: tone } : undefined}>
        {value}
      </span>
      <span className="text-[11px] font-medium" style={{ color: COLOURS.leafSoft }}>
        {unit} · {label}
      </span>
    </span>
  );
}

export function ResultDot({ score }: { score: number }) {
  const [bg, fg, text] =
    score === 1 ? [INK.winning, 'white', 'W'] : score === 0 ? [COLOURS.terracotta, 'white', 'L'] : [COLOURS.sand, COLOURS.leaf, '½'];
  return (
    <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-md text-[12px] font-bold" style={{ background: bg, color: fg }}>
      {text}
    </span>
  );
}
