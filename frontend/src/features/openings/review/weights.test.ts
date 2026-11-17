import { Chess } from 'chess.js';
import { describe, expect, it } from 'vitest';
import type { CheckedGame } from '../checks/checkedGame';
import { buildOpeningTree } from '../domain/openingTree';
import { gamesOfLastMonths } from '../domain/period';
import type { PlayedGame } from '../domain/playedGame';
import { positionKey, type Repertoire } from '../domain/repertoire';
import { planLine, seededState } from '../domain/review';
import { playedGamesFixture } from '../fixtures/playedGames';
import { REPLAY_START, repertoiresOf } from '../replay/replaySetup';
import { encountersOf, lapsesOf, reviewWeight } from './weights';

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
  it('puts a position missed in a game above a recent addition, and that above the rest, however often they are met', () => {
    const weight = reviewWeight(new Map([['missed', '2026-01-05']]), new Map([['old', 1]]), repertoire, SINCE);

    expect(weight('missed')).toBeGreaterThan(weight('added'));
    expect(weight('added')).toBeGreaterThan(weight('old'));
  });

  it('puts first, between two positions of the same kind, the one met in more games', () => {
    const weight = reviewWeight(new Map(), new Map([['old', 0.4], ['missed', 0.1]]), repertoire, SINCE);

    expect(weight('old')).toBeGreaterThan(weight('missed'));
  });

  it("starts PMG's first review on his black answer to 1.d4, the position he meets most", () => {
    const habits = gamesOfLastMonths(playedGamesFixture, 12, new Date(REPLAY_START)).filter((game) => game.playedAt < REPLAY_START);
    const repertoires = repertoiresOf(playedGamesFixture, REPLAY_START);
    const plans = (['w', 'b'] as const).map((side) => {
      const state = seededState(repertoires[side], buildOpeningTree(habits, side, 40), REPLAY_START);
      return { side, ...planLine(repertoires[side], state, REPLAY_START, reviewWeight(new Map(), encountersOf(habits, side), repertoires[side], REPLAY_START))! };
    });
    const first = plans.sort((a, b) => b.weight - a.weight)[0];

    expect(first.side).toBe('b');
    expect(first.target).toBe(positionKey(new Chess().move('d4').after));
  });
});

describe('encountersOf', () => {
  const played = (side: 'w' | 'b', moves: string): PlayedGame => ({ side, moves: moves.split(' '), score: 1, playedAt: SINCE });

  it("counts the share of the player's games that reach a position, two move orders together", () => {
    const games = [played('w', 'Nf3 d5 d4 Nf6 c4'), played('w', 'd4 Nf6 Nf3 d5 e3'), played('w', 'e4 e5 Nf3 Nc6 Bb5'), played('b', 'd4 Nf6 Nf3 d5 e3')];
    const encounters = encountersOf(games.flatMap((game) => Array<PlayedGame>(5).fill(game)), 'w');

    const transposed = new Chess();
    for (const san of ['d4', 'Nf6', 'Nf3', 'd5']) transposed.move(san);
    expect(encounters.get(positionKey(new Chess().fen()))).toBe(1);
    expect(encounters.get(positionKey(transposed.fen()))).toBeCloseTo(2 / 3);
  });
});

describe('lapsesOf', () => {
  it("remembers the last day the player left the repertoire at a position, not the opponent's surprises", () => {
    const lapses = lapsesOf([game('left', 'missed', '2026-01-05'), game('left', 'missed', '2026-01-09'), game('uncovered', 'old', '2026-01-09')]);

    expect(lapses.w).toEqual(new Map([['missed', '2026-01-09']]));
    expect(lapses.b.size).toBe(0);
  });
});
