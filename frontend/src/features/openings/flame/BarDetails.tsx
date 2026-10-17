import type { ReactNode } from 'react';
import { formatLine } from '../domain/notation';
import { scoreRate } from '../domain/performance';
import type { FlameBar } from './flameLayout';
import { formatPercent } from './format';

export function BarDetails({ bar }: { bar: FlameBar }) {
  return (
    <section className="flex flex-wrap items-baseline gap-x-8 gap-y-2 rounded-md border border-border bg-bg-card px-4 py-3">
      <h3 className="min-w-48 font-mono text-sm text-text">{formatLine(bar.path) || 'All games'}</h3>
      <dl className="flex gap-6">
        <Stat label="Games">{bar.node.games}</Stat>
        <Stat label="Score">{formatPercent(scoreRate(bar.node))}</Stat>
      </dl>
    </section>
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
