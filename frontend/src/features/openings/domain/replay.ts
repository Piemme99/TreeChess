import type { PlayedGame } from './playedGame';

/** Les parties jouées jusqu'au jour donné inclus : ce que le joueur a derrière lui ce jour-là. */
export function gamesUntil(games: readonly PlayedGame[], day: string): PlayedGame[] {
  return games.filter((game) => game.playedAt <= day);
}

/** Les jours où au moins une partie a été jouée après le jour donné, dans l'ordre. */
export function gameDaysAfter(games: readonly PlayedGame[], day: string): string[] {
  return [...new Set(games.map((game) => game.playedAt).filter((playedAt) => playedAt > day))].sort();
}

export function dayBefore(day: string): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

export function dayAfter(day: string): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

/** Pour des parties importées, les nouvelles sont celles du dernier jour joué depuis l'import ; avant, le jour de l'import. */
export function lastDayPlayed(games: readonly PlayedGame[], importedOn: string): string {
  return gameDaysAfter(games, importedOn).at(-1) ?? importedOn;
}
