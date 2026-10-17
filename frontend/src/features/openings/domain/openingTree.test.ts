import { describe, expect, it } from 'vitest';
import { buildOpeningTree, isPlayerMove, nodeAt } from './openingTree';
import type { PlayedGame } from './playedGame';
import { playedGamesFixture } from '../fixtures/playedGames';

const game = (side: PlayedGame['side'], moves: string, score: PlayedGame['score']): PlayedGame => ({
  side,
  moves: moves.split(' '),
  score,
});

describe('buildOpeningTree', () => {
  it('aggregates games and score along each line', () => {
    const tree = buildOpeningTree(
      [game('w', 'e4 e5 Nf3', 1), game('w', 'e4 e5 Bc4', 0), game('w', 'e4 c5', 0.5)],
      'w',
      16,
    );

    expect(tree.root).toMatchObject({ games: 3, score: 1.5 });
    expect(nodeAt(tree, ['e4'])).toMatchObject({ games: 3, score: 1.5 });
    expect(nodeAt(tree, ['e4', 'e5'])).toMatchObject({ games: 2, score: 1 });
    expect(nodeAt(tree, ['e4', 'e5', 'Nf3'])).toMatchObject({ games: 1, score: 1 });
  });

  it('keeps only the games played with the requested side', () => {
    const tree = buildOpeningTree([game('w', 'e4', 1), game('b', 'd4', 0)], 'b', 16);

    expect(tree.root.games).toBe(1);
    expect(tree.root.children.map((child) => child.san)).toEqual(['d4']);
  });

  it('sorts children by number of games', () => {
    const tree = buildOpeningTree(
      [game('w', 'd4', 1), game('w', 'e4', 1), game('w', 'e4', 1)],
      'w',
      16,
    );

    expect(tree.root.children.map((child) => child.san)).toEqual(['e4', 'd4']);
  });

  it('stops at maxPlies', () => {
    const tree = buildOpeningTree([game('w', 'e4 e5 Nf3 Nc6', 1)], 'w', 2);

    expect(nodeAt(tree, ['e4', 'e5'])?.children).toEqual([]);
  });



  it('builds both sides from the real games fixture', () => {
    expect(buildOpeningTree(playedGamesFixture, 'w', 16).root.games).toBe(2824);
    expect(buildOpeningTree(playedGamesFixture, 'b', 16).root.games).toBe(2830);
  });
});

describe('nodeAt', () => {
  it('returns undefined for a line that was never played', () => {
    const tree = buildOpeningTree([game('w', 'e4', 1)], 'w', 16);

    expect(nodeAt(tree, ['d4'])).toBeUndefined();
  });
});

describe('isPlayerMove', () => {
  it('is true on odd plies with white', () => {
    expect([1, 2, 3].map((ply) => isPlayerMove('w', ply))).toEqual([true, false, true]);
  });

  it('is true on even plies with black', () => {
    expect([1, 2, 3].map((ply) => isPlayerMove('b', ply))).toEqual([false, true, false]);
  });

  it('is false at the starting position', () => {
    expect(isPlayerMove('w', 0)).toBe(false);
  });
});
