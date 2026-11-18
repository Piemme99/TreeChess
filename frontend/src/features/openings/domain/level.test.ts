import { describe, expect, it } from 'vitest';
import { explorerLevel, levelLabel, playerRating } from './level';
import type { PlayedGame } from './playedGame';

const game = (rating?: number): PlayedGame => ({ side: 'w', moves: ['e4'], score: 1, playedAt: '2026-11-01', rating });

describe('explorer level', () => {
  it('a player rated 1515 prepares against replies of 1400–2000 players and picks their own moves among 2000+', () => {
    const level = explorerLevel(1515);
    expect(levelLabel(level.opponents)).toBe('1400–2000');
    expect(levelLabel(level.strong)).toBe('2000+');
  });

  it('without rated games, as for the sample player, the level stays 1600–2200 for replies and 2200+ for own moves', () => {
    const level = explorerLevel(playerRating([game(), game()]));
    expect(levelLabel(level.opponents)).toBe('1600–2200');
    expect(levelLabel(level.strong)).toBe('2200+');
  });

  it("the level follows the player's recent games, not their first ones", () => {
    const games = [...Array.from({ length: 30 }, () => game(1200)), ...Array.from({ length: 20 }, () => game(1600))];
    expect(playerRating(games)).toBe(1600);
  });
});
