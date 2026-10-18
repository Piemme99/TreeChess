import { MotionConfig } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { buildOpeningTree, type OpeningTree } from './domain/openingTree';
import { gamesOfLastMonths } from './domain/period';
import type { PlayedGame, Side } from './domain/playedGame';
import { findPriorities, type Priority } from './domain/priorities';
import { repertoireLines } from './domain/repertoire';
import { gamesUntil } from './domain/replay';
import { FlameTiles } from './flame/FlameTiles';
import { playedGamesFixture } from './fixtures/playedGames';
import { LineView } from './line/LineView';
import { BoardPanel } from './position/BoardPanel';
import { PriorityTickets } from './priorities/PriorityTickets';
import { formatDay } from './replay/formatDay';
import { REPLAY_FIRST_DAY, REPLAY_START, repertoiresOf } from './replay/replaySetup';
import { useReplayDay } from './replay/useReplayDay';
import { PageHeader } from './workshop/PageHeader';
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

export function OpeningsPage() {
  useWorkshopFont();
  const [side, setSide] = useState<Side>('w');
  const [focusPath, setFocusPath] = useState<readonly string[]>([]);
  const [pointed, setPointed] = useState<Line | null>(null);
  const [studied, setStudied] = useState<Line | null>(null);

  const replay = useReplayDay(playedGamesFixture, REPLAY_FIRST_DAY);
  const knownGames = useMemo(() => gamesUntil(playedGamesFixture, replay.day), [replay.day]);
  const trees = useMemo(() => treesOf(knownGames), [knownGames]);
  const recentGames = useMemo(
    () => gamesOfLastMonths(knownGames, RECENT_MONTHS, new Date(replay.day)),
    [knownGames, replay.day],
  );
  const recentTrees = useMemo(() => treesOf(recentGames), [recentGames]);
  // Le répertoire ne suit pas l'horloge : il ne change que par les décisions du joueur (briques suivantes).
  const repertoires = useMemo(() => repertoiresOf(playedGamesFixture, REPLAY_START), []);
  const coveredLines = useMemo(() => repertoireLines(repertoires[side], trees[side]), [repertoires, trees, side]);
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
        <PageHeader>
          {!studied && (
            <span className="ml-auto flex items-center gap-6">
              <span className="text-[14px]" style={{ color: COLOURS.leafSoft }}>
                as of <span className="font-semibold">{formatDay(replay.day)}</span>
              </span>
              <SideSwitch side={side} onChange={showSide} />
            </span>
          )}
        </PageHeader>

        {studied ? (
          <main className="mx-auto max-w-[84rem] px-8 pt-8">
            <LineView
              key={`${studied.side}:${studied.path.join(' ')}`}
              tree={recentTrees[studied.side]}
              games={recentGames}
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
              repertoire={repertoires[shown.side]}
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
                coveredLines={coveredLines}
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

