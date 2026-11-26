import { describe, expect, it } from 'vitest';
import type { CheckedGame } from './checkedGame';
import { gamesToDecide } from './decisions';

const TODAY = '2026-02-10';

const checked = (id: number, playedAt: string, kind: 'left' | 'uncovered' | 'followed', asks = true): CheckedGame => ({
  id,
  game: { side: 'w', moves: ['e4', 'e5'], score: 0, playedAt },
  check: kind === 'followed' ? { kind, plies: 2 } : { kind, ply: 1, played: 'e5', planned: ['c5'], position: 'e4' },
  answered: [],
  asks,
});

const ids = (games: readonly CheckedGame[]) => games.map((game) => game.id);

describe('gamesToDecide', () => {
  it("puts every game of the day that left the repertoire first, even an opponent move met once", () => {
    expect(ids(gamesToDecide([checked(1, TODAY, 'left'), checked(2, TODAY, 'uncovered', false)], new Set(), TODAY))).toEqual([1, 2]);
  });

  it('keeps from the earlier days only the games that still ask, the latest first', () => {
    const lived = [checked(1, '2026-02-01', 'left'), checked(2, '2026-02-05', 'uncovered', false), checked(3, '2026-02-08', 'uncovered'), checked(4, TODAY, 'left')];

    expect(ids(gamesToDecide(lived, new Set(), TODAY))).toEqual([4, 3, 1]);
  });

  it('leaves out the games set aside and those that followed the repertoire', () => {
    const lived = [checked(1, TODAY, 'left'), checked(2, TODAY, 'followed'), checked(3, '2026-02-01', 'left')];

    expect(ids(gamesToDecide(lived, new Set([1, 3]), TODAY))).toEqual([]);
  });
});
