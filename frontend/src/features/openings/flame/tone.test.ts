import { describe, expect, it } from 'vitest';
import { toneOf } from './tone';

describe('toneOf', () => {
  it.each([
    [0.12, 'losing'],
    [0.07, 'slipping'],
    [0.01, 'even'],
    [-0.04, 'even'],
    [-0.08, 'winning'],
  ])('maps a deficit of %s to %s', (value, tone) => {
    expect(toneOf(value)).toBe(tone);
  });
});
