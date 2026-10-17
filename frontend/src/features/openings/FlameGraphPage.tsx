import { useMemo, useState } from 'react';
import { buildOpeningTree, type OpeningTree } from './domain/openingTree';
import { gamesOfLastMonths } from './domain/period';
import type { PlayedGame, Side } from './domain/playedGame';
import { findPriorities, type Priority } from './domain/priorities';
import { FlameGraph } from './flame/FlameGraph';
import { playedGamesFixture } from './fixtures/playedGames';
import { PositionPanel } from './position/PositionPanel';
import { PriorityList } from './priorities/PriorityList';
import { SegmentedControl } from './SegmentedControl';

const MAX_PLIES = 16;
const MAX_PRIORITIES = 5;
const RECENT_MONTHS = 12;

const SIDES: { value: Side; label: string }[] = [
  { value: 'w', label: 'White' },
  { value: 'b', label: 'Black' },
];

interface Line {
  side: Side;
  path: readonly string[];
}

export function FlameGraphPage() {
  const [side, setSide] = useState<Side>('w');
  const [focusPath, setFocusPath] = useState<readonly string[]>([]);
  const [pointed, setPointed] = useState<Line | null>(null);

  const trees = useMemo(() => treesOf(playedGamesFixture), []);
  const recentTrees = useMemo(
    () => treesOf(gamesOfLastMonths(playedGamesFixture, RECENT_MONTHS, new Date())),
    [],
  );
  const priorities = useMemo(
    () => findPriorities(trees, recentTrees, MAX_PRIORITIES),
    [trees, recentTrees],
  );
  const shown = pointed ?? { side, path: focusPath };

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
        <h1 className="font-display text-2xl text-text">Openings</h1>

        <PriorityList
          priorities={priorities}
          isSelected={isShown}
          onSelect={showPriority}
          onPoint={(priority) => setPointed(priority)}
        />

        <SegmentedControl label="Side" options={SIDES} value={side} onChange={showSide} />

        <FlameGraph
          key={side}
          tree={trees[side]}
          focusPath={focusPath}
          onFocusChange={setFocusPath}
          onPoint={(path) => setPointed(path && { side, path })}
        />
      </div>

      <div className="sticky top-6">
        <PositionPanel history={trees[shown.side]} recent={recentTrees[shown.side]} path={shown.path} />
      </div>
    </main>
  );
}

function treesOf(games: readonly PlayedGame[]): Record<Side, OpeningTree> {
  return { w: buildOpeningTree(games, 'w', MAX_PLIES), b: buildOpeningTree(games, 'b', MAX_PLIES) };
}
