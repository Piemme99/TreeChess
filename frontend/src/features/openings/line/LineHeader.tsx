import { useMemo } from 'react';
import { useOpeningName } from '../../../shared/hooks/useOpeningName';
import type { LineStep } from '../domain/line';
import { figurineLine } from '../domain/notation';
import type { Side } from '../domain/playedGame';
import { formatPercent } from '../flame/format';
import { replayLine } from '../position/replay';
import { COLOURS, tile } from '../workshop/theme';
import { INK, moveTone } from './tone';

interface LineHeaderProps {
  path: readonly string[];
  side: Side;
  studied: LineStep | undefined;
  average: number;
  onBack: () => void;
}

export function LineHeader({ path, side, studied, average, onBack }: LineHeaderProps) {
  const fens = useMemo(() => replayLine(path).fens, [path]);
  const opening = useOpeningName(fens);
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
        <Stat label={side === 'w' ? 'as White' : 'as Black'} value={`${studied?.games ?? 0}`} unit="games" />
        <Stat
          label={`vs ${formatPercent(average)} avg`}
          value={studied ? formatPercent(studied.rate) : '—'}
          unit="score"
          colour={studied && INK[moveTone(studied.rate, studied.games, average)]}
        />
        <span className="pb-1 text-[12px] font-medium" style={{ color: COLOURS.leafSoft }}>
          Last 12 months
        </span>
      </div>
    </header>
  );
}

function Stat({ label, value, unit, colour }: { label: string; value: string; unit: string; colour?: string }) {
  return (
    <span className="flex flex-col items-center rounded-xl px-3 py-1.5" style={tile(COLOURS.sand)}>
      <span className="text-[20px] leading-tight font-extrabold" style={colour ? { color: colour } : undefined}>
        {value}
      </span>
      <span className="text-[11px] font-medium" style={{ color: COLOURS.leafSoft }}>
        {unit} · {label}
      </span>
    </span>
  );
}
