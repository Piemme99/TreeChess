import { useCallback, useMemo, useState } from 'react';
import type { BuildOrigin } from '../checks/useBuilder';
import { gamesOfLastMonths } from '../domain/period';
import type { PlayedGame, Side } from '../domain/playedGame';
import { RECENT_MONTHS } from './useRepertoireMaps';
import type { TreeWalk } from './useTreeWalk';

/** Une ligne en construction : d'où elle part, l'étape qu'elle règle, la faiblesse qu'elle travaille. */
export interface Building {
  origin: BuildOrigin;
  stepKey?: string;
  worked?: { side: Side; path: readonly string[] };
}

/** La construction d'une ligne à la place du volet, et ce qu'elle montre sur la carte. */
export function useBuilding({ walk, known, day, toTop }: { walk: TreeWalk; known: readonly PlayedGame[]; day: string; toTop: () => void }) {
  const [building, setBuilding] = useState<Building | null>(null);
  const [preview, setPreview] = useState<readonly (readonly string[])[]>([]);
  const [buildPath, setBuildPath] = useState<readonly string[] | null>(null);
  const { focusOn, path, node } = walk;
  // La carte suit l'échiquier du constructeur : le coup qu'on regarde y est sélectionné et gardé en vue.
  const follow = useCallback(
    (next: readonly string[]) => {
      setBuildPath(next);
      focusOn(next.join(' '), false);
    },
    [focusOn],
  );
  const showLines = useCallback(
    (lines: (readonly string[])[]) => {
      setPreview(lines);
      const last = lines.at(-1);
      if (last) focusOn(last.join(' '), true);
    },
    [focusOn],
  );
  const build = (next: Building | null) => {
    setBuilding(next);
    setPreview([]);
    setBuildPath(null);
    toTop();
    if (next) focusOn(next.origin.start.join(' '), true);
  };
  const habits = useMemo(
    () => gamesOfLastMonths(known, RECENT_MONTHS, new Date(day)).filter((game) => game.side === building?.origin.side),
    [known, day, building?.origin.side],
  );
  // Une ligne jouée hors du répertoire se voit aussi sur la carte, en fantôme, là où elle quitte le répertoire.
  const shownPreview = useMemo(() => (building ? preview : path.length > node.path.length ? [path] : []), [building, preview, path, node.path.length]);

  return { building, buildPath, build, follow, showLines, habits, shownPreview };
}
