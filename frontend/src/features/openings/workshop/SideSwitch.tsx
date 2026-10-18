import { motion } from 'framer-motion';
import type { Side } from '../domain/playedGame';
import { SPRING, COLOURS } from './theme';

export function SideSwitch({ side, onChange }: { side: Side; onChange: (side: Side) => void }) {
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
      <span style={{ opacity: black ? 0.45 : 1 }}>White</span>
      <span className="relative h-8 w-14 rounded-full p-1" style={{ background: COLOURS.sand, boxShadow: 'inset 0 2px 4px oklch(0.3 0.05 60 / 0.18)' }}>
        <motion.span
          className="block h-6 w-6 rounded-full"
          animate={{ x: black ? 24 : 0, background: black ? COLOURS.leaf : 'oklch(0.99 0.01 85)' }}
          transition={SPRING}
          style={{ boxShadow: '0 2px 4px oklch(0.3 0.05 60 / 0.3)' }}
        />
      </span>
      <span style={{ opacity: black ? 1 : 0.45 }}>Black</span>
    </button>
  );
}
