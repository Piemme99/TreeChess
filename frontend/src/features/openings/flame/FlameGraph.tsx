import { useMemo, useState } from 'react';
import { isPlayerMove, nodeAt, type OpeningTree } from '../domain/openingTree';
import { playerAverage } from '../domain/performance';
import { formatMove } from '../domain/notation';
import { layoutFlame, type FlameBar } from './flameLayout';
import { lineTone, MIN_COLOURED_GAMES, type Tone } from './tone';
import { labelFits } from './label';
import { useElementWidth } from './useElementWidth';
import { BarDetails } from './BarDetails';
import { formatPercent } from './format';

const MIN_DRAWN_GAMES = 10;
const ROW_GAP = 2;

const ROW_STYLES = {
  player: { height: 28, fontSize: 12, className: 'text-xs leading-[26px]' },
  opponent: { height: 18, fontSize: 10, className: 'text-[10px] leading-[16px]' },
};

const TONE_CLASSES: Record<Tone, string> = {
  losing: 'bg-danger text-white',
  slipping: 'bg-warning text-text',
  even: 'bg-border-dark text-text',
  winning: 'bg-success text-white',
};

const OPPONENT_CLASSES = 'bg-border text-text-muted';

interface FlameGraphProps {
  tree: OpeningTree;
  focusPath: readonly string[];
  onFocusChange: (path: readonly string[]) => void;
}

export function FlameGraph({ tree, focusPath, onFocusChange }: FlameGraphProps) {
  const [hovered, setHovered] = useState<FlameBar | null>(null);
  const [containerRef, containerWidth] = useElementWidth<HTMLDivElement>();

  const average = playerAverage(tree);
  const focus = nodeAt(tree, focusPath) ?? tree.root;
  const bars = useMemo(() => layoutFlame(focus, focusPath, MIN_DRAWN_GAMES), [focus, focusPath]);

  const rowStyle = (depth: number) =>
    depth === 0 || isPlayerMove(tree.side, focusPath.length + depth) ? ROW_STYLES.player : ROW_STYLES.opponent;
  const rows = Math.max(0, ...bars.map((bar) => bar.depth)) + 1;
  const rowHeights = Array.from({ length: rows }, (_, depth) => rowStyle(depth).height);
  const rowTops = rowHeights.map((_, depth) => rowHeights.slice(0, depth).reduce((sum, h) => sum + h, 0));
  const totalHeight = rowHeights.reduce((sum, h) => sum + h, 0);

  const zoomTo = (path: readonly string[]) => {
    onFocusChange(path);
    setHovered(null);
  };

  const onBarClick = (bar: FlameBar) => {
    if (bar.depth === 0) zoomTo(focusPath.slice(0, -1));
    else zoomTo(bar.path);
  };

  return (
    <div className="flex flex-col gap-3">
      <Breadcrumb path={focusPath} onNavigate={zoomTo} />

      <div
        ref={containerRef}
        className="relative w-full"
        style={{ height: totalHeight }}
        onMouseLeave={() => setHovered(null)}
      >
        {bars.map((bar) => {
          const style = rowStyle(bar.depth);
          const label = barLabel(bar);
          const colour = style === ROW_STYLES.player ? TONE_CLASSES[lineTone(bar.node, average)] : OPPONENT_CLASSES;
          return (
            <button
              key={bar.path.join(' ')}
              type="button"
              onClick={() => onBarClick(bar)}
              onMouseEnter={() => setHovered(bar)}
              onFocus={() => setHovered(bar)}
              aria-label={label}
              className={`absolute overflow-hidden rounded-[2px] px-1.5 text-left transition hover:brightness-110 ${colour} ${style.className}`}
              style={{
                left: `${bar.start * 100}%`,
                width: `calc(${bar.width * 100}% - 1px)`,
                top: rowTops[bar.depth],
                height: style.height - ROW_GAP,
              }}
            >
              {labelFits(label, bar.width * containerWidth, style.fontSize) && (
                <span className="block whitespace-nowrap font-mono">{label}</span>
              )}
            </button>
          );
        })}
      </div>

      <Legend average={average} />
      {bars[0] && <BarDetails bar={hovered ?? bars[0]} />}
    </div>
  );
}

function barLabel(bar: FlameBar): string {
  if (bar.path.length === 0) return 'All games';
  return formatMove(bar.path[bar.path.length - 1], bar.path.length);
}

function Breadcrumb({ path, onNavigate }: { path: readonly string[]; onNavigate: (path: readonly string[]) => void }) {
  return (
    <nav aria-label="Zoom path" className="flex flex-wrap items-center gap-1 text-sm">
      <button type="button" onClick={() => onNavigate([])} className="text-primary hover:underline">
        All games
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

function Legend({ average }: { average: number }) {
  const entries: { tone: Tone; label: string }[] = [
    { tone: 'losing', label: 'Well below average' },
    { tone: 'slipping', label: 'Below average' },
    { tone: 'even', label: `Average (${formatPercent(average)}) or < ${MIN_COLOURED_GAMES} games` },
    { tone: 'winning', label: 'Above average' },
  ];

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-muted">
      <span>Width = games</span>
      {entries.map(({ tone, label }) => (
        <span key={tone} className="flex items-center gap-1.5">
          <span className={`inline-block h-3 w-3 rounded-[2px] ${TONE_CLASSES[tone]}`} />
          {label}
        </span>
      ))}
    </div>
  );
}
