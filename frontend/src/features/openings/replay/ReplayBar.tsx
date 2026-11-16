import { motion } from 'framer-motion';
import { useState, type ReactNode } from 'react';
import { COLOURS, SPRING, tile } from '../workshop/theme';
import { formatDay, formatShortDay } from './formatDay';
import type { ReplayDay } from './useReplayDay';

export function ReplayBar({ replay }: { replay: ReplayDay }) {
  // Reset efface les ajouts et les décisions : jamais sur un seul clic.
  const [confirming, setConfirming] = useState(false);
  return (
    <section aria-label="Replay" className="relative flex items-center gap-x-3 gap-y-2 text-[14px] sm:flex-wrap">
      <span className="mr-auto flex flex-col leading-tight sm:mr-0">
        <span className="whitespace-nowrap text-[15px] font-bold sm:text-[16px]">
          <span className="sm:hidden">{formatShortDay(replay.day)}</span>
          <span className="hidden sm:inline">{formatDay(replay.day)}</span>
        </span>
        <span className="flex items-center gap-1.5 whitespace-nowrap text-[12px]" style={{ color: COLOURS.leafSoft }}>
          <span className="sm:hidden">{replay.index ? `Day ${replay.index}/${replay.total}` : 'Replay'}</span>
          <span className="hidden sm:inline">
            {replay.index
              ? `Replay · day ${replay.index} of ${replay.total} · ${replay.gamesThatDay} ${replay.gamesThatDay === 1 ? 'game' : 'games'}`
              : 'Replay · repertoire created'}
          </span>
          {replay.reset && (
            <span>
              <button type="button" aria-expanded={confirming} onClick={() => setConfirming(!confirming)} className="-my-2.5 rounded px-1.5 py-2.5 font-semibold underline underline-offset-2 focus-visible:outline-2">
                Reset…
              </button>
              {/* Hors de la ligne : la confirmation ne doit pas pousser « Next day » hors de l'écran. */}
              {confirming && (
                <span role="group" aria-label="Confirm reset" className="absolute right-0 top-full z-50 mt-2 flex items-center gap-2 whitespace-nowrap rounded-xl py-2 pl-3 pr-2 text-[14px] font-semibold" style={{ background: COLOURS.paper, color: COLOURS.leaf, boxShadow: '0 14px 28px -10px oklch(0.3 0.06 150 / 0.45)' }}>
                  Erase all?
                  <button
                    type="button"
                    onClick={() => {
                      setConfirming(false);
                      replay.reset!();
                    }}
                    className="min-h-9 rounded-lg px-3 font-bold text-white focus-visible:outline-2"
                    style={{ background: COLOURS.terracotta }}
                  >
                    Reset
                  </button>
                  <button type="button" onClick={() => setConfirming(false)} className="min-h-9 rounded-lg px-3 font-bold focus-visible:outline-2" style={tile(COLOURS.sand)}>
                    Cancel
                  </button>
                </span>
              )}
            </span>
          )}
        </span>
      </span>
      {replay.next && (
        <Action onClick={replay.next} primary>
          <span className="sm:hidden">Next day →</span>
          <span className="hidden sm:inline">Next game day →</span>
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
