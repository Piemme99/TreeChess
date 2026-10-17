import { describe, expect, it } from 'vitest';
import { labelFits } from './label';

describe('labelFits', () => {
  it('accepts a label narrower than its bar', () => {
    expect(labelFits('3.Nc3', 80, 12)).toBe(true);
  });

  it('rejects a label that would be cut', () => {
    expect(labelFits('3.Nc3', 40, 12)).toBe(false);
  });

  it('rejects any label on a bar with no measured width', () => {
    expect(labelFits('e4', 0, 12)).toBe(false);
  });
});
