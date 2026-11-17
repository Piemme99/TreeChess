import { useState } from 'react';
import { COLOURS, tile } from '../workshop/theme';
import { formatDay } from './formatDay';
import type { ReplayDay } from './useReplayDay';

/** Le rejeu des parties, outil de démonstration : rangé dans le menu, hors de l'en-tête. */
export function ReplayPanel({ replay }: { replay: ReplayDay }) {
  // Reset efface les ajouts et les décisions : jamais sur un seul clic.
  const [confirming, setConfirming] = useState(false);
  return (
    <section aria-label="Demo replay" className="flex flex-col gap-2 px-4 py-3 text-[14px]">
      <span className="flex flex-col leading-tight">
        <span className="font-bold">Demo replay</span>
        <span className="text-[13px]" style={{ color: COLOURS.leafSoft }}>
          {replay.index
            ? `Day ${replay.index} of ${replay.total} · ${formatDay(replay.day)} · ${replay.gamesThatDay} ${replay.gamesThatDay === 1 ? 'game' : 'games'}`
            : `Repertoire created · ${formatDay(replay.day)}`}
        </span>
      </span>
      {confirming ? (
        <span role="group" aria-label="Confirm reset" className="flex items-center gap-2 font-semibold">
          Erase all?
          <button
            type="button"
            onClick={() => {
              setConfirming(false);
              replay.reset!();
            }}
            className="ml-auto min-h-10 rounded-full px-3.5 font-bold text-white focus-visible:outline-2"
            style={{ background: COLOURS.terracotta }}
          >
            Reset
          </button>
          <button type="button" onClick={() => setConfirming(false)} className="min-h-10 rounded-full px-3.5 font-bold focus-visible:outline-2" style={tile(COLOURS.sand)}>
            Cancel
          </button>
        </span>
      ) : (
        <span className="flex gap-2">
          {replay.reset && (
            <button type="button" onClick={() => setConfirming(true)} className="min-h-10 flex-1 rounded-full px-3.5 font-bold focus-visible:outline-2" style={{ ...tile(COLOURS.sand), color: COLOURS.leaf }}>
              Reset…
            </button>
          )}
          {replay.next && (
            <button type="button" onClick={replay.next} className="min-h-10 flex-[2] rounded-full px-3.5 font-bold focus-visible:outline-2" style={{ background: COLOURS.leaf, color: COLOURS.cream }}>
              Next day →
            </button>
          )}
        </span>
      )}
    </section>
  );
}
