import { describe, expect, it } from 'vitest';
import type { OpeningNode } from '../domain/openingTree';
import { layoutPruned, marksFor, type PruneOptions } from './prune';

const node = (san: string | null, games: number, children: OpeningNode[] = []): OpeningNode => ({ san, games, score: games / 2, children });

const wide: PruneOptions = { widthPx: 1000, minPx: 10, coverageFloor: 0, minRows: 1, maxRows: 20 };

describe('layoutPruned', () => {
  it('gives the focus the full width and its lines a width proportional to their games', () => {
    const root = node(null, 100, [node('e4', 60, [node('e5', 60)]), node('d4', 40)]);

    const tiles = layoutPruned(root, [], wide);

    expect(tiles.map((t) => [t.key, t.depth, t.start, t.width])).toEqual([
      ['', 0, 0, 1],
      ['e4', 1, 0, 0.6],
      ['d4', 1, 0.6, 0.4],
      ['e4 e5', 2, 0, 0.6],
    ]);
  });

  it('folds the lines too thin to read into one rest tile at the end of the row', () => {
    const root = node(null, 100, [node('e4', 90), node('c4', 4), node('Nf3', 3), node('g3', 3)]);

    const tiles = layoutPruned(root, [], { ...wide, minPx: 50 });

    const row = tiles.filter((t) => t.depth === 1);
    expect(row.map((t) => t.key)).toEqual(['e4', ' …']);
    expect(row[1]).toMatchObject({ rest: 3, start: 0.9, width: 0.1, path: [] });
    expect(row[1].node.games).toBe(10);
  });

  it('refolds with the zoom: a thin line at the root is a tile once its parent is the focus', () => {
    const c4 = node('c4', 4, [node('e5', 4)]);
    const root = node(null, 100, [node('e4', 96), c4]);
    const options = { ...wide, minPx: 50 };

    expect(layoutPruned(root, [], options).some((t) => t.key === 'c4')).toBe(false);
    expect(layoutPruned(c4, ['c4'], options).map((t) => t.key)).toEqual(['c4', 'c4 e5']);
  });

  it('stops drawing rows once they cover less than the floor, after the minimum rows', () => {
    const root = node(null, 100, [node('e4', 100, [node('e5', 100, [node('Nf3', 10)])])]);

    const cut = layoutPruned(root, [], { ...wide, coverageFloor: 0.4, minRows: 1 });
    const whole = layoutPruned(root, [], { ...wide, coverageFloor: 0.4, minRows: 3 });

    expect(Math.max(...cut.map((t) => t.depth))).toBe(2);
    expect(Math.max(...whole.map((t) => t.depth))).toBe(3);
  });

  it('draws nothing without games', () => {
    expect(layoutPruned(node(null, 0), [], wide)).toEqual([]);
  });
});

describe('marksFor', () => {
  const root = node(null, 100, [node('e4', 90, [node('e5', 90, [node('Nf3', 90)])]), node('c4', 4), node('Nf3', 6)]);
  const tiles = layoutPruned(root, [], { ...wide, minPx: 50, maxRows: 3 });

  it('puts the rank on the tile of a drawn priority', () => {
    expect(marksFor(tiles, [{ path: ['e4', 'e5'] }]).get('e4 e5')).toEqual({ rank: 1, exact: true });
  });

  it('puts a hint on the rest tile that absorbed a priority', () => {
    expect(marksFor(tiles, [{ path: ['c4'] }]).get(' …')).toEqual({ rank: 1, exact: false });
  });

  it('puts a hint on the deepest drawn ancestor of a priority beyond the drawn rows', () => {
    expect(marksFor(tiles, [{ path: ['e4', 'e5', 'Nf3'] }]).get('e4 e5')).toEqual({ rank: 1, exact: false });
  });

  it('keeps the best rank when two priorities land on one tile', () => {
    const marks = marksFor(tiles, [{ path: ['e4', 'e5', 'Nf3'] }, { path: ['e4', 'e5'] }]);
    expect(marks.get('e4 e5')).toEqual({ rank: 1, exact: false });
  });
});
