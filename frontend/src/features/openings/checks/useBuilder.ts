import { useMemo, useState } from 'react';
import type { DraftMove } from '../domain/addition';
import type { GameCheck } from '../domain/gameCheck';
import { isPlayerMove } from '../domain/openingTree';
import type { PlayedGame, Side } from '../domain/playedGame';
import { replayLine } from '../position/replay';
import type { CheckedGame } from './checkedGame';

export type Deviation = Extract<GameCheck, { kind: 'left' | 'uncovered' }>;

/** D'où part une construction : un contrôle de partie, une priorité, ou n'importe quelle position de l'arbre. */
export interface BuildOrigin {
  side: Side;
  /** La position d'où le joueur construit. */
  start: readonly string[];
  /** Les coups déjà dans l'ajout avant qu'il ne joue : le coup adverse imprévu, ou une ligne jouée hors répertoire. */
  given: readonly (readonly string[])[];
  /** Le coup du joueur jugé depuis `start`, là où il a quitté le répertoire. */
  played?: string;
  /** Le joueur garde `played` : l'ajout part de là. */
  keep: boolean;
}

export function originOf(checked: CheckedGame & { check: Deviation }, keep = false): BuildOrigin {
  const { game, check } = checked;
  if (check.kind === 'uncovered') {
    // Le coup adverse imprévu entre au répertoire avec la réponse : c'est lui qu'on prépare.
    const start = game.moves.slice(0, check.ply + 1);
    return { side: game.side, start, given: [start], keep: false };
  }
  return { side: game.side, start: game.moves.slice(0, check.ply), given: [], played: check.played, keep };
}

/** Construire depuis une position de l'arbre, `path` pouvant déjà dépasser le répertoire de quelques coups. */
export function originAt(side: Side, known: readonly string[], path: readonly string[]): BuildOrigin {
  const given = path.slice(known.length).map((_, index) => path.slice(0, known.length + index + 1));
  return { side, start: known, given, keep: false };
}

export interface Builder {
  origin: BuildOrigin;
  /** La position d'où le joueur construit : avant son coup, ou après le coup adverse imprévu. */
  start: readonly string[];
  path: readonly string[];
  fen: string;
  playerToMove: boolean;
  draft: readonly DraftMove[];
  /** Ce que le joueur a lui-même joué depuis la position courante dans ses parties. */
  mine: ReadonlyMap<string, number>;
  /** Le joueur garde le coup de la partie : l'ajout part de là. */
  kept: boolean;
  /** Au moins un coup du joueur : le coup adverse imprévu seul ne fait pas un ajout. */
  complete: boolean;
  play: (san: string) => void;
  /** Va à une position du brouillon, sans rien retirer : c'est ainsi qu'on ouvre une branche. */
  goTo: (path: readonly string[]) => void;
  /** Navigation au clavier, comme sur Lichess : un coup en arrière ou en avant, le départ, le bout de la ligne. */
  navigate: (direction: 'back' | 'forward' | 'start' | 'end') => void;
  undo: (() => void) | undefined;
}

export function useBuilder(origin: BuildOrigin, games: readonly PlayedGame[]): Builder {
  const { side, start, given, played, keep } = origin;
  const [draft, setDraft] = useState<readonly DraftMove[]>(() => [
    ...given.map((path): DraftMove => ({ path, source: 'habit' })),
    ...(keep && played ? [{ path: [...start, played], source: 'habit' as const }] : []),
  ]);
  const [path, setPath] = useState<readonly string[]>(() => (draft.at(-1)?.path ?? start));

  const fen = useMemo(() => replayLine(path).fens[path.length], [path]);
  const playerToMove = (fen.split(' ')[1] === 'w') === (side === 'w');
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

  const locked = given.length;
  return {
    origin,
    start,
    path,
    fen,
    playerToMove,
    draft,
    mine,
    kept: keep && played !== undefined,
    // Un coup du joueur au moins : les coups donnés (adverse imprévu, ligne hors répertoire) peuvent déjà en contenir un.
    complete: draft.some((move) => isPlayerMove(side, move.path.length)),
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
