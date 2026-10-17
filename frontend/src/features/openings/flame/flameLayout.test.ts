import { describe, expect, it } from 'vitest';
import type { OpeningNode } from '../domain/openingTree';
import { layoutFlame } from './flameLayout';

const node = (san: string | null, games: number, children: OpeningNode[] = []): OpeningNode => ({
  san, games, score: games / 2, children,
});

const placements = (bars: ReturnType<typeof layoutFlame>) =>
  bars.map(({ path, depth, start, width }) => ({ path: path.join(' '), depth, start, width }));

describe('layoutFlame', () => {
  it('spans the focus over the full width', () => {
    const [focus] = layoutFlame(node(null, 10), [], 0);

    expect(focus).toMatchObject({ depth: 0, start: 0, width: 1 });
  });

  it('places children side by side, proportionally to their games', () => {
    const root = node(null, 10, [node('e4', 6), node('d4', 4)]);

    expect(placements(layoutFlame(root, [], 0)).slice(1)).toEqual([
      { path: 'e4', depth: 1, start: 0, width: 0.6 },
      { path: 'd4', depth: 1, start: 0.6, width: 0.4 },
    ]);
  });

  it('nests grandchildren under their parent', () => {
    const root = node(null, 10, [node('d4', 4), node('e4', 6, [node('e5', 3)])]);

    expect(placements(layoutFlame(root, [], 0))).toContainEqual({ path: 'e4 e5', depth: 2, start: 0.4, width: 0.3 });
  });

  it('leaves room for games that end before reaching a child', () => {
    const bars = layoutFlame(node(null, 10, [node('e4', 5)]), [], 0);

    expect(bars[1].width).toBe(0.5);
  });

  it('leaves out lines played too rarely, with their descendants, keeping their room', () => {
    const root = node(null, 100, [node('c4', 5, [node('e5', 5)]), node('e4', 95)]);

    expect(placements(layoutFlame(root, [], 10)).slice(1)).toEqual([
      { path: 'e4', depth: 1, start: 0.05, width: 0.95 },
    ]);
  });

  it('lays out a zoomed subtree from its own path', () => {
    const e4 = node('e4', 6, [node('e5', 3)]);

    expect(placements(layoutFlame(e4, ['e4'], 0))).toEqual([
      { path: 'e4', depth: 0, start: 0, width: 1 },
      { path: 'e4 e5', depth: 1, start: 0, width: 0.5 },
    ]);
  });
});
