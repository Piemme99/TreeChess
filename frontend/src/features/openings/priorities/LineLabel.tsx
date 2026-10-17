import { useMemo } from 'react';
import { useOpeningName } from '../../../shared/hooks/useOpeningName';
import { allFens } from '../../../shared/utils/chess';
import { formatLine } from '../domain/notation';

export function LineLabel({ path }: { path: readonly string[] }) {
  const fens = useMemo(() => allFens(path.map((san) => ({ san }))), [path]);
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
