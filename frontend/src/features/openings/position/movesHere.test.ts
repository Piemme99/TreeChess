import { describe, expect, it } from 'vitest';
import type { CheckedGame } from '../checks/checkedGame';
import type { OpeningNode } from '../domain/openingTree';
import { movesHere } from './movesHere';

const leaf = (san: string, games: number, score: number): OpeningNode => ({ san, games, score, children: [] });
const node: OpeningNode = { san: 'd4', games: 40, score: 18, children: [leaf('d5', 25, 10), leaf('Nf6', 13, 7), leaf('e6', 2, 1)] };
const leftWith = (played: string, id: number): CheckedGame => ({
  id,
  game: { side: 'b', moves: ['d4', played], score: 0, playedAt: '2026-01-04' },
  check: { kind: 'left', ply: 1, played, planned: ['d5'], position: 'p' },
  asks: true,
});

describe('movesHere', () => {
  it('gathers the repertoire, the moves played and the decisions waiting on each', () => {
    expect(movesHere(node, ['d5'], [leftWith('Nf6', 1), leftWith('Nf6', 2)])).toEqual([
      { san: 'd5', inRepertoire: true, games: 25, score: 0.4, toDecide: 0 },
      { san: 'Nf6', inRepertoire: false, games: 13, score: 7 / 13, toDecide: 2 },
    ]);
  });

  it('keeps a planned move never played and a rare move waiting for a decision', () => {
    const moves = movesHere(node, ['d5', 'c5'], [leftWith('e6', 1)]).map((move) => move.san);
    expect(moves).toEqual(['d5', 'Nf6', 'e6', 'c5']);
  });

  it('is empty where nothing was played or planned', () => {
    expect(movesHere(undefined, [], [])).toEqual([]);
  });
});
