import { describe, expect, it } from 'vitest';
import { buildOpeningTree } from './openingTree';
import type { GameScore, PlayedGame, Side } from './playedGame';
import { findPriorities, unsettledPositions, weakLines } from './priorities';
import { playedGamesFixture } from '../fixtures/playedGames';

const games = (count: number, side: Side, moves: string, score: GameScore): PlayedGame[] =>
  Array.from({ length: count }, () => ({ side, moves: moves.split(' '), score }));

const tree = (played: PlayedGame[], side: Side = 'w') => buildOpeningTree(played, side, 16);

const paths = (priorities: { path: readonly string[] }[]) => priorities.map((p) => p.path.join(' '));

describe('weakLines', () => {
  it('reports a line of the player scoring well below their average', () => {
    const played = [...games(200, 'w', 'd4', 1), ...games(100, 'w', 'e4', 0)];

    expect(paths(weakLines(tree(played)))).toEqual(['e4']);
  });

  it('ignores lines played too rarely to conclude', () => {
    const played = [...games(200, 'w', 'd4', 1), ...games(30, 'w', 'e4', 0)];

    expect(weakLines(tree(played))).toEqual([]);
  });

  it('ignores a gap that stays within sampling noise', () => {
    const played = [
      ...games(100, 'w', 'd4', 1), ...games(100, 'w', 'd4', 0),
      ...games(23, 'w', 'e4', 1), ...games(27, 'w', 'e4', 0),
    ];

    expect(weakLines(tree(played))).toEqual([]);
  });

  it('only considers lines ending on a move of the player', () => {
    const played = [...games(200, 'b', 'd4 d5', 1), ...games(100, 'b', 'e4 e5', 0)];

    expect(paths(weakLines(tree(played, 'b')))).toEqual(['e4 e5']);
  });

  it('keeps only the heaviest line of a branch', () => {
    const played = [
      ...games(300, 'w', 'd4', 1),
      ...games(60, 'w', 'e4 e5 Nf3', 0),
      ...games(60, 'w', 'e4 c5 Nf3', 0),
    ];

    expect(paths(weakLines(tree(played)))).toEqual(['e4']);
  });
});

describe('unsettledPositions', () => {
  it('reports a position where the player alternates between unequal replies', () => {
    const played = [...games(200, 'w', 'd4', 1), ...games(100, 'w', 'e4', 0)];

    expect(paths(unsettledPositions(tree(played)))).toEqual(['']);
  });

  it('ignores replies that score the same', () => {
    const played = [...games(100, 'w', 'd4', 1), ...games(100, 'w', 'e4', 1)];

    expect(unsettledPositions(tree(played))).toEqual([]);
  });

  it('does not recommend a habit backed by too few games against the one it replaces', () => {
    const played = [...games(20, 'w', 'd4', 1), ...games(500, 'w', 'e4', 0.5)];

    expect(unsettledPositions(tree(played))).toEqual([]);
  });

  it('only considers positions where the player is to move', () => {
    const played = [...games(200, 'w', 'e4 e5', 1), ...games(100, 'w', 'e4 c5', 0)];

    expect(unsettledPositions(tree(played))).toEqual([]);
  });
});

describe('findPriorities', () => {
  const white = tree([...games(200, 'w', 'd4', 1), ...games(100, 'w', 'e4', 0)]);
  const black = tree([...games(200, 'b', 'e4 c5', 1), ...games(200, 'b', 'e4 e5', 0)], 'b');

  it('gathers the signals of both sides', () => {
    const sides = findPriorities([white, black], 10).map((p) => p.side);

    expect(new Set(sides)).toEqual(new Set(['w', 'b']));
  });

  it('ranks by points to gain, up to the limit', () => {
    const priorities = findPriorities([white, black], 3);

    expect(priorities).toHaveLength(3);
    const points = priorities.map((p) => p.pointsToGain);
    expect(points).toEqual([...points].sort((x, y) => y - x));
  });

  it('puts 1.d4 Nf6 and the Scandinavian first on the real games', () => {
    const trees = (['w', 'b'] as const).map((side) => buildOpeningTree(playedGamesFixture, side, 16));

    const [first, second] = findPriorities(trees, 5);

    expect(first).toMatchObject({ side: 'b', kind: 'weak-line', path: ['d4', 'Nf6'], games: 124 });
    expect(second).toMatchObject({ side: 'w', kind: 'weak-line', path: ['e4', 'd5', 'exd5'], games: 207 });
  });
});
