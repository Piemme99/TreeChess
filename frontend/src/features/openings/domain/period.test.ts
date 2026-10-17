import { describe, expect, it } from 'vitest';
import { gamesOfLastMonths } from './period';
import type { PlayedGame } from './playedGame';

const playedOn = (playedAt: string): PlayedGame => ({ side: 'w', moves: ['e4'], score: 1, playedAt });

const games = [playedOn('2024-06-01'), playedOn('2025-10-17'), playedOn('2026-07-17'), playedOn('2026-10-01')];
const today = new Date('2026-10-17T12:00:00Z');

describe('gamesOfLastMonths', () => {
  it('keeps the games of the period, the boundary day included', () => {
    expect(gamesOfLastMonths(games, 3, today).map((g) => g.playedAt)).toEqual(['2026-07-17', '2026-10-01']);
  });

  it('counts months back from today', () => {
    expect(gamesOfLastMonths(games, 12, today).map((g) => g.playedAt)).toEqual([
      '2025-10-17', '2026-07-17', '2026-10-01',
    ]);
  });
});
