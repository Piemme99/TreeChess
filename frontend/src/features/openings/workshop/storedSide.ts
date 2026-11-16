import type { Side } from '../domain/playedGame';

const STORAGE = 'kumquat.v2.side';

/** La couleur regardée en dernier, partagée par les pages : passer de l'arbre à Openings ne doit pas la perdre. */
export const storedSide = (): Side => (localStorage.getItem(STORAGE) === 'b' ? 'b' : 'w');
export const storeSide = (side: Side) => localStorage.setItem(STORAGE, side);
