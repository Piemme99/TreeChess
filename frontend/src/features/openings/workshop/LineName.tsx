import { useMemo } from 'react';
import { useOpeningName } from '../../../shared/hooks/useOpeningName';
import { figurineLine } from '../domain/notation';
import { replayLine } from '../position/replay';
import { COLOURS } from './theme';

export function LineName({ path }: { path: readonly string[] }) {
  const fens = useMemo(() => replayLine(path).fens, [path]);
  const opening = useOpeningName(fens);
  return (
    <div className="flex min-w-0 flex-col px-1">
      <span className="text-[16px] font-bold leading-tight">{opening?.name ?? (path.length ? 'Unnamed line' : 'Starting position')}</span>
      <span className="truncate text-[14px] lg:whitespace-normal" style={{ color: COLOURS.leafSoft }}>
        {path.length ? figurineLine(path) : '—'}
      </span>
    </div>
  );
}
