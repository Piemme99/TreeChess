import type { PlayedGame } from './playedGame';

/** Les tranches de l'explorateur Lichess : 1600 compte les parties de 1600 à 1799, 2500 tout ce qui est au-dessus. */
const BUCKETS = [0, 1000, 1200, 1400, 1600, 1800, 2000, 2200, 2500];
// Sans partie classée (la démo), le niveau que PMG a choisi le 16/11/2026 : des adversaires de 1700 à 2100.
const DEFAULT_RATING = 1800;
const RECENT_GAMES = 20;
// Les adversaires contre qui se préparer : ceux qu'on rencontre, et un peu plus forts.
const OPPONENTS_BELOW = 100;
const OPPONENTS_ABOVE = 300;
// Ses propres coups se choisissent chez des joueurs nettement plus forts, et jamais faibles.
const STRONG_ABOVE = 400;
const STRONG_FLOOR = 2000;

export interface ExplorerLevel {
  /** Les tranches où lire les réponses adverses. */
  opponents: number[];
  /** Les tranches où lire ses propres coups. */
  strong: number[];
}

/** Le classement du joueur : la médiane de ses dernières parties, sa forme du moment plutôt que son passé. */
export function playerRating(games: readonly PlayedGame[]): number {
  const ratings = games.flatMap((game) => (game.rating ? [game.rating] : [])).slice(-RECENT_GAMES);
  if (!ratings.length) return DEFAULT_RATING;
  const sorted = [...ratings].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

const bucketsBetween = (low: number, high: number) =>
  BUCKETS.filter((bucket, index) => bucket <= high && (BUCKETS[index + 1] ?? Infinity) > low);

export function explorerLevel(rating: number): ExplorerLevel {
  return {
    opponents: bucketsBetween(rating - OPPONENTS_BELOW, rating + OPPONENTS_ABOVE),
    strong: bucketsBetween(Math.max(rating + STRONG_ABOVE, STRONG_FLOOR), Infinity),
  };
}

/** Les tranches telles qu'on les nomme à l'écran : « 1600–2200 », « 2200+ ». */
export function levelLabel(buckets: readonly number[]): string {
  const last = buckets[buckets.length - 1];
  const end = BUCKETS[BUCKETS.indexOf(last) + 1];
  return end === undefined ? `${buckets[0]}+` : `${buckets[0]}–${end}`;
}
