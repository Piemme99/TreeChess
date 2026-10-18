import { describe, expect, it } from 'vitest';
import { Chess } from 'chess.js';
import { draftLines, draftMoves, withAdditions, type DraftMove } from './addition';
import type { PlayedGame } from './playedGame';
import { createRepertoire, repertoireMovesAt } from './repertoire';

const fenAfter = (moves: string) => {
  const chess = new Chess();
  for (const san of moves.split(' ').filter(Boolean)) chess.move(san);
  return chess.fen();
};

const move = (line: string, source: DraftMove['source'] = 'level'): DraftMove => ({ path: line.split(' '), source });

// 1.d4 ♘f6 joué par le joueur, puis 2.c4 e6 et, en revenant en arrière, 2.♘f3 g6.
const draft = [move('d4 Nf6', 'habit'), move('d4 Nf6 c4'), move('d4 Nf6 c4 e6'), move('d4 Nf6 Nf3'), move('d4 Nf6 Nf3 g6')];

describe('draftLines', () => {
  it('lists each line the player built, to its last move', () => {
    expect(draftLines(draft).map((line) => line.join(' '))).toEqual(['d4 Nf6 c4 e6', 'd4 Nf6 Nf3 g6']);
  });
});

describe('withAdditions', () => {
  const habits: PlayedGame[] = Array.from({ length: 10 }, () => ({ side: 'b', moves: ['d4', 'd5'], score: 1, playedAt: '2025-06-01' }));
  const repertoire = createRepertoire(habits, 'b', '2026-01-01');

  it('adds the moves the player played next to the ones already there, dated the day of the decision', () => {
    const grown = withAdditions(repertoire, [{ side: 'b', addedAt: '2026-01-04', moves: draftMoves(draft) }]);

    expect(repertoireMovesAt(grown, fenAfter('d4')).map((added) => added.san)).toEqual(['d5', 'Nf6']);
    expect(repertoireMovesAt(grown, fenAfter('d4 Nf6')).map((added) => added.san)).toEqual(['c4', 'Nf3']);
    expect(repertoireMovesAt(grown, fenAfter('d4 Nf6 c4'))).toEqual([{ san: 'e6', source: 'level', addedAt: '2026-01-04' }]);
  });

  it('ignores the additions made for the other side', () => {
    expect(withAdditions(repertoire, [{ side: 'w', addedAt: '2026-01-04', moves: draftMoves([move('e4')]) }])).toEqual(repertoire);
  });
});
