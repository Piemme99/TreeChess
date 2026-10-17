import { useMemo, useState } from 'react';
import { buildOpeningTree } from './domain/openingTree';
import type { Side } from './domain/playedGame';
import { findPriorities, type Priority } from './domain/priorities';
import { FlameGraph } from './flame/FlameGraph';
import { playedGamesFixture } from './fixtures/playedGames';
import { PositionPanel } from './position/PositionPanel';
import { PriorityList } from './priorities/PriorityList';

const MAX_PLIES = 16;
const MAX_PRIORITIES = 5;

const SIDES: { side: Side; label: string }[] = [
  { side: 'w', label: 'White' },
  { side: 'b', label: 'Black' },
];

interface Line {
  side: Side;
  path: readonly string[];
}

export function FlameGraphPage() {
  const trees = useMemo(
    () => ({
      w: buildOpeningTree(playedGamesFixture, 'w', MAX_PLIES),
      b: buildOpeningTree(playedGamesFixture, 'b', MAX_PLIES),
    }),
    [],
  );
  const priorities = useMemo(() => findPriorities([trees.w, trees.b], MAX_PRIORITIES), [trees]);

  const [side, setSide] = useState<Side>('w');
  const [focusPath, setFocusPath] = useState<readonly string[]>([]);
  const [pointed, setPointed] = useState<Line | null>(null);
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

        <div role="tablist" className="flex gap-2">
          {SIDES.map(({ side: option, label }) => (
            <button
              key={option}
              type="button"
              role="tab"
              aria-selected={side === option}
              onClick={() => showSide(option)}
              className={`rounded-md px-3 py-1.5 text-sm ${
                side === option ? 'bg-primary text-white' : 'bg-bg-card text-text-muted hover:text-text'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <FlameGraph
          key={side}
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
