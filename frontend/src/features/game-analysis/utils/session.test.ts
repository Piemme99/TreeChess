import { describe, it, expect } from 'vitest';
import { countDivergences } from './session';
import type { GameAnalysis, MoveAnalysis } from '../../../types';

function move(status: MoveAnalysis['status']): MoveAnalysis {
  return { plyNumber: 0, san: 'e4', fen: '', status, isUserMove: true };
}

function game(statuses: MoveAnalysis['status'][]): GameAnalysis {
  return {
    gameIndex: 0,
    headers: {},
    moves: statuses.map(move),
    userColor: 'white',
  };
}

describe('countDivergences', () => {
  it('counts opponent-new and out-of-repertoire moves', () => {
    expect(countDivergences(game(['in-repertoire', 'in-repertoire']))).toBe(0);
    expect(countDivergences(game(['in-repertoire', 'opponent-new', 'out-of-repertoire']))).toBe(2);
    expect(countDivergences(game(['out-of-book']))).toBe(0);
  });
});
