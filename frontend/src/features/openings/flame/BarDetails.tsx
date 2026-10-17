import { formatLine } from '../domain/notation';
import { deficit, scoreRate } from '../domain/performance';
import type { FlameBar } from './flameLayout';
import { toneOf, type Tone } from './tone';

const VERDICT: Record<Tone, string> = {
  losing: 'Tu y marques nettement moins que d’habitude.',
  slipping: 'Tu y marques un peu moins que d’habitude.',
  even: 'Tu y marques comme d’habitude.',
  winning: 'Tu y marques plus que d’habitude.',
};

interface BarDetailsProps {
  bar: FlameBar;
  average: number;
}

export function BarDetails({ bar, average }: BarDetailsProps) {
  if (bar.kind === 'others') {
    return (
      <section className="rounded-md border border-border bg-bg-card px-4 py-3 text-sm">
        <h3 className="font-mono text-text">
          {formatLine(bar.parentPath) || 'Position de départ'} — {bar.lines} autres coups
        </h3>
        <p className="mt-1 text-text-muted">
          {bar.games} parties au total, trop peu chacune pour être affichées séparément.
        </p>
      </section>
    );
  }

  const { node, path } = bar;
  return (
    <section className="rounded-md border border-border bg-bg-card px-4 py-3 text-sm">
      <h3 className="font-mono text-text">{formatLine(path) || 'Toutes les parties'}</h3>
      <p className="mt-1 text-text-muted">
        {node.games} parties · tu y marques {percent(scoreRate(node))} · ta moyenne {percent(average)}
      </p>
      {path.length > 0 && <p className="mt-1 text-text">{VERDICT[toneOf(deficit(node, average))]}</p>}
    </section>
  );
}

function percent(rate: number): string {
  return `${Math.round(rate * 100)} %`;
}
