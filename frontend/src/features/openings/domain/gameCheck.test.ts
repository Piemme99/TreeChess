import { describe, expect, it } from 'vitest';
import type { PlayedGame } from './playedGame';
import { createRepertoire } from './repertoire';
import { asksDecision, checkGame } from './gameCheck';

const habits = (count: number, side: PlayedGame['side'], moves: string): PlayedGame[] =>
  Array.from({ length: count }, () => ({ side, moves: moves.split(' '), score: 1, playedAt: '2025-06-01' }));

const game = (side: PlayedGame['side'], moves: string): PlayedGame => ({ side, moves: moves.split(' '), score: 0, playedAt: '2026-01-04' });

const white = createRepertoire([...habits(10, 'w', 'e4 e5 Nf3 Nc6 Bb5'), ...habits(10, 'w', 'e4 c5 Nf3')], 'w', '2026-01-01');

const decisions = (...games: PlayedGame[]) => asksDecision(games.map((played) => ({ game: played, check: checkGame(white, played) })));

describe('checkGame', () => {
  it('says the player left the repertoire, at which move and what it holds', () => {
    expect(checkGame(white, game('w', 'e4 e5 Nf3 Nc6 Bc4 Nf6'))).toMatchObject({ kind: 'left', ply: 4, played: 'Bc4', planned: ['Bb5'] });
  });

  it('says the opponent left it when they play a reply it does not hold', () => {
    expect(checkGame(white, game('w', 'e4 e6 d4'))).toMatchObject({ kind: 'uncovered', ply: 1, played: 'e6', planned: ['e5', 'c5'] });
  });

  it('says the game followed the repertoire to its end', () => {
    expect(checkGame(white, game('w', 'e4 e5 Nf3 Nc6 Bb5 a6 Ba4'))).toEqual({ kind: 'followed', plies: 5 });
  });

  it('says the game followed the repertoire when it stops inside it', () => {
    expect(checkGame(white, game('w', 'e4 e5'))).toEqual({ kind: 'followed', plies: 2 });
  });

  it('reads the game from the side the player had', () => {
    const black = createRepertoire(habits(10, 'b', 'd4 d5 c4 e6'), 'b', '2026-01-01');

    expect(checkGame(black, game('b', 'd4 d5 c4 c6'))).toMatchObject({ kind: 'left', ply: 3, played: 'c6', planned: ['e6'] });
    expect(checkGame(black, game('b', 'e4 e5'))).toMatchObject({ kind: 'uncovered', ply: 0, played: 'e4', planned: ['d4'] });
  });
});

describe('asksDecision', () => {
  it('asks about every move of the player outside the repertoire', () => {
    expect(decisions(game('w', 'e4 e5 Nf3 Nc6 Bc4'))).toEqual([true]);
  });

  it('asks about an opponent move outside the repertoire only when it comes back', () => {
    expect(decisions(game('w', 'e4 e6 d4'), game('w', 'e4 d5 exd5'), game('w', 'e4 e6 d3'))).toEqual([false, false, true]);
  });

  it('never asks about a game that followed the repertoire', () => {
    expect(decisions(game('w', 'e4 e5 Nf3 Nc6 Bb5'))).toEqual([false]);
  });
});
