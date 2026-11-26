import { Chess } from 'chess.js';
import { describe, expect, it } from 'vitest';
import { findGaps } from './gaps';
import type { ExplorerStats } from './preparation';
import { positionKey, type Repertoire, type RepertoireMove } from './repertoire';

const fenAfter = (moves: string) => {
  const chess = new Chess();
  for (const san of moves.split(' ').filter(Boolean)) chess.move(san);
  return chess.fen();
};

const repertoireOf = (side: Repertoire['side'], lines: Record<string, string[]>): Repertoire => ({
  side,
  moves: new Map(Object.entries(lines).map(([moves, sans]) => [positionKey(fenAfter(moves)), sans.map((san): RepertoireMove => ({ san, source: 'habit', addedAt: '2026-01-01' }))])),
});

/** Ce que jouent les adversaires du niveau du joueur : des parties par coup, toutes nulles pour simplifier. */
const explorerOf = (positions: Record<string, Record<string, number>>) => {
  const stats = new Map(
    Object.entries(positions).map(([moves, played]): [string, ExplorerStats] => {
      const tallies = Object.entries(played).map(([san, games]) => ({ san, white: 0, draws: games, black: 0 }));
      return [positionKey(fenAfter(moves)), { white: 0, draws: tallies.reduce((sum, move) => sum + move.draws, 0), black: 0, moves: tallies }];
    }),
  );
  return (fen: string) => stats.get(positionKey(fen));
};

const lines = (gaps: ReturnType<typeof findGaps>['gaps']) => gaps.map((gap) => gap.path.join(' '));

