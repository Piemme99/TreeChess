import { describe, expect, it } from 'vitest';
import type { OpeningNode } from '../domain/openingTree';
import { layoutFlame, type LineBar } from './flameLayout';

const node = (san: string | null, games: number, children: OpeningNode[] = []): OpeningNode => ({
  san, games, score: games / 2, children,
});

describe('layoutFlame', () => {
  it('spans the focus over the full width', () => {
    const [focus] = layoutFlame(node(null, 10), [], 0);

    expect(focus).toMatchObject({ kind: 'line', depth: 0, start: 0, width: 1 });
  });

  it('places children side by side, proportionally to their games', () => {
    const root = node(null, 10, [node('e4', 6), node('d4', 4)]);

    const bars = layoutFlame(root, [], 0) as LineBar[];

    expect(bars.slice(1).map(({ path, depth, start, width }) => ({ path, depth, start, width }))).toEqual([
      { path: ['e4'], depth: 1, start: 0, width: 0.6 },
      { path: ['d4'], depth: 1, start: 0.6, width: 0.4 },
    ]);
  });

  it('nests grandchildren under their parent', () => {
    const root = node(null, 10, [node('d4', 4), node('e4', 6, [node('e5', 3)])]);

    const e5 = layoutFlame(root, [], 0).find((bar) => bar.kind === 'line' && bar.path.join(' ') === 'd4 e5');
    const underE4 = layoutFlame(root, [], 0).find((bar) => bar.kind === 'line' && bar.path.join(' ') === 'e4 e5');

    expect(e5).toBeUndefined();
    expect(underE4).toMatchObject({ depth: 2, start: 0.4, width: 0.3 });
  });

  it('leaves room for games that end before reaching a child', () => {
    const root = node(null, 10, [node('e4', 5)]);

    const bars = layoutFlame(root, [], 0);

    expect(bars).toHaveLength(2);
    expect(bars[1].width).toBe(0.5);
  });

  it('merges children narrower than the minimum width into one bar', () => {
    const root = node(null, 100, [node('e4', 90), node('d4', 3), node('c4', 3), node('Nf3', 2)]);

    const bars = layoutFlame(root, [], 0.05);

    expect(bars).toHaveLength(3);
    expect(bars[2]).toEqual({
      kind: 'others', parentPath: [], lines: 3, games: 8, depth: 1, start: 0.9, width: 0.08,
    });
  });

  it('drops the merged bar when it is itself too narrow', () => {
    const root = node(null, 100, [node('e4', 98), node('d4', 1), node('c4', 1)]);

    expect(layoutFlame(root, [], 0.05)).toHaveLength(2);
  });

  it('lays out a zoomed subtree from its own path', () => {
    const e4 = node('e4', 6, [node('e5', 3)]);

    const bars = layoutFlame(e4, ['e4'], 0) as LineBar[];

    expect(bars.map(({ path, depth, width }) => ({ path, depth, width }))).toEqual([
      { path: ['e4'], depth: 0, width: 1 },
      { path: ['e4', 'e5'], depth: 1, width: 0.5 },
    ]);
  });
});
