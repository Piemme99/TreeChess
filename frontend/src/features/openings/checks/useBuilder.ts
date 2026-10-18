import { useMemo, useState } from 'react';
import type { DraftMove } from '../domain/addition';
import type { GameCheck } from '../domain/gameCheck';
import type { PlayedGame } from '../domain/playedGame';
import { replayLine } from '../position/replay';
import type { CheckedGame } from './checkedGame';

export type Deviation = Extract<GameCheck, { kind: 'left' | 'uncovered' }>;

export interface Builder {
  checked: CheckedGame & { check: Deviation };
  /** La position d'où le joueur construit : avant son coup, ou après le coup adverse imprévu. */
  start: readonly string[];
  path: readonly string[];
  fen: string;
  playerToMove: boolean;
  draft: readonly DraftMove[];
  /** Ce que le joueur a lui-même joué depuis la position courante dans ses parties. */
  mine: ReadonlyMap<string, number>;
  /** Au moins un coup du joueur : le coup adverse imprévu seul ne fait pas un ajout. */
  complete: boolean;
  play: (san: string) => void;
  /** Va à une position du brouillon, sans rien retirer : c'est ainsi qu'on ouvre une branche. */
  goTo: (path: readonly string[]) => void;
  /** Navigation au clavier, comme sur Lichess : un coup en arrière ou en avant, le départ, le bout de la ligne. */
  navigate: (direction: 'back' | 'forward' | 'start' | 'end') => void;
  undo: (() => void) | undefined;
}

export function useBuilder(checked: CheckedGame & { check: Deviation }, games: readonly PlayedGame[]): Builder {
  const { game, check } = checked;
  const start = useMemo(() => game.moves.slice(0, check.kind === 'left' ? check.ply : check.ply + 1), [game.moves, check]);
  // Le coup adverse imprévu entre au répertoire avec la réponse : c'est lui qu'on prépare.
  const [draft, setDraft] = useState<readonly DraftMove[]>(() => (check.kind === 'uncovered' ? [{ path: start, source: 'habit' }] : []));
  const [path, setPath] = useState<readonly string[]>(start);

  const fen = useMemo(() => replayLine(path).fens[path.length], [path]);
  const playerToMove = (fen.split(' ')[1] === 'w') === (game.side === 'w');
  const mine = useMemo(() => {
    const counts = new Map<string, number>();
    for (const played of games) {
      if (!path.every((san, index) => played.moves[index] === san)) continue;
      const next = played.moves[path.length];
      if (next) counts.set(next, (counts.get(next) ?? 0) + 1);
    }
    return counts;
  }, [games, path]);

  const play = (san: string) => {
    const next = [...path, san];
    const key = next.join(' ');
    if (!draft.some((move) => move.path.join(' ') === key)) {
      setDraft([...draft, { path: next, source: mine.has(san) ? 'habit' : 'level' }]);
    }
    setPath(next);
  };

  // En avant, on suit la branche jouée en dernier depuis la position.
  const next = (from: readonly string[]) => {
    const key = from.join(' ');
    const children = draft.filter((move) => move.path.length === from.length + 1 && move.path.slice(0, -1).join(' ') === key);
    return children.at(-1)?.path;
  };
  const navigate = (direction: 'back' | 'forward' | 'start' | 'end') => {
    if (direction === 'back' && path.length > start.length) setPath(path.slice(0, -1));
    if (direction === 'start') setPath(start);
    if (direction === 'forward') setPath(next(path) ?? path);
    if (direction === 'end') {
      let end = path;
      for (let step = next(end); step; step = next(end)) end = step;
      setPath(end);
    }
  };

  const locked = check.kind === 'uncovered' ? 1 : 0;
  return {
    checked,
    start,
    path,
    fen,
    playerToMove,
    draft,
    mine,
    complete: draft.length > locked,
    play,
    goTo: setPath,
    navigate,
    undo:
      draft.length > locked
        ? () => {
            const last = draft[draft.length - 1];
            setDraft(draft.slice(0, -1));
            setPath(last.path.slice(0, -1).length >= start.length ? last.path.slice(0, -1) : start);
          }
        : undefined,
  };
}
