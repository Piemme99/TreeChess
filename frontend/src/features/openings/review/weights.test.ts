import { describe, expect, it } from 'vitest';
import type { CheckedGame } from '../checks/checkedGame';
import type { Repertoire } from '../domain/repertoire';
import { lapsesOf, reviewWeight } from './weights';

const SINCE = '2026-01-01';

const repertoire: Repertoire = {
  side: 'w',
  moves: new Map([
    ['old', [{ san: 'e4', source: 'habit', addedAt: SINCE }]],
    ['added', [{ san: 'Nf3', source: 'level', addedAt: '2026-01-04' }]],
    ['missed', [{ san: 'd4', source: 'habit', addedAt: SINCE }]],
  ]),
};

const game = (kind: 'left' | 'uncovered', position: string, playedAt: string): CheckedGame => ({
  id: 0,
  game: { side: 'w', moves: ['e4'], score: 0, playedAt },
  check: { kind, ply: 0, played: 'e4', planned: ['d4'], position },
  asks: true,
});

describe('reviewWeight', () => {
  it('puts a position missed in a game above a recent addition, and that above the rest', () => {
    const weight = reviewWeight(new Map([['missed', '2026-01-05']]), repertoire, SINCE);

    expect(weight('missed')).toBeGreaterThan(weight('added'));
    expect(weight('added')).toBeGreaterThan(weight('old'));
  });
});

describe('lapsesOf', () => {
  it("remembers the last day the player left the repertoire at a position, not the opponent's surprises", () => {
    const lapses = lapsesOf([game('left', 'missed', '2026-01-05'), game('left', 'missed', '2026-01-09'), game('uncovered', 'old', '2026-01-09')]);

    expect(lapses.w).toEqual(new Map([['missed', '2026-01-09']]));
    expect(lapses.b.size).toBe(0);
  });
});
