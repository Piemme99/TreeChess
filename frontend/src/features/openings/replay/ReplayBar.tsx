import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { COLOURS, SPRING, tile } from '../workshop/theme';
import { formatDay } from './formatDay';
import type { ReplayDay } from './useReplayDay';

export function ReplayBar({ replay }: { replay: ReplayDay }) {
  return (
    <section aria-label="Replay" className="flex items-center gap-3 text-[14px]">
      <span className="mr-auto flex flex-col leading-tight sm:mr-0">
        <span className="whitespace-nowrap text-[16px] font-bold">{formatDay(replay.day)}</span>
        <span className="whitespace-nowrap text-[12px]" style={{ color: COLOURS.leafSoft }}>
          {replay.index
            ? `Replay · day ${replay.index} of ${replay.total} · ${replay.gamesThatDay} ${replay.gamesThatDay === 1 ? 'game' : 'games'}`
            : 'Replay · repertoire created'}
        </span>
      </span>
      {replay.next && (
        <Action onClick={replay.next} primary>
          Next day →
        </Action>
      )}
      {replay.reset && <Action onClick={replay.reset}>Reset</Action>}
    </section>
  );
}

function Action({ onClick, primary = false, children }: { onClick: () => void; primary?: boolean; children: ReactNode }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.96 }}
      transition={SPRING}
      className="whitespace-nowrap rounded-full px-3.5 py-2 text-[14px] font-bold focus-visible:outline-2 focus-visible:outline-offset-2"
      style={primary ? { background: COLOURS.leaf, color: COLOURS.cream } : { ...tile(COLOURS.sand), color: COLOURS.leaf }}
    >
      {children}
    </motion.button>
  );
}
