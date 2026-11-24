import type { Side } from '../domain/playedGame';
import { COLOURS } from '../workshop/theme';

/** Le camp, en onglets serrés. */
export function SideTabs({ side, onChange, counts }: { side: Side; onChange: (side: Side) => void; counts: Record<Side, number> }) {
  return (
    <div role="tablist" aria-label="Repertoire" className="flex shrink-0 rounded-full p-0.5 text-[14px] font-bold" style={{ background: COLOURS.sand }}>
      {(['w', 'b'] as const).map((tab) => (
        <button
          key={tab}
          type="button"
          role="tab"
          aria-selected={side === tab}
          onClick={() => onChange(tab)}
          className="flex items-center gap-1 rounded-full px-3 py-1.5 focus-visible:outline-2"
          style={side === tab ? { background: COLOURS.leaf, color: COLOURS.cream } : { color: COLOURS.leaf }}
        >
          {tab === 'w' ? 'White' : 'Black'}
          {counts[tab] > 0 && (
            <span className="rounded-full px-1.5 text-[11px] font-extrabold text-white" style={{ background: COLOURS.terracotta }} title={`${counts[tab]} to settle`}>
              {counts[tab]}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
