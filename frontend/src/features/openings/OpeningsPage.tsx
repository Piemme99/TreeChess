import { MotionConfig } from 'framer-motion';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { buildOpeningTree, type OpeningTree } from './domain/openingTree';
import { gamesOfLastMonths } from './domain/period';
import type { PlayedGame, Side } from './domain/playedGame';
import { findPriorities, type Priority } from './domain/priorities';
import { FlameTiles } from './flame/FlameTiles';
import { playedGamesFixture } from './fixtures/playedGames';
import { LineView } from './line/LineView';
import { BoardPanel } from './position/BoardPanel';
import { PriorityTickets } from './priorities/PriorityTickets';
import { Kumquat } from './workshop/Kumquat';
import { SideSwitch } from './workshop/SideSwitch';
import { COLOURS, FONT_FAMILY } from './workshop/theme';
import { useWorkshopFont } from './workshop/useWorkshopFont';

const MAX_PLIES = 16;
const MAX_PRIORITIES = 5;
const RECENT_MONTHS = 12;

interface Line {
  side: Side;
  path: readonly string[];
}

export interface FlameSlotProps {
  tree: OpeningTree;
  focusPath: readonly string[];
  onFocusChange: (path: readonly string[]) => void;
  onPoint: (path: readonly string[] | null) => void;
  priorities: readonly Priority[];
}

interface OpeningsPageProps {
  /** Point d'injection du prototype de flame graph (flame-prototype/) ; FlameTiles par défaut. */
  renderFlame?: (props: FlameSlotProps) => ReactNode;
  maxPlies?: number;
}

const defaultFlame = ({ tree, focusPath, onFocusChange, onPoint }: FlameSlotProps) => (
  <FlameTiles key={tree.side} tree={tree} focusPath={focusPath} onFocusChange={onFocusChange} onPoint={onPoint} />
);

export function OpeningsPage({ renderFlame = defaultFlame, maxPlies = MAX_PLIES }: OpeningsPageProps = {}) {
  useWorkshopFont();
  const [side, setSide] = useState<Side>('w');
  const [focusPath, setFocusPath] = useState<readonly string[]>([]);
  const [pointed, setPointed] = useState<Line | null>(null);
  const [studied, setStudied] = useState<Line | null>(null);

  const trees = useMemo(() => treesOf(playedGamesFixture, maxPlies), [maxPlies]);
  const recentTrees = useMemo(
    () => treesOf(gamesOfLastMonths(playedGamesFixture, RECENT_MONTHS, new Date()), maxPlies),
    [maxPlies],
  );
  const priorities = useMemo(
    () => findPriorities(trees, recentTrees, MAX_PRIORITIES),
    [trees, recentTrees],
  );
  const shown = pointed ?? { side, path: focusPath };

  const showSide = (next: Side) => {
    setSide(next);
    setFocusPath([]);
    setPointed(null);
  };

  const zoomTo = (path: readonly string[]) => {
    setFocusPath(path);
    setPointed(null);
  };

  // Cliquer une priorité n'en montre qu'un aperçu : l'étudier est un choix explicite.
  const previewPriority = (priority: Priority) => {
    setSide(priority.side);
    zoomTo(priority.path);
  };

  const isShown = (priority: Priority) =>
    priority.side === side && priority.path.join(' ') === focusPath.join(' ');

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' && event.key !== 'Backspace') return;
      if (studied) {
        setStudied(null);
        return;
      }
      setFocusPath((path) => path.slice(0, -1));
      setPointed(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [studied]);

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen pb-28" style={{ fontFamily: FONT_FAMILY, background: COLOURS.cream, color: COLOURS.leaf }}>
        <header className="mx-auto flex max-w-[84rem] items-center gap-4 px-8 pt-7">
          <Kumquat />
          <span className="text-[26px] font-bold tracking-[-0.03em]">kumquat</span>
          {!studied && (
            <span className="ml-auto">
              <SideSwitch side={side} onChange={showSide} />
            </span>
          )}
        </header>

        {studied ? (
          <main className="mx-auto max-w-[84rem] px-8 pt-8">
            <LineView
              key={`${studied.side}:${studied.path.join(' ')}`}
              tree={recentTrees[studied.side]}
              path={studied.path}
              onBack={() => setStudied(null)}
              onOpen={(path) => setStudied({ side: studied.side, path })}
            />
          </main>
        ) : (
          <main className="mx-auto grid max-w-[84rem] grid-cols-[minmax(0,30rem)_1fr] gap-10 px-8 pt-8">
            <BoardPanel
              history={trees[shown.side]}
              recent={recentTrees[shown.side]}
              path={shown.path}
              onStudy={focusPath.length > 0 ? () => setStudied({ side, path: focusPath }) : undefined}
            />
            <div className="flex min-w-0 flex-col gap-10">
              <PriorityTickets
                priorities={priorities}
                isSelected={isShown}
                onSelect={previewPriority}
                onPoint={setPointed}
              />
              {renderFlame({
                tree: trees[side],
                focusPath,
                onFocusChange: zoomTo,
                onPoint: (path) => setPointed(path && { side, path }),
                priorities,
              })}
            </div>
          </main>
        )}
      </div>
    </MotionConfig>
  );
}

function treesOf(games: readonly PlayedGame[], maxPlies: number): Record<Side, OpeningTree> {
  return { w: buildOpeningTree(games, 'w', maxPlies), b: buildOpeningTree(games, 'b', maxPlies) };
}
