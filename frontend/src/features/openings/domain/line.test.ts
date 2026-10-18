import { describe, expect, it } from 'vitest';
import { buildOpeningTree } from './openingTree';
import { linePositions, movesAt, studyLine } from './line';
import type { PlayedGame } from './playedGame';

const game = (side: PlayedGame['side'], moves: string, score: PlayedGame['score']): PlayedGame => ({
  side,
  moves: moves.split(' '),
  score,
  playedAt: '2026-01-01',
});

const times = (count: number, made: PlayedGame): PlayedGame[] => Array.from({ length: count }, () => made);

describe('studyLine', () => {
  it('scores the line move after move, marking whose move it is', () => {
    const tree = buildOpeningTree(
      [game('w', 'e4 d5 exd5', 0), game('w', 'e4 d5 exd5', 1), game('w', 'e4 e5 Nf3', 1)],
      'w',
      16,
    );

    const { steps } = studyLine(tree, ['e4', 'd5', 'exd5']);

    expect(steps.map(({ san, games, rate, byPlayer }) => ({ san, games, rate, byPlayer }))).toEqual([
      { san: 'e4', games: 3, rate: 2 / 3, byPlayer: true },
      { san: 'd5', games: 2, rate: 0.5, byPlayer: false },
      { san: 'exd5', games: 2, rate: 0.5, byPlayer: true },
    ]);
  });

  it('carries on along the most played continuation while it keeps enough games', () => {
    const tree = buildOpeningTree(
      [
        ...times(8, game('b', 'd4 Nf6 c4 e6 Nc3 Bb4', 0)),
        ...times(2, game('b', 'd4 Nf6 c4 g6', 1)),
        ...times(3, game('b', 'd4 Nf6 Nf3 d5', 0.5)),
      ],
      'b',
      16,
    );

    const { steps, entry } = studyLine(tree, ['d4', 'Nf6']);

    expect(entry).toBe(2);
    expect(steps.map((step) => step.san)).toEqual(['d4', 'Nf6', 'c4', 'e6', 'Nc3', 'Bb4']);
  });

  it('stops the continuation where no move gathers a tenth of the line', () => {
    const scattered = ['Nf3', 'c3', 'd4', 'Nc3', 'f4', 'Bc4', 'g3', 'b4', 'd3', 'c4', 'Ne2', 'Qh5'];
    const tree = buildOpeningTree(
      scattered.flatMap((san) => times(8, game('w', `e4 c5 ${san}`, 0))),
      'w',
      16,
    );

    expect(studyLine(tree, ['e4', 'c5']).steps.map((step) => step.san)).toEqual(['e4', 'c5']);
  });
});

describe('movesAt', () => {
  it('lists the moves played from a position, the one on the line marked', () => {
    const tree = buildOpeningTree(
      [...times(3, game('w', 'e4 d5', 0)), ...times(4, game('w', 'e4 e5', 1))],
      'w',
      16,
    );

    expect(movesAt(tree, ['e4'], 'd5')).toEqual({
      shown: [
        { san: 'e5', games: 4, share: 4 / 7, rate: 1, onLine: false },
        { san: 'd5', games: 3, share: 3 / 7, rate: 0, onLine: true },
      ],
      hidden: 0,
    });
  });

  it('hides the moves seen fewer than three times, except the one on the line', () => {
    const tree = buildOpeningTree(
      [...times(5, game('w', 'e4 c5', 0)), ...times(2, game('w', 'e4 e6', 1)), game('w', 'e4 d6', 1)],
      'w',
      16,
    );

    const { shown, hidden } = movesAt(tree, ['e4'], 'd6');

    expect(shown.map((move) => move.san)).toEqual(['c5', 'd6']);
    expect(hidden).toBe(1);
  });
});

describe('linePositions', () => {
  it('gives each position of the line its score, whose move it is and the moves played there', () => {
    const tree = buildOpeningTree(
      [...times(6, game('b', 'e4 c5 Nf3', 0)), ...times(4, game('b', 'e4 c5 Nc3', 1)), ...times(2, game('b', 'd4 d5', 1))],
      'b',
      16,
    );

    const positions = linePositions(tree, studyLine(tree, ['e4', 'c5']));

    expect(positions.map(({ ply, path, games, rate, playerToMove }) => ({ ply, path, games, rate, playerToMove }))).toEqual([
      { ply: 0, path: [], games: 12, rate: 0.5, playerToMove: false },
      { ply: 1, path: ['e4'], games: 10, rate: 0.4, playerToMove: true },
      { ply: 2, path: ['e4', 'c5'], games: 10, rate: 0.4, playerToMove: false },
      { ply: 3, path: ['e4', 'c5', 'Nf3'], games: 6, rate: 0, playerToMove: true },
    ]);
    expect(positions[2].moves.map((move) => [move.san, move.onLine])).toEqual([
      ['Nf3', true],
      ['Nc3', false],
    ]);
  });
});
