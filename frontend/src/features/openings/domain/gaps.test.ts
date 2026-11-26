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

  it('stops where the explorer has not answered yet, and asks for that position', () => {
    const { gaps, missing } = findGaps(black, explorerOf({ '': { e4: 500, d4: 500 }, 'e4 e5': { Nf3: 100 } }));
    expect(lines(gaps)).toEqual(['e4 e5 Nf3']);
    expect(missing.map(positionKey)).toEqual([positionKey(fenAfter('d4 d5'))]);
  });
});
