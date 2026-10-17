import type { PlayedGame } from './playedGame';

export type Period = '3-months' | '1-year' | 'all';

const MONTHS_BACK: Record<Exclude<Period, 'all'>, number> = {
  '3-months': 3,
  '1-year': 12,
};

export function gamesInPeriod(games: readonly PlayedGame[], period: Period, today: Date): PlayedGame[] {
  if (period === 'all') return [...games];
  const since = new Date(today);
  since.setUTCMonth(since.getUTCMonth() - MONTHS_BACK[period]);
  const sinceIso = since.toISOString().slice(0, 10);
  return games.filter((game) => game.playedAt >= sinceIso);
}
