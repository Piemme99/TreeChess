import { describe, expect, it } from 'vitest';
import type { OpeningNode } from './openingTree';
import { deficit, leakOf, scoreRate } from './performance';

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

describe('leakOf', () => {
  const reply = (san: string, games: number, score: number): OpeningNode => ({ san, games, score, children: [] });
  const line = (...children: OpeningNode[]): OpeningNode => ({
    san: 'c5', games: children.reduce((sum, child) => sum + child.games, 0), score: children.reduce((sum, child) => sum + child.score, 0), children,
  });

  it('names the reply where the line loses clearly more than on average, the worst first', () => {
    expect(leakOf(line(reply('Nf3', 40, 24), reply('c3', 10, 3), reply('d4', 10, 4)))?.san).toBe('c3');
  });

  it('ignores a reply met fewer than five times, however badly it goes', () => {
    expect(leakOf(line(reply('Nf3', 40, 24), reply('c3', 4, 0)))).toBeUndefined();
  });

  it('names nothing when every reply scores within three points of the line', () => {
    expect(leakOf(line(reply('Nf3', 50, 25), reply('c3', 50, 24)))).toBeUndefined();
  });
});
