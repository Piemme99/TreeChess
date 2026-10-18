import { describe, expect, it } from 'vitest';
import { judgeMove } from './judgement';

describe('judgeMove', () => {
  it('lets an even move pass', () => {
    expect(judgeMove(30, 10, 'w')).toBeNull();
  });

  it('grades what the mover gives away, like Lichess', () => {
    expect(judgeMove(0, -60, 'w')).toBe('inaccuracy');
    expect(judgeMove(0, -120, 'w')).toBe('mistake');
    expect(judgeMove(0, -300, 'w')).toBe('blunder');
  });

  it('reads the evaluation from the side of the mover', () => {
    expect(judgeMove(0, 300, 'b')).toBe('blunder');
    expect(judgeMove(0, 300, 'w')).toBeNull();
  });
});
