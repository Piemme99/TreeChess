import { useMemo } from 'react';
import { StaticBoard } from '../../../shared/components/Board/StaticBoard';
import { nodeAt, type OpeningNode, type OpeningTree } from '../domain/openingTree';
import { scoreRate } from '../domain/performance';
import { formatPercent } from '../flame/format';
import { LineLabel } from './LineLabel';
import { replayLine } from './replay';

const ARROW_COLOUR = 'rgb(230,126,34)';

interface PositionPanelProps {
  history: OpeningTree;
  recent: OpeningTree;
  path: readonly string[];
}

export function PositionPanel({ history, recent, path }: PositionPanelProps) {
  const { fens, lastMove } = useMemo(() => replayLine(path), [path]);

  return (
    <aside aria-label="Position" className="flex flex-col gap-3 rounded-md border border-border bg-bg-card p-4">
      <StaticBoard
        fen={fens[fens.length - 1]}
        orientation={history.side === 'w' ? 'white' : 'black'}
        arrows={lastMove ? [[lastMove.from, lastMove.to, ARROW_COLOUR]] : []}
      />
      <LineLabel path={path} />
      <table className="text-sm">
        <thead>
          <tr className="text-xs uppercase tracking-wide text-text-muted">
            <th className="text-left font-normal" />
            <th className="text-right font-normal">Games</th>
            <th className="text-right font-normal">Score</th>
          </tr>
        </thead>
        <tbody>
          <PeriodRow label="All time" line={nodeAt(history, path)} />
          <PeriodRow label="Last 12 months" line={nodeAt(recent, path)} />
        </tbody>
      </table>
    </aside>
  );
}

function PeriodRow({ label, line }: { label: string; line: OpeningNode | undefined }) {
  return (
    <tr>
      <th scope="row" className="text-left font-normal text-text-muted">{label}</th>
      <td className="text-right font-mono text-text">{line?.games ?? 0}</td>
      <td className="text-right font-mono text-text">{line ? formatPercent(scoreRate(line)) : '—'}</td>
    </tr>
  );
}
