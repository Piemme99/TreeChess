import { describe, expect, it } from 'vitest';
import { figurineLine, figurineMove, formatLine, formatMove } from './notation';

describe('formatMove', () => {
  it('numbers a white move with a dot', () => {
    expect(formatMove('Nf3', 3)).toBe('2.Nf3');
  });

  it('numbers a black move with an ellipsis', () => {
    expect(formatMove('c5', 2)).toBe('1…c5');
  });
});

describe('formatLine', () => {
  it('numbers only the white moves', () => {
    expect(formatLine(['e4', 'c5', 'Nf3'])).toBe('1.e4 c5 2.Nf3');
  });

  it('is empty for the starting position', () => {
    expect(formatLine([])).toBe('');
  });
});

describe('figurines', () => {
  it('replaces the piece letter with its figurine, not a destination square letter', () => {
    expect(figurineMove('Nf3', 3)).toBe('2.♘f3');
    expect(figurineMove('Bb5', 5)).toBe('3.♗b5');
    expect(figurineMove('b5', 6)).toBe('3…b5');
  });

  it('handles castling, captures and promotions', () => {
    expect(figurineLine(['e4', 'Nc6', 'Nxe5', 'O-O', 'e8=Q'])).toBe('1.e4 ♘c6 2.♘xe5 O-O 3.e8=♕');
  });
});
