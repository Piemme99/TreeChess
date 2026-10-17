import { describe, expect, it } from 'vitest';
import { formatLine, formatMove } from './notation';

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
