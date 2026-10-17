import { describe, expect, it } from 'vitest';
import type { OpeningNode } from './openingTree';
import { deficit, scoreRate } from './performance';

const node = (games: number, score: number): OpeningNode => ({
  san: 'e4', games, score, children: [],
});

describe('scoreRate', () => {
  it('is the share of points scored', () => {
    expect(scoreRate(node(4, 3))).toBe(0.75);
  });
});

describe('deficit', () => {
  it('is positive when the player scores below their average', () => {
    expect(deficit(node(1000, 400), 0.5)).toBeGreaterThan(0);
  });

  it('is negative when the player scores above their average', () => {
    expect(deficit(node(1000, 600), 0.5)).toBeLessThan(0);
  });

  it('approaches the raw gap on a large sample', () => {
    expect(deficit(node(1000, 400), 0.5)).toBeCloseTo(0.1, 2);
  });

  it('shrinks the gap on a small sample', () => {
    expect(deficit(node(6, 0), 0.5)).toBeCloseTo(0.5 * (6 / 18));
  });
});
