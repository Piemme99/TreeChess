import type { ReactNode } from 'react';
import { formatLine } from '../domain/notation';
import { scoreRate } from '../domain/performance';
import type { FlameBar } from './flameLayout';

interface BarDetailsProps {
  bar: FlameBar;
  average: number;
}

export function BarDetails({ bar, average }: BarDetailsProps) {
  if (bar.kind === 'others') {
    return (
      <Panel title={`${formatLine(bar.parentPath) || 'Start'} · ${bar.lines} other moves`}>
        <Stat label="Games" value={bar.games} />
      </Panel>
    );
  }

  return (
    <Panel title={formatLine(bar.path) || 'All games'}>
      <Stat label="Games" value={bar.node.games} />
      <Stat label="Score" value={percent(scoreRate(bar.node))} />
      <Stat label="Average" value={percent(average)} />
    </Panel>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-wrap items-baseline gap-x-8 gap-y-2 rounded-md border border-border bg-bg-card px-4 py-3">
      <h3 className="min-w-48 font-mono text-sm text-text">{title}</h3>
      <dl className="flex gap-6">{children}</dl>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <dt className="text-xs uppercase tracking-wide text-text-muted">{label}</dt>
      <dd className="font-mono text-sm text-text">{value}</dd>
    </div>
  );
}

function percent(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}
