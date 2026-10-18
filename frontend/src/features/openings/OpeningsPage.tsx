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

// Au-delà de ce que la racine montre : la profondeur sert au zoom, la racine est coupée avant.
const MAX_PLIES = 24;
const MAX_PRIORITIES = 5;
const RECENT_MONTHS = 12;

interface Line {
  side: Side;
  path: readonly string[];
}

export interface LineSlotProps {
  tree: OpeningTree;
  path: readonly string[];
  onBack: () => void;
  onOpen: (path: readonly string[]) => void;
}

interface OpeningsPageProps {
  /** Point d'injection du prototype de vue de ligne (line-prototype/) ; LineView par défaut. */
  renderLine?: (props: LineSlotProps) => ReactNode;
  studyFirstPriority?: boolean;
}

const defaultLine = (props: LineSlotProps) => <LineView key={`${props.tree.side}:${props.path.join(' ')}`} {...props} />;

export function OpeningsPage({ renderLine = defaultLine, studyFirstPriority = false }: OpeningsPageProps = {}) {
  useWorkshopFont();
  const trees = useMemo(() => treesOf(playedGamesFixture), []);
  const recentTrees = useMemo(
    () => treesOf(gamesOfLastMonths(playedGamesFixture, RECENT_MONTHS, new Date())),
    [],
  );
  const priorities = useMemo(
    () => findPriorities(trees, recentTrees, MAX_PRIORITIES),
    [trees, recentTrees],
  );

  const [side, setSide] = useState<Side>(() => (studyFirstPriority && priorities[0]?.side) || 'w');
  const [focusPath, setFocusPath] = useState<readonly string[]>(() => (studyFirstPriority && priorities[0]?.path) || []);
  const [pointed, setPointed] = useState<Line | null>(null);
  const [studied, setStudied] = useState<Line | null>(() => (studyFirstPriority && priorities[0]) || null);
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

  const isShown = (priority: Priority) =>
    priority.side === side && priority.path.join(' ') === focusPath.join(' ');

  // Cliquer une priorité n'en montre qu'un aperçu : l'étudier est un choix explicite.
  const togglePriority = (priority: Priority) => {
    if (isShown(priority)) {
      zoomTo([]);
      return;
    }
    setSide(priority.side);
    zoomTo(priority.path);
  };

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
            {renderLine({
              tree: recentTrees[studied.side],
              path: studied.path,
              onBack: () => setStudied(null),
              onOpen: (path) => setStudied({ side: studied.side, path }),
            })}
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
                onSelect={togglePriority}
                onPoint={setPointed}
              />
              <FlameTiles
                key={side}
                tree={trees[side]}
                focusPath={focusPath}
                onFocusChange={zoomTo}
                onPoint={(path) => setPointed(path && { side, path })}
                priorities={priorities}
              />
            </div>
          </main>
        )}
      </div>
    </MotionConfig>
  );
}

function treesOf(games: readonly PlayedGame[]): Record<Side, OpeningTree> {
  return { w: buildOpeningTree(games, 'w', MAX_PLIES), b: buildOpeningTree(games, 'b', MAX_PLIES) };
}
