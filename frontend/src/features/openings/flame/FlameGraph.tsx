import { useMemo, useState } from 'react';
import { nodeAt, type OpeningTree } from '../domain/openingTree';
import { deficit, playerAverage } from '../domain/performance';
import { formatMove } from '../domain/notation';
import { layoutFlame, type FlameBar } from './flameLayout';
import { toneOf, type Tone } from './tone';
import { BarDetails } from './BarDetails';

const ROW_HEIGHT = 28;
const MIN_BAR_WIDTH = 0.004;
const MIN_LABEL_WIDTH = 0.03;

const TONE_CLASSES: Record<Tone, string> = {
  losing: 'bg-danger text-white',
  slipping: 'bg-warning text-text',
  even: 'bg-border-dark text-text',
  winning: 'bg-success text-white',
};

interface FlameGraphProps {
  tree: OpeningTree;
}

export function FlameGraph({ tree }: FlameGraphProps) {
  const [focusPath, setFocusPath] = useState<readonly string[]>([]);
  const [hovered, setHovered] = useState<FlameBar | null>(null);

  const average = playerAverage(tree);
  const focus = nodeAt(tree, focusPath) ?? tree.root;
  const bars = useMemo(() => layoutFlame(focus, focusPath, MIN_BAR_WIDTH), [focus, focusPath]);
  const rows = Math.max(0, ...bars.map((bar) => bar.depth)) + 1;
  const focusBar = bars[0];

  const zoomTo = (path: readonly string[]) => {
    setFocusPath(path);
    setHovered(null);
  };

  const onBarClick = (bar: FlameBar) => {
    if (bar.kind === 'others') return;
    if (bar.depth === 0) zoomTo(focusPath.slice(0, -1));
    else zoomTo(bar.path);
  };

  return (
    <div className="flex flex-col gap-3">
      <Breadcrumb path={focusPath} onNavigate={zoomTo} />

      <div className="relative w-full" style={{ height: rows * ROW_HEIGHT }} onMouseLeave={() => setHovered(null)}>
        {bars.map((bar) => (
          <button
            key={barKey(bar)}
            type="button"
            onClick={() => onBarClick(bar)}
            onMouseEnter={() => setHovered(bar)}
            onFocus={() => setHovered(bar)}
            aria-label={barLabel(bar)}
            className={`absolute overflow-hidden rounded-[2px] px-1.5 text-left text-xs transition hover:brightness-110 ${
              bar.kind === 'others' ? 'cursor-default bg-border text-text-muted' : TONE_CLASSES[toneOf(deficit(bar.node, average))]
            }`}
            style={{
              left: `${bar.start * 100}%`,
              width: `calc(${bar.width * 100}% - 1px)`,
              top: bar.depth * ROW_HEIGHT,
              height: ROW_HEIGHT - 2,
            }}
          >
            {bar.width >= MIN_LABEL_WIDTH && (
              <span className="whitespace-nowrap font-mono leading-[26px]">
                {barLabel(bar)}
              </span>
            )}
          </button>
        ))}
      </div>

      <Legend />
      {focusBar && <BarDetails bar={hovered ?? focusBar} average={average} />}
    </div>
  );
}

function barKey(bar: FlameBar): string {
  return bar.kind === 'line' ? `line:${bar.path.join(' ')}` : `others:${bar.parentPath.join(' ')}`;
}

function barLabel(bar: FlameBar): string {
  if (bar.kind === 'others') return `${bar.lines} autres`;
  if (bar.path.length === 0) return 'Toutes les parties';
  return formatMove(bar.path[bar.path.length - 1], bar.path.length);
}

function Breadcrumb({ path, onNavigate }: { path: readonly string[]; onNavigate: (path: readonly string[]) => void }) {
  return (
    <nav aria-label="Position affichée" className="flex flex-wrap items-center gap-1 text-sm">
      <button type="button" onClick={() => onNavigate([])} className="text-primary hover:underline">
        Toutes les parties
      </button>
      {path.map((san, index) => (
        <span key={index} className="flex items-center gap-1">
          <span className="text-text-light">›</span>
          <button
            type="button"
            onClick={() => onNavigate(path.slice(0, index + 1))}
            className="font-mono text-primary hover:underline"
          >
            {formatMove(san, index + 1)}
          </button>
        </span>
      ))}
    </nav>
  );
}

const LEGEND: { tone: Tone; label: string }[] = [
  { tone: 'losing', label: 'tu y perds nettement des points' },
  { tone: 'slipping', label: 'tu y perds un peu' },
  { tone: 'even', label: 'dans ta moyenne' },
  { tone: 'winning', label: 'tu y gagnes des points' },
];

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-muted">
      <span>Largeur : nombre de parties.</span>
      {LEGEND.map(({ tone, label }) => (
        <span key={tone} className="flex items-center gap-1.5">
          <span className={`inline-block h-3 w-3 rounded-[2px] ${TONE_CLASSES[tone]}`} />
          {label}
        </span>
      ))}
    </div>
  );
}
