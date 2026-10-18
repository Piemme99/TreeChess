import { COLOURS } from '../workshop/theme';
import { headline, summary } from './describe';
import type { Mark, PlacedTile } from './prune';

export interface Hover {
  tile: PlacedTile;
  x: number;
  y: number;
}

export function HoverCard({ hover, average }: { hover: Hover | null; average: number }) {
  if (!hover) return null;
  const flipped = hover.x > window.innerWidth - 300;
  return (
    <div
      role="tooltip"
      className="pointer-events-none fixed z-40 flex flex-col gap-0.5 rounded-xl px-3 py-2 text-[12px]"
      style={{
        left: flipped ? undefined : hover.x + 14,
        right: flipped ? window.innerWidth - hover.x + 14 : undefined,
        top: hover.y + 14,
        background: COLOURS.leaf,
        color: COLOURS.cream,
        boxShadow: '0 12px 28px -8px oklch(0.3 0.06 150 / 0.6)',
      }}
    >
      <span className="font-bold tracking-[-0.01em]">{headline(hover.tile)}</span>
      <span style={{ color: 'oklch(0.85 0.03 85)' }}>{summary(hover.tile.node, average)}</span>
    </div>
  );
}

export function PriorityBadge({ mark }: { mark: Mark }) {
  if (!mark.exact) {
    return (
      <span
        aria-label={`contains priority ${mark.rank}`}
        className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full"
        style={{ background: COLOURS.leaf, boxShadow: `0 0 0 2px ${COLOURS.cream}` }}
      />
    );
  }
  return (
    <span
      aria-label={`priority ${mark.rank}`}
      className="absolute right-1 top-1/2 flex h-[18px] w-[18px] -translate-y-1/2 items-center justify-center rounded-full text-[10px] font-extrabold"
      style={{ background: COLOURS.leaf, color: COLOURS.cream, boxShadow: `0 0 0 2px ${COLOURS.cream}` }}
    >
      {mark.rank}
    </span>
  );
}
