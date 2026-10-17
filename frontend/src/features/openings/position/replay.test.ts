import { describe, expect, it } from 'vitest';
import { replayLine } from './replay';

describe('replayLine', () => {
  it('gives every position from the start, and the last move played', () => {
    const { fens, lastMove } = replayLine(['e4', 'd5']);

    expect(fens).toHaveLength(3);
    expect(fens[2]).toBe('rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2');
    expect(lastMove).toEqual({ from: 'd7', to: 'd5' });
  });

  it('has no last move at the starting position', () => {
    expect(replayLine([]).lastMove).toBeNull();
  });
});
