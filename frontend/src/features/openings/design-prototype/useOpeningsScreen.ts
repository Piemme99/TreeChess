// PROTOTYPE — état de l'écran recopié de FlameGraphPage, partagé par les trois directions.
import { useEffect, useMemo, useState } from 'react';
import { buildOpeningTree, type OpeningTree } from '../domain/openingTree';
import { gamesOfLastMonths } from '../domain/period';
import type { PlayedGame, Side } from '../domain/playedGame';
import { findPriorities, type Priority } from '../domain/priorities';
import { playedGamesFixture } from '../fixtures/playedGames';

const MAX_PLIES = 16;
const MAX_PRIORITIES = 5;
const RECENT_MONTHS = 12;

export interface Line {
  side: Side;
  path: readonly string[];
}

export function useOpeningsScreen() {
  const trees = useMemo(() => treesOf(playedGamesFixture), []);
  const recentTrees = useMemo(
    () => treesOf(gamesOfLastMonths(playedGamesFixture, RECENT_MONTHS, new Date())),
    [],
  );
  const priorities = useMemo(
    () => findPriorities(trees, recentTrees, MAX_PRIORITIES),
    [trees, recentTrees],
  );

  const [side, setSide] = useState<Side>('w');
  const [focusPath, setFocusPath] = useState<readonly string[]>([]);
  const [pointed, setPointed] = useState<Line | null>(null);
  const shown: Line = pointed ?? { side, path: focusPath };

  const showSide = (next: Side) => {
    setSide(next);
    setFocusPath([]);
    setPointed(null);
  };

  const showPriority = (priority: Priority) => {
    setSide(priority.side);
    setFocusPath(priority.path);
    setPointed(null);
  };

  const zoomTo = (path: readonly string[]) => {
    setFocusPath(path);
    setPointed(null);
  };

  const isShown = (priority: Priority) =>
    priority.side === side && priority.path.join(' ') === focusPath.join(' ');

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' || event.key === 'Backspace') {
        setFocusPath((path) => path.slice(0, -1));
        setPointed(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return {
    trees,
    tree: trees[side],
    priorities,
    side,
    focusPath,
    shown,
    pointed,
    showSide,
    showPriority,
    zoomTo,
    isShown,
    point: (line: Line | null) => setPointed(line),
  };
}

function treesOf(games: readonly PlayedGame[]): Record<Side, OpeningTree> {
  return {
    w: buildOpeningTree(games, 'w', MAX_PLIES),
    b: buildOpeningTree(games, 'b', MAX_PLIES),
  };
}

export type OpeningsScreen = ReturnType<typeof useOpeningsScreen>;
