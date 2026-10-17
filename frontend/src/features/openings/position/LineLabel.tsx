import { useMemo } from 'react';
import { useOpeningName } from '../../../shared/hooks/useOpeningName';
import { formatLine } from '../domain/notation';
import { replayLine } from './replay';

export function LineLabel({ path }: { path: readonly string[] }) {
  const fens = useMemo(() => replayLine(path).fens, [path]);
  const opening = useOpeningName(fens);
  const moves = formatLine(path) || 'Start';

  if (!opening) return <span className="font-mono text-text">{moves}</span>;

  return (
    <span className="flex flex-col">
      <span className="text-text">{opening.name}</span>
      <span className="font-mono text-xs text-text-muted">{moves}</span>
    </span>
  );
}
