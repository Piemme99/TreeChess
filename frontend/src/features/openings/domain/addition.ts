import { Chess } from 'chess.js';
import type { MoveSource } from './preparation';
import { positionKey, type Repertoire, type RepertoireMove } from './repertoire';

export interface AddedMove {
  position: string;
  san: string;
  source: MoveSource;
}

/** Un ajout accepté par le joueur, daté du jour où il l'a accepté. */
export interface Addition {
  side: Repertoire['side'];
  addedAt: string;
  moves: AddedMove[];
}

/** Un coup joué par le joueur pendant qu'il construit son ajout : `path` part du début et finit par lui. */
export interface DraftMove {
  path: readonly string[];
  source: MoveSource;
}

export function draftMoves(draft: readonly DraftMove[]): AddedMove[] {
  return draft.map(({ path, source }) => {
    const chess = new Chess();
    for (const san of path.slice(0, -1)) chess.move(san);
    return { position: positionKey(chess.fen()), san: path[path.length - 1], source };
  });
}

/** Les lignes du brouillon, chacune jusqu'à son dernier coup : celles qu'aucune autre ne prolonge. */
export function draftLines(draft: readonly DraftMove[]): (readonly string[])[] {
  const keys = draft.map(({ path }) => path.join(' '));
  return draft.filter((_, index) => !keys.some((key) => key.startsWith(`${keys[index]} `))).map(({ path }) => path);
}

export function withAdditions(repertoire: Repertoire, additions: readonly Addition[]): Repertoire {
  const moves = new Map<string, readonly RepertoireMove[]>(repertoire.moves);
  for (const addition of additions) {
    if (addition.side !== repertoire.side) continue;
    for (const { position, san, source } of addition.moves) {
      const known = moves.get(position) ?? [];
      if (!known.some((move) => move.san === san)) moves.set(position, [...known, { san, source, addedAt: addition.addedAt }]);
    }
  }
  return { side: repertoire.side, moves };
}
