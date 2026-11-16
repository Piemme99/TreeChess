import { motion } from 'framer-motion';
import { useState, type ReactNode } from 'react';
import { COLOURS, SPRING, tile } from '../workshop/theme';
import { formatDay } from './formatDay';
import type { ReplayDay } from './useReplayDay';

export function ReplayBar({ replay }: { replay: ReplayDay }) {
  // Reset efface les ajouts et les décisions : jamais sur un seul clic.
  const [confirming, setConfirming] = useState(false);
  return (
    <section aria-label="Replay" className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[14px]">
      <span className="mr-auto flex flex-col leading-tight sm:mr-0">
        <span className="whitespace-nowrap text-[16px] font-bold">{formatDay(replay.day)}</span>
        <span className="flex items-center gap-1.5 whitespace-nowrap text-[12px]" style={{ color: COLOURS.leafSoft }}>
          {replay.index
            ? `Replay · day ${replay.index} of ${replay.total} · ${replay.gamesThatDay} ${replay.gamesThatDay === 1 ? 'game' : 'games'}`
            : 'Replay · repertoire created'}
          {replay.reset &&
            (confirming ? (
              <span role="group" aria-label="Confirm reset" className="flex items-center gap-1 font-semibold">
                · Erase all?
                <button
                  type="button"
                  onClick={() => {
                    setConfirming(false);
                    replay.reset!();
                  }}
                  className="rounded px-2 py-1.5 font-bold text-white focus-visible:outline-2"
                  style={{ background: COLOURS.terracotta }}
                >
                  Reset
                </button>
                <button type="button" onClick={() => setConfirming(false)} className="rounded px-2 py-1.5 font-bold underline-offset-2 hover:underline focus-visible:outline-2">
                  Keep
                </button>
              </span>
            ) : (
              <button type="button" onClick={() => setConfirming(true)} className="-my-1.5 rounded px-1.5 py-1.5 font-semibold underline underline-offset-2 focus-visible:outline-2">
                Reset…
              </button>
            ))}
        </span>
      </span>
      {replay.next && (
        <Action onClick={replay.next} primary>
          Next day →
        </Action>
      )}
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
