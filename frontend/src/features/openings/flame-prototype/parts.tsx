// PROTOTYPE — pièces partagées par les variantes : fil d'Ariane, carte au survol, repère de priorité.
import { AnimatePresence, motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { figurineMove } from '../design-prototype/figurines';
import { COLOURS, SPRING, tile } from '../workshop/theme';
import { headline, summary } from './describe';
import type { Mark, PlacedTile } from './prune';

export function Crumbs({ path, onNavigate }: { path: readonly string[]; onNavigate: (path: readonly string[]) => void }) {
  return (
    <nav aria-label="Zoom path" className="flex flex-wrap items-center gap-1.5 text-[13px] font-medium">
      <Crumb onClick={() => onNavigate([])} active={path.length === 0}>
        all
      </Crumb>
      <AnimatePresence initial={false}>
        {path.map((san, index) => (
          <motion.span
            key={`${index}-${san}`}
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.6 }}
            transition={SPRING}
          >
            <Crumb onClick={() => onNavigate(path.slice(0, index + 1))} active={index === path.length - 1}>
              {figurineMove(san, index + 1)}
            </Crumb>
          </motion.span>
        ))}
      </AnimatePresence>
    </nav>
  );
}

function Crumb({ onClick, active, children }: { onClick: () => void; active: boolean; children: ReactNode }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      aria-current={active ? 'location' : undefined}
      whileTap={{ scale: 0.92 }}
      transition={SPRING}
      className="rounded-full px-2.5 py-0.5"
      style={active ? { background: COLOURS.leaf, color: COLOURS.cream } : tile(COLOURS.sand)}
    >
      {children}
    </motion.button>
  );
}

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

export function Badge({ mark }: { mark: Mark }) {
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
