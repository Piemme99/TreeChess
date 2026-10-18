import { describe, expect, it } from 'vitest';
import type { PlayedGame } from './playedGame';
import { dayBefore, gameDaysAfter, gamesUntil } from './replay';

const on = (playedAt: string): PlayedGame => ({ side: 'w', moves: ['e4'], score: 1, playedAt });

describe('gamesUntil', () => {
  it('keeps the games played up to the day, that day included', () => {
    const games = [on('2025-12-31'), on('2026-01-02'), on('2026-01-03')];

    expect(gamesUntil(games, '2026-01-02').map((game) => game.playedAt)).toEqual(['2025-12-31', '2026-01-02']);
  });
});

describe('gameDaysAfter', () => {
  it('lists each later day with games once, in order', () => {
    const games = [on('2026-01-05'), on('2025-12-30'), on('2026-01-02'), on('2026-01-05')];

    expect(gameDaysAfter(games, '2025-12-31')).toEqual(['2026-01-02', '2026-01-05']);
  });
});

describe('dayBefore', () => {
  it('steps back across a year', () => {
    expect(dayBefore('2026-01-01')).toBe('2025-12-31');
  });
});
