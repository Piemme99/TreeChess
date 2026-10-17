import type { PlayedGame } from './playedGame';

export function gamesOfLastMonths(games: readonly PlayedGame[], months: number, today: Date): PlayedGame[] {
  const since = new Date(today);
  since.setUTCMonth(since.getUTCMonth() - months);
  const sinceIso = since.toISOString().slice(0, 10);
  return games.filter((game) => game.playedAt >= sinceIso);
}
