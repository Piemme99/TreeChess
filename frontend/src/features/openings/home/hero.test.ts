import { describe, expect, it } from 'vitest';
import { homeHero } from './hero';

describe('homeHero', () => {
  it('puts the weak openings first on the first day, whatever else waits', () => {
    expect(homeHero({ firstDay: true, gamesToSettle: 3, linesDue: 5 })).toBe('first');
  });

  it("puts the day's games first when one of them has something to settle, before the review", () => {
    expect(homeHero({ firstDay: false, gamesToSettle: 1, linesDue: 5 })).toBe('games');
  });

  it("puts the review first once the day's games leave nothing to settle", () => {
    expect(homeHero({ firstDay: false, gamesToSettle: 0, linesDue: 5 })).toBe('review');
  });

  it('falls back on the weak openings when nothing is to settle nor due', () => {
    expect(homeHero({ firstDay: false, gamesToSettle: 0, linesDue: 0 })).toBe('work');
  });
});
