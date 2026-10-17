import { useMemo, useState } from 'react';
import { buildOpeningTree } from './domain/openingTree';
import type { Side } from './domain/playedGame';
import { FlameGraph } from './flame/FlameGraph';
import { playedGamesFixture } from './fixtures/playedGames';

const MAX_PLIES = 16;

const SIDES: { side: Side; label: string }[] = [
  { side: 'w', label: 'White' },
  { side: 'b', label: 'Black' },
];

export function FlameGraphPage() {
  const [side, setSide] = useState<Side>('w');
  const tree = useMemo(() => buildOpeningTree(playedGamesFixture, side, MAX_PLIES), [side]);

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8">
      <h1 className="font-display text-2xl text-text">Openings</h1>

      <div role="tablist" className="flex gap-2">
        {SIDES.map(({ side: option, label }) => (
          <button
            key={option}
            type="button"
            role="tab"
            aria-selected={side === option}
            onClick={() => setSide(option)}
            className={`rounded-md px-3 py-1.5 text-sm ${
              side === option ? 'bg-primary text-white' : 'bg-bg-card text-text-muted hover:text-text'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <FlameGraph key={side} tree={tree} />
    </main>
  );
}
