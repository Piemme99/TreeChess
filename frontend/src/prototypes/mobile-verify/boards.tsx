// PROTOTYPE JETABLE — dire les coups avec des pièces et des flèches plutôt qu'en notation.
import { useEffect, useMemo, useState } from 'react';
import type { Side } from '../../features/openings/domain/playedGame';
import { useElementWidth } from '../../features/openings/flame/useElementWidth';
import { replayLine } from '../../features/openings/position/replay';
import { StaticBoard } from '../../shared/components/Board';
import { isPlayerTurn } from './checks';
import { ARROW, arrowFor, type Arrow } from './lineName';

export function SquareBoard({ path, side, arrows = [] }: { path: readonly string[]; side: Side; arrows?: Arrow[] }) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const fen = useMemo(() => replayLine(path).fens.at(-1)!, [path]);
  return (
    <div ref={ref} style={{ height: width }} className="overflow-hidden rounded-md">
      <StaticBoard fen={fen} orientation={side === 'w' ? 'white' : 'black'} arrows={arrows} />
    </div>
  );
}

export interface LegendItem {
  color: string;
  label: string;
  value: string;
}

export function ArrowLegend({ items }: { items: LegendItem[] }) {
  return (
    <div className="flex flex-col gap-1 text-sm">
      {items.map((item) => (
        <span key={item.label} className="flex items-center gap-2">
          <span className="h-1.5 w-5 rounded-full" style={{ backgroundColor: item.color }} />
          <span className="text-text">{item.label}</span>
          <span className="ml-auto text-text-muted">{item.value}</span>
        </span>
      ))}
    </div>
  );
}

// L'adversaire et le joueur ont chacun leur couleur de flèche : on suit la ligne sans lire un coup.
export function LineStepper({ side, start, moves }: { side: Side; start: readonly string[]; moves: readonly string[] }) {
  const [shown, setShown] = useState(0);
  const [playing, setPlaying] = useState(true);
  const line = useMemo(() => [...start, ...moves], [start, moves]);

  useEffect(() => {
    if (!playing) return;
    if (shown >= moves.length) {
      setPlaying(false);
      return;
    }
    const timer = setTimeout(() => setShown((n) => n + 1), shown === 0 ? 600 : 900);
    return () => clearTimeout(timer);
  }, [playing, shown, moves.length]);

  const ply = start.length + shown;
  const path = line.slice(0, ply);
  const arrows: Arrow[] =
    shown === 0
      ? []
      : [arrowFor(line.slice(0, ply - 1), line[ply - 1], isPlayerTurn(side, ply - 1) ? ARROW.prep : ARROW.opponent)];

  const go = (n: number) => {
    setPlaying(false);
    setShown(Math.max(0, Math.min(moves.length, n)));
  };

  return (
    <div className="flex flex-col gap-2">
      <SquareBoard path={path} side={side} arrows={arrows} />
      <div className="flex items-center gap-2">
        <button onClick={() => go(shown - 1)} className="rounded-lg border border-border px-3 py-1 text-text-muted" aria-label="Previous move">
          ‹
        </button>
        <div className="flex flex-1 gap-1">
          {moves.map((_, i) => (
            <span
              key={i}
              className="h-1.5 flex-1 rounded-full"
              style={{
                backgroundColor: i < shown ? (isPlayerTurn(side, start.length + i) ? ARROW.prep : ARROW.opponent) : 'var(--color-border)',
              }}
            />
          ))}
        </div>
        <button onClick={() => go(shown + 1)} className="rounded-lg border border-border px-3 py-1 text-text-muted" aria-label="Next move">
          ›
        </button>
      </div>
      <ArrowLegend
        items={[
          { color: ARROW.prep, label: 'Your move', value: '' },
          { color: ARROW.opponent, label: 'Opponent', value: '' },
        ]}
      />
    </div>
  );
}
