import { useMemo, useState } from 'react';
import { buildOpeningTree } from './domain/openingTree';
import { gamesInPeriod, type Period } from './domain/period';
import type { Side } from './domain/playedGame';
import { findPriorities, type Priority } from './domain/priorities';
import { FlameGraph } from './flame/FlameGraph';
import { playedGamesFixture } from './fixtures/playedGames';
import { PositionPanel } from './position/PositionPanel';
import { PriorityList } from './priorities/PriorityList';
import { SegmentedControl } from './SegmentedControl';

const MAX_PLIES = 16;
const MAX_PRIORITIES = 5;

const PERIODS: { value: Period; label: string }[] = [
  { value: '3-months', label: '3 months' },
  { value: '1-year', label: '1 year' },
  { value: 'all', label: 'All' },
];

const SIDES: { value: Side; label: string }[] = [
  { value: 'w', label: 'White' },
  { value: 'b', label: 'Black' },
];

interface Line {
  side: Side;
  path: readonly string[];
}

export function FlameGraphPage() {
  const [period, setPeriod] = useState<Period>('1-year');
  const [side, setSide] = useState<Side>('w');
  const [focusPath, setFocusPath] = useState<readonly string[]>([]);
  const [pointed, setPointed] = useState<Line | null>(null);

  const trees = useMemo(() => {
    const games = gamesInPeriod(playedGamesFixture, period, new Date());
    return { w: buildOpeningTree(games, 'w', MAX_PLIES), b: buildOpeningTree(games, 'b', MAX_PLIES) };
  }, [period]);
  const priorities = useMemo(() => findPriorities([trees.w, trees.b], MAX_PRIORITIES), [trees]);
  const shown = pointed ?? { side, path: focusPath };

  const showPeriod = (next: Period) => {
    setPeriod(next);
    setFocusPath([]);
    setPointed(null);
  };

  const showSide = (next: Side) => {
    setSide(next);
    setFocusPath([]);
  };

  const showPriority = (priority: Priority) => {
    setSide(priority.side);
    setFocusPath(priority.path);
  };

  const isShown = (priority: Priority) =>
    priority.side === side && priority.path.join(' ') === focusPath.join(' ');

  return (
    <main className="mx-auto grid max-w-7xl grid-cols-[1fr_20rem] items-start gap-8 px-6 py-8">
      <div className="flex min-w-0 flex-col gap-6">
        <header className="flex items-center justify-between gap-4">
          <h1 className="font-display text-2xl text-text">Openings</h1>
          <SegmentedControl label="Period" options={PERIODS} value={period} onChange={showPeriod} />
        </header>

        <PriorityList
          priorities={priorities}
          isSelected={isShown}
          onSelect={showPriority}
          onPoint={(priority) => setPointed(priority)}
        />

        <SegmentedControl label="Side" options={SIDES} value={side} onChange={showSide} />

        <FlameGraph
          key={`${period}:${side}`}
          tree={trees[side]}
          focusPath={focusPath}
          onFocusChange={setFocusPath}
          onPoint={(path) => setPointed(path && { side, path })}
        />
      </div>

      <div className="sticky top-6">
        <PositionPanel tree={trees[shown.side]} path={shown.path} />
      </div>
    </main>
  );
}
