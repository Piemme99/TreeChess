import { describe, expect, it } from 'vitest';
import { Chess } from 'chess.js';
import { additionMoves, withAdditions } from './addition';
import type { PlayedGame } from './playedGame';
import type { PreparedMove } from './preparation';
import { createRepertoire, repertoireMovesAt } from './repertoire';

const fenAfter = (moves: string) => {
  const chess = new Chess();
  for (const san of moves.split(' ').filter(Boolean)) chess.move(san);
  return chess.fen();
};

const prepared = (san: string, ply: number, byPlayer: boolean, next: PreparedMove[] = [], mine = 0): PreparedMove => ({
  san,
  ply,
  byPlayer,
  share: 0.3,
  mine,
  source: byPlayer ? 'level' : null,
  dropped: null,
  next,
});

// 1.d4 ♘f6 : le joueur a joué ♘f6, la préparation propose 2.c4 e6 et 2.♘f3 g6.
const proposal = [prepared('c4', 3, false, [prepared('e6', 4, true)], 2), prepared('Nf3', 3, false, [prepared('g6', 4, true)])];

describe('additionMoves', () => {
  it('opens with the move that left the repertoire, then the preparation that follows', () => {
    const moves = additionMoves(['d4'], { san: 'Nf6', source: 'habit' }, proposal, new Set());

    expect(moves.map((move) => move.san)).toEqual(['Nf6', 'c4', 'e6', 'Nf3', 'g6']);
    expect(moves.map((move) => move.source)).toEqual(['habit', 'habit', 'level', 'level', 'level']);
  });

  it('leaves out the branches the player cut', () => {
    const moves = additionMoves(['d4'], { san: 'Nf6', source: 'habit' }, proposal, new Set(['d4 Nf6 Nf3']));

    expect(moves.map((move) => move.san)).toEqual(['Nf6', 'c4', 'e6']);
  });
});

describe('withAdditions', () => {
  const habits: PlayedGame[] = Array.from({ length: 10 }, () => ({ side: 'b', moves: ['d4', 'd5'], score: 1, playedAt: '2025-06-01' }));
  const repertoire = createRepertoire(habits, 'b', '2026-01-01');

  it('adds the accepted moves next to the ones already there, dated the day of the decision', () => {
    const moves = additionMoves(['d4'], { san: 'Nf6', source: 'habit' }, proposal, new Set());

    const grown = withAdditions(repertoire, [{ side: 'b', addedAt: '2026-01-04', moves }]);

    expect(repertoireMovesAt(grown, fenAfter('d4')).map((move) => move.san)).toEqual(['d5', 'Nf6']);
    expect(repertoireMovesAt(grown, fenAfter('d4 Nf6 c4'))).toEqual([{ san: 'e6', source: 'level', addedAt: '2026-01-04' }]);
  });

  it('ignores the additions made for the other side', () => {
    const moves = additionMoves([], { san: 'e4', source: 'habit' }, [], new Set());

    expect(withAdditions(repertoire, [{ side: 'w', addedAt: '2026-01-04', moves }])).toEqual(repertoire);
  });
});