describe('gaps', () => {
  // Noirs : 1…e5 contre 1.e4, 1…d5 contre 1.d4 ; rien contre 1.c4.
  const black = repertoireOf('b', { e4: ['e5'], d4: ['d5'] });

  it('is an opponent move reaching at least 1 game in 200 at the player level with no move of theirs after it, the most frequent first', () => {
    const { gaps } = findGaps(black, explorerOf({ '': { e4: 500, d4: 300, c4: 150, b3: 4 }, 'e4 e5': {}, 'd4 d5': {} }));
    expect(lines(gaps)).toEqual(['c4']);
    expect(gaps[0].reach).toBeCloseTo(150 / 954);
  });

  it('multiplies the opponent shares along the line: a frequent reply after a rare move can stay under the goal', () => {
    const { gaps } = findGaps(black, explorerOf({ '': { e4: 900, d4: 100 }, 'e4 e5': { Nf3: 990, Bc4: 10 }, 'd4 d5': { c4: 40, Bf4: 60 } }));
    // 1.d4 d5 2.♗f4 : 10 % × 60 % = 6 % ; 1.e4 e5 2.♗c4 : 90 % × 1 % = 0,9 % ; 1.e4 e5 2.♘f3 : 89 %.
    expect(lines(gaps)).toEqual(['e4 e5 Nf3', 'd4 d5 Bf4', 'd4 d5 c4', 'e4 e5 Bc4']);
    expect(lines(findGaps(black, explorerOf({ '': { e4: 900, d4: 100 }, 'e4 e5': { Nf3: 990, Bc4: 4 }, 'd4 d5': { c4: 40, Bf4: 60 } })).gaps)).not.toContain('e4 e5 Bc4');
  });

  it('closes once the repertoire has a move after it', () => {
    const covered = repertoireOf('b', { e4: ['e5'], d4: ['d5'], c4: ['e5'] });
    const { gaps } = findGaps(covered, explorerOf({ '': { e4: 500, d4: 300, c4: 150 }, 'e4 e5': {}, 'd4 d5': {}, 'c4 e5': {} }));
    expect(gaps).toEqual([]);
  });

  it('adds up two move orders that reach the same position', () => {
    const white = repertoireOf('w', { '': ['d4'], d4: ['Nf6', 'd5'], 'd4 Nf6': ['c4'], 'd4 d5': ['c4'] });
    const { gaps } = findGaps(white, explorerOf({ d4: { Nf6: 50, d5: 50 }, 'd4 Nf6 c4': { e6: 100 }, 'd4 d5 c4': { Nf6: 100 } }));
    // 1.d4 ♘f6 2.c4 e6 et 1.d4 d5 2.c4 ♘f6 sont deux positions différentes ; 1.d4 ♘f6 2.c4 d5 n'est pas jouée ici.
    expect(lines(gaps)).toEqual(['d4 Nf6 c4 e6', 'd4 d5 c4 Nf6']);
    const transposing = findGaps(white, explorerOf({ d4: { Nf6: 50, d5: 50 }, 'd4 Nf6 c4': { d5: 100 }, 'd4 d5 c4': { Nf6: 100 } })).gaps;
    expect(transposing).toHaveLength(1);
    expect(transposing[0].reach).toBeCloseTo(1);
  });

  it('counts two of the player own choices that transpose once, not twice', () => {
    // 1.d4 et 1.♘f3 : deux façons de jouer, pas deux parts des parties ; ♘f6 répond aux deux, puis 2.♘f3 / 2.d4.
    const white = repertoireOf('w', { '': ['d4', 'Nf3'], d4: ['Nf6'], Nf3: ['Nf6'], 'd4 Nf6': ['Nf3'], 'Nf3 Nf6': ['d4'] });
    const { gaps } = findGaps(white, explorerOf({ d4: { Nf6: 95, d5: 5 }, Nf3: { Nf6: 95, d5: 5 }, 'd4 Nf6 Nf3': { e6: 100 } }));
    const shared = gaps.find((gap) => gap.path.join(' ').endsWith('e6'));
    expect(shared?.reach).toBeCloseTo(0.95);
  });

  it('counts the player own choices once whatever order the explorer lists the replies in', () => {
    // Après 1.d4 d5 2.c4 e6 : 3.♘c3 ou 3.♘f3 ; après 1.d4 ♘f6 2.c4 e6 : 3.♘f3. Les trois lignes se rejoignent après le 4e coup.
    const white = repertoireOf('w', {
      '': ['d4'],
      d4: ['d5', 'Nf6'],
      'd4 d5': ['c4'],
      'd4 Nf6': ['c4'],
      'd4 d5 c4': ['e6'],
      'd4 Nf6 c4': ['e6'],
      'd4 d5 c4 e6': ['Nc3', 'Nf3'],
      'd4 Nf6 c4 e6': ['Nf3'],
      'd4 d5 c4 e6 Nc3': ['Nf6'],
      'd4 d5 c4 e6 Nf3': ['Nf6'],
      'd4 Nf6 c4 e6 Nf3': ['d5'],
      'd4 d5 c4 e6 Nc3 Nf6': ['Nf3'],
      'd4 d5 c4 e6 Nf3 Nf6': ['Nc3'],
      'd4 Nf6 c4 e6 Nf3 d5': ['Nc3'],
    });
    const after = { 'd4 d5 c4': { e6: 100 }, 'd4 Nf6 c4': { e6: 100 }, 'd4 d5 c4 e6 Nc3': { Nf6: 100 }, 'd4 d5 c4 e6 Nf3': { Nf6: 100 }, 'd4 Nf6 c4 e6 Nf3': { d5: 100 }, 'd4 d5 c4 e6 Nc3 Nf6 Nf3': { Be7: 100 } };
    for (const first of [{ d5: 50, Nf6: 50 }, { Nf6: 50, d5: 50 }]) {
      const { gaps } = findGaps(white, explorerOf({ d4: first, ...after }));
      expect(gaps.map((gap) => gap.reach)).toEqual([expect.closeTo(1)]);
    }
  });

  it('adds up two move orders that each stay under the goal', () => {
    // 1.e4 e5 2.♘f3 ♘c6 et 1.e4 ♘c6 2.♘f3 e5 : 0,3 % chacun, 0,6 % ensemble.
    const white = repertoireOf('w', { '': ['e4'], e4: ['e5', 'Nc6'], 'e4 e5': ['Nf3'], 'e4 Nc6': ['Nf3'] });
    const { gaps } = findGaps(white, explorerOf({ e4: { e5: 500, Nc6: 500 }, 'e4 e5 Nf3': { Nc6: 6, d6: 994 }, 'e4 Nc6 Nf3': { e5: 6, d6: 994 } }));
    expect(lines(gaps)).toContain('e4 e5 Nf3 Nc6');
  });

  it('adds up two move orders under the goal that only meet after a move of the player', () => {
    // 1.d4 ♘f6 2.c4 e6 3.♘f3 et 1.d4 e6 2.♘f3 ♘f6 3.c4 : 0,3 % chacun avant le 3e coup blanc, 0,6 % ensemble.
    const white = repertoireOf('w', { '': ['d4'], d4: ['Nf6', 'e6'], 'd4 Nf6': ['c4'], 'd4 e6': ['Nf3'], 'd4 Nf6 c4': ['e6'], 'd4 e6 Nf3': ['Nf6'], 'd4 Nf6 c4 e6': ['Nf3'], 'd4 e6 Nf3 Nf6': ['c4'] });
    const { gaps } = findGaps(white, explorerOf({ d4: { Nf6: 500, e6: 500 }, 'd4 Nf6 c4': { e6: 6, d5: 994 }, 'd4 e6 Nf3': { Nf6: 6, d5: 994 }, 'd4 Nf6 c4 e6 Nf3': { b6: 100 } }));
    expect(gaps.find((gap) => gap.path.at(-1) === 'b6')?.reach).toBeCloseTo(0.006);
  });
});
