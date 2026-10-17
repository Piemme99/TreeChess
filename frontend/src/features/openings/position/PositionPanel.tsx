import { useMemo, type ReactNode } from 'react';
import { StaticBoard } from '../../../shared/components/Board/StaticBoard';
import { nodeAt, type OpeningTree } from '../domain/openingTree';
import { scoreRate } from '../domain/performance';
import { formatPercent } from '../flame/format';
import { LineLabel } from './LineLabel';
import { replayLine } from './replay';

const ARROW_COLOUR = 'rgb(230,126,34)';

interface PositionPanelProps {
  tree: OpeningTree;
  path: readonly string[];
}

export function PositionPanel({ tree, path }: PositionPanelProps) {
  const { fens, lastMove } = useMemo(() => replayLine(path), [path]);
  const node = nodeAt(tree, path);

  return (
    <aside aria-label="Position" className="flex flex-col gap-3 rounded-md border border-border bg-bg-card p-4">
      <StaticBoard
        fen={fens[fens.length - 1]}
        orientation={tree.side === 'w' ? 'white' : 'black'}
        arrows={lastMove ? [[lastMove.from, lastMove.to, ARROW_COLOUR]] : []}
      />
      <LineLabel path={path} />
      {node && (
        <dl className="flex gap-6">
          <Stat label="Games">{node.games}</Stat>
          <Stat label="Score">{formatPercent(scoreRate(node))}</Stat>
        </dl>
      )}
    </aside>
  );
}

function Stat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <dt className="text-xs uppercase tracking-wide text-text-muted">{label}</dt>
      <dd className="font-mono text-sm text-text">{children}</dd>
    </div>
  );
}
