import { motion } from 'framer-motion';
import type { Side } from '../domain/playedGame';
import { SPRING, COLOURS } from './theme';

/** `counts` : un nombre par camp à côté de son nom (les positions à trancher), quand il y en a. */
export function SideSwitch({ side, onChange, counts }: { side: Side; onChange: (side: Side) => void; counts?: Record<Side, number> }) {
  const black = side === 'b';
  return (
    <button
      type="button"
      role="switch"
      aria-checked={black}
      aria-label="Play as Black"
      onClick={() => onChange(black ? 'w' : 'b')}
      className="flex items-center gap-3 text-[15px] font-semibold"
    >
      <span style={{ opacity: black ? 0.75 : 1 }}>
        White
        <Count n={counts?.w} />
      </span>
      <span className="relative h-8 w-14 rounded-full p-1" style={{ background: COLOURS.sand, boxShadow: 'inset 0 2px 4px oklch(0.3 0.05 60 / 0.18)' }}>
        <motion.span
          className="block h-6 w-6 rounded-full"
          animate={{ x: black ? 24 : 0, background: black ? COLOURS.leaf : 'oklch(0.99 0.01 85)' }}
          transition={SPRING}
          style={{ boxShadow: '0 2px 4px oklch(0.3 0.05 60 / 0.3)' }}
        />
      </span>
      <span style={{ opacity: black ? 1 : 0.75 }}>
        Black
        <Count n={counts?.b} />
      </span>
    </button>
  );
}

function Count({ n }: { n?: number }) {
  if (!n) return null;
  return (
    <span className="ml-1.5 rounded-full px-1.5 py-0.5 text-[11px] font-extrabold text-white" style={{ background: COLOURS.terracotta }} title={`${n} to settle`}>
      {n}
    </span>
  );
}
