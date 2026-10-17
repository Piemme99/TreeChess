import { describe, expect, it } from 'vitest';
import { buildOpeningTree } from './openingTree';
import type { GameScore, PlayedGame, Side } from './playedGame';
import { findPriorities, weakLines } from './priorities';
import { playedGamesFixture } from '../fixtures/playedGames';
import { gamesOfLastMonths } from './period';

const games = (count: number, side: Side, moves: string, score: GameScore): PlayedGame[] =>
  Array.from({ length: count }, () => ({ side, moves: moves.split(' '), score, playedAt: '2026-01-01' }));

const tree = (played: PlayedGame[], side: Side = 'w') => buildOpeningTree(played, side, 16);

const paths = (priorities: { path: readonly string[] }[]) => priorities.map((p) => p.path.join(' '));

describe('weakLines', () => {
  it('reports a line of the player scoring well below their average', () => {
    const played = [...games(200, 'w', 'd4', 1), ...games(100, 'w', 'e4', 0)];

    expect(paths(weakLines(tree(played)))).toEqual(['e4']);
  });

  it('ignores lines played too rarely to conclude', () => {
    const played = [...games(200, 'w', 'd4', 1), ...games(15, 'w', 'e4', 0)];

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

describe('findPriorities', () => {
  const sides = (white: PlayedGame[], black: PlayedGame[] = []) => ({ w: tree(white), b: tree(black, 'b') });

  it('lists a line proven on both time scales once', () => {
    const trees = sides([...games(200, 'w', 'd4', 1), ...games(100, 'w', 'e4', 0)]);

    expect(paths(findPriorities(trees, trees, 10))).toEqual(['e4']);
  });

  it('gathers the lines of both sides', () => {
    const trees = sides(
      [...games(200, 'w', 'd4', 1), ...games(100, 'w', 'e4', 0)],
      [...games(200, 'b', 'e4 c5', 1), ...games(200, 'b', 'e4 e5', 0)],
    );

    expect(new Set(findPriorities(trees, trees, 10).map((p) => p.side))).toEqual(new Set(['w', 'b']));
  });

  it('keeps an old problem the recent games are too few to prove, while it lasts', () => {
    const recent = sides([...games(20, 'w', 'd4', 1), ...games(5, 'w', 'e4', 0)]);
    const history = sides([...games(200, 'w', 'd4', 1), ...games(100, 'w', 'e4', 0)]);

    expect(paths(findPriorities(history, recent, 10))).toEqual(['e4']);
  });

  it('drops an old problem no longer played', () => {
    const history = sides([...games(200, 'w', 'd4', 1), ...games(100, 'w', 'e4', 0)]);
    const recent = sides(games(20, 'w', 'd4', 1));

    expect(findPriorities(history, recent, 10)).toEqual([]);
  });

  it('drops an old problem the player now scores their average on', () => {
    const history = sides([...games(200, 'w', 'd4', 1), ...games(100, 'w', 'e4', 0)]);
    const recent = sides([...games(10, 'w', 'd4', 1), ...games(10, 'w', 'd4', 0), ...games(10, 'w', 'e4', 1), ...games(10, 'w', 'e4', 0)]);

    expect(findPriorities(history, recent, 10)).toEqual([]);
  });

  it('keeps a recent problem drowned in the old games', () => {
    const recent = sides([...games(60, 'w', 'd4', 1), ...games(40, 'w', 'e4', 0)]);
    const history = sides([...games(300, 'w', 'd4', 1), ...games(300, 'w', 'd4', 0), ...games(300, 'w', 'e4', 0.5)]);

    expect(paths(findPriorities(history, recent, 10))).toEqual(['e4']);
  });

  it('weighs every priority by the points lost on it over the recent games', () => {
    const history = sides([...games(200, 'w', 'd4', 1), ...games(100, 'w', 'e4', 0)]);
    const recent = sides([...games(20, 'w', 'd4', 1), ...games(4, 'w', 'e4', 0)]);

    expect(findPriorities(history, recent, 10)[0]).toMatchObject({ path: ['e4'], games: 4 });
    expect(findPriorities(history, recent, 10)[0].pointsToGain).toBeLessThan(4);
  });

  it('keeps only the heaviest line of a branch, whatever proved each of them', () => {
    const recent = sides([...games(100, 'w', 'd4', 1), ...games(60, 'w', 'e4 e5', 0)]);
    const history = sides([...games(300, 'w', 'd4', 1), ...games(60, 'w', 'e4 e5', 0), ...games(60, 'w', 'e4 c5', 1)]);

    const found = paths(findPriorities(history, recent, 10));

    expect(found.filter((path) => path.startsWith('e4'))).toHaveLength(1);
  });

  it('ranks by points to gain, up to the limit', () => {
    const trees = sides(
      [...games(200, 'w', 'd4', 1), ...games(100, 'w', 'e4', 0)],
      [...games(200, 'b', 'e4 c5', 1), ...games(150, 'b', 'e4 e5', 0)],
    );

    const all = findPriorities(trees, trees, 10);
    const points = all.map((p) => p.pointsToGain);
    expect(points).toEqual([...points].sort((x, y) => y - x));
    expect(findPriorities(trees, trees, 1)).toEqual([all[0]]);
  });

  it('puts the Morra and the Philidor first on the real games, a year back from October 2026', () => {
    const history = { w: buildOpeningTree(playedGamesFixture, 'w', 16), b: buildOpeningTree(playedGamesFixture, 'b', 16) };
    const lastYear = gamesOfLastMonths(playedGamesFixture, 12, new Date('2026-10-17'));
    const recent = { w: buildOpeningTree(lastYear, 'w', 16), b: buildOpeningTree(lastYear, 'b', 16) };

    const [first, second, third] = findPriorities(history, recent, 5);

    expect(first).toMatchObject({ side: 'w', path: ['e4', 'c5', 'd4', 'cxd4', 'c3'] });
    expect(second).toMatchObject({ side: 'w', path: ['e4', 'e5', 'Nf3', 'd6', 'd4'] });
    expect(third).toMatchObject({ side: 'b', path: ['d4', 'Nf6'], games: 28 });
  });
});
