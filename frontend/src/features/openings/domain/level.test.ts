import { describe, expect, it } from 'vitest';
import { explorerLevel, levelLabel, playerRating } from './level';
import type { PlayedGame } from './playedGame';

const game = (rating?: number, key?: string): PlayedGame => ({ side: 'w', moves: ['e4'], score: 1, playedAt: '2026-11-01', rating, key });

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

  it('reads the Lichess ratings when the player has some, even if their latest games are on Chess.com: the explorer counts Lichess ratings', () => {
    const games = [...Array.from({ length: 5 }, (_, i) => game(1515, `lichess:${i}`)), ...Array.from({ length: 20 }, (_, i) => game(1163, `chesscom:${i}`))];
    expect(playerRating(games)).toBe(1515);
    expect(playerRating(games.slice(5))).toBe(1163);
  });
});
