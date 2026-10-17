import { describe, expect, it } from 'vitest';
import { gamesInPeriod } from './period';
import type { PlayedGame } from './playedGame';

const playedOn = (playedAt: string): PlayedGame => ({ side: 'w', moves: ['e4'], score: 1, playedAt });

const games = [playedOn('2024-06-01'), playedOn('2025-10-17'), playedOn('2026-07-17'), playedOn('2026-10-01')];
const today = new Date('2026-10-17T12:00:00Z');

describe('gamesInPeriod', () => {
  it('keeps the games of the last three months, the boundary day included', () => {
    expect(gamesInPeriod(games, '3-months', today).map((g) => g.playedAt)).toEqual(['2026-07-17', '2026-10-01']);
  });

  it('keeps the games of the last year', () => {
    expect(gamesInPeriod(games, '1-year', today).map((g) => g.playedAt)).toEqual([
      '2025-10-17', '2026-07-17', '2026-10-01',
    ]);
  });

  it('keeps every game for the whole history', () => {
    expect(gamesInPeriod(games, 'all', today)).toHaveLength(4);
  });
});
