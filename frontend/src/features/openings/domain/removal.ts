import type { Addition } from './addition';
import type { Side } from './playedGame';
import type { Repertoire } from './repertoire';

/** Un coup que le joueur a retiré de son répertoire, daté du jour où il l'a retiré. */
export interface Removal {
  side: Side;
  position: string;
  san: string;
  removedAt: string;
}

const sameMove = (removal: Removal, side: Side, position: string, san: string) =>
  removal.side === side && removal.position === position && removal.san === san;

/**
 * Le répertoire sans les coups retirés. La suite d'un coup retiré reste rangée sous ses positions, mais plus rien n'y
 * mène : elle sort de la révision avec lui, sauf ce qu'une autre ligne atteint par transposition.
 */
export function withRemovals(repertoire: Repertoire, removals: readonly Removal[]): Repertoire {
  const mine = removals.filter((removal) => removal.side === repertoire.side);
  if (!mine.length) return repertoire;
  const moves = new Map(repertoire.moves);
  for (const { position, san } of mine) {
    const kept = (moves.get(position) ?? []).filter((move) => move.san !== san);
    if (kept.length) moves.set(position, kept);
    else moves.delete(position);
  }
  return { side: repertoire.side, moves };
}

/**
 * Le répertoire contre lequel se contrôle une partie jouée tel jour : un retrait ne vaut que pour les parties d'après,
 * sans quoi celles jouées avec le coup avant son retrait deviendraient autant de décisions à trancher.
 */
export function repertoiresOn(grown: Record<Side, Repertoire>, removals: readonly Removal[]) {
  const cache = new Map<string, Repertoire>();
  return (side: Side, day: string): Repertoire => {
    const before = removals.filter((removal) => removal.removedAt < day);
    const key = `${side} ${before.map((removal) => `${removal.position} ${removal.san}`).join('|')}`;
    let found = cache.get(key);
    if (!found) cache.set(key, (found = withRemovals(grown[side], before)));
    return found;
  };
}

/** Rajouter un coup retiré annule son retrait. */
export function withoutReadded(removals: readonly Removal[], addition: Addition): Removal[] {
  return removals.filter((removal) => !addition.moves.some(({ position, san }) => sameMove(removal, addition.side, position, san)));
}
