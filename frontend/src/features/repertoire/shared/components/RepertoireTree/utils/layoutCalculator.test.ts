import { describe, it, expect } from 'vitest';
import { calculateLayout, createBezierPath, createMergePath } from './layoutCalculator';
import type { RepertoireNode } from '../../../../../../types';
import { NODE_RADIUS, MIN_RADIUS, RADIUS_PER_DEPTH } from '../constants';

function createNode(
  id: string,
  move: string | null = null,
  children: RepertoireNode[] = [],
  transpositionOf?: string
): RepertoireNode {
  return {
    id,
    fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    move,
    moveNumber: 0,
    colorToMove: 'w',
    parentId: null,
    children,
    transpositionOf
  };
}

describe('calculateLayout (radial)', () => {
  describe('single root node', () => {
    it('positions root node at center (0, 0)', () => {
      const root = createNode('root');
      const layout = calculateLayout(root);

      expect(layout.nodes).toHaveLength(1);
      expect(layout.nodes[0].id).toBe('root');
      expect(layout.nodes[0].x).toBe(0);
      expect(layout.nodes[0].y).toBe(0);
      expect(layout.nodes[0].depth).toBe(0);
    });

    it('returns empty edges for single node', () => {
      const root = createNode('root');
      const layout = calculateLayout(root);

      expect(layout.edges).toHaveLength(0);
    });
  });

  describe('linear tree (no branches)', () => {
    it('positions nodes at increasing distance from center', () => {
      const root = createNode('root', null, [
        createNode('c1', 'e4', [createNode('c2', 'e5', [createNode('c3', 'Nf3')])])
      ]);

      const layout = calculateLayout(root);

      expect(layout.nodes).toHaveLength(4);

      const nodeById = (id: string) => layout.nodes.find((n) => n.id === id)!;

      // Root at center
      expect(nodeById('root').x).toBe(0);
      expect(nodeById('root').y).toBe(0);

      // Children should be at increasing distances from center
      const distFromCenter = (n: { x: number; y: number }) =>
        Math.sqrt(n.x * n.x + n.y * n.y);

      expect(distFromCenter(nodeById('c1'))).toBeCloseTo(MIN_RADIUS, 0);
      expect(distFromCenter(nodeById('c2'))).toBeCloseTo(MIN_RADIUS + RADIUS_PER_DEPTH, 0);
      expect(distFromCenter(nodeById('c3'))).toBeCloseTo(MIN_RADIUS + 2 * RADIUS_PER_DEPTH, 0);
    });

    it('creates edges between consecutive nodes', () => {
      const root = createNode('root', null, [createNode('c1', 'e4')]);

      const layout = calculateLayout(root);

      expect(layout.edges).toHaveLength(1);
      expect(layout.edges[0].from.x).toBe(0);
      expect(layout.edges[0].from.y).toBe(0);
    });
  });

  describe('branching tree', () => {
    it('spreads children at different angles', () => {
      const root = createNode('root', null, [
        createNode('c1', 'e4'),
        createNode('c2', 'd4')
      ]);

      const layout = calculateLayout(root);

      const c1 = layout.nodes.find((n) => n.id === 'c1')!;
      const c2 = layout.nodes.find((n) => n.id === 'c2')!;

      // Children should be at the same distance from center (same depth)
      const dist1 = Math.sqrt(c1.x * c1.x + c1.y * c1.y);
      const dist2 = Math.sqrt(c2.x * c2.x + c2.y * c2.y);
      expect(dist1).toBeCloseTo(dist2, 0);

      // But at different positions (different angles)
      expect(c1.x !== c2.x || c1.y !== c2.y).toBe(true);
    });

    it('root stays at center', () => {
      const root = createNode('root', null, [
        createNode('c1', 'e4'),
        createNode('c2', 'd4')
      ]);

      const layout = calculateLayout(root);

      const rootNode = layout.nodes.find((n) => n.id === 'root')!;
      expect(rootNode.x).toBe(0);
      expect(rootNode.y).toBe(0);
    });

    it('creates edges to all children', () => {
      const root = createNode('root', null, [
        createNode('c1', 'e4'),
        createNode('c2', 'd4'),
        createNode('c3', 'c4')
      ]);

      const layout = calculateLayout(root);

      expect(layout.edges).toHaveLength(3);
    });
  });

  describe('complex tree', () => {
    it('handles tree with multiple levels and branches', () => {
      const root = createNode('root', null, [
        createNode('e4', 'e4', [
          createNode('e5', 'e5'),
          createNode('c5', 'c5')
        ]),
        createNode('d4', 'd4', [createNode('d5', 'd5')])
      ]);

      const layout = calculateLayout(root);

      // 6 total nodes
      expect(layout.nodes).toHaveLength(6);

      // 5 edges (root->e4, root->d4, e4->e5, e4->c5, d4->d5)
      expect(layout.edges).toHaveLength(5);

      // Depth check
      const nodeById = (id: string) => layout.nodes.find((n) => n.id === id)!;
      expect(nodeById('root').depth).toBe(0);
      expect(nodeById('e4').depth).toBe(1);
      expect(nodeById('d4').depth).toBe(1);
      expect(nodeById('e5').depth).toBe(2);
      expect(nodeById('c5').depth).toBe(2);
      expect(nodeById('d5').depth).toBe(2);
    });
  });

  describe('layout dimensions', () => {
    it('calculates dimensions based on total radius', () => {
      const root = createNode('root', null, [
        createNode('c1', 'e4', [createNode('c2', 'e5')])
      ]);

      const layout = calculateLayout(root);

      // Should be a square with dimension based on max depth
      expect(layout.width).toBe(layout.height);
      expect(layout.width).toBeGreaterThan(0);
    });
  });
});

describe('createBezierPath', () => {
  it('creates valid SVG path string', () => {
    const path = createBezierPath({ x: 0, y: 0 }, { x: 100, y: 50 });

    expect(path).toContain('M');
    expect(path).toContain('Q');
  });

  it('returns empty string for zero distance', () => {
    const path = createBezierPath({ x: 50, y: 50 }, { x: 50, y: 50 });
    expect(path).toBe('');
  });

  it('offsets start and end by node radius', () => {
    const from = { x: 0, y: 0 };
    const to = { x: 100, y: 0 };
    const path = createBezierPath(from, to);

    // Should start at from.x + NODE_RADIUS (since direction is positive x)
    expect(path.startsWith(`M ${NODE_RADIUS}`)).toBe(true);
    // Should end at to.x - NODE_RADIUS
    expect(path).toContain(`${100 - NODE_RADIUS} 0`);
  });
});

describe('edge types', () => {
  it('parent-child edges have type parent-child', () => {
    const root = createNode('root', null, [createNode('c1', 'e4')]);

    const layout = calculateLayout(root);

    expect(layout.edges).toHaveLength(1);
    expect(layout.edges[0].type).toBe('parent-child');
  });

  it('creates merge edge when transpositionOf is defined', () => {
    const root = createNode('root', null, [
      createNode('e4', 'e4', [createNode('nf3', 'Nf3')]),
      createNode('nf3-transpose', 'Nf3', [], 'nf3')
    ]);

    const layout = calculateLayout(root);

    const mergeEdge = layout.edges.find((e) => e.type === 'merge');
    expect(mergeEdge).toBeDefined();
    expect(mergeEdge!.id).toBe('merge-nf3-transpose-nf3');
  });

  it('does not create merge edge if canonical node does not exist', () => {
    const root = createNode('root', null, [
      createNode('c1', 'e4', [], 'non-existent')
    ]);

    const layout = calculateLayout(root);

    const mergeEdge = layout.edges.find((e) => e.type === 'merge');
    expect(mergeEdge).toBeUndefined();
  });

  it('merge edge connects from transposition to canonical node', () => {
    const root = createNode('root', null, [
      createNode('canonical', 'e4'),
      createNode('transpose', 'd4', [], 'canonical')
    ]);

    const layout = calculateLayout(root);

    const mergeEdge = layout.edges.find((e) => e.type === 'merge');
    const canonicalNode = layout.nodes.find((n) => n.id === 'canonical');
    const transposeNode = layout.nodes.find((n) => n.id === 'transpose');

    expect(mergeEdge).toBeDefined();
    expect(mergeEdge!.from.x).toBe(transposeNode!.x);
    expect(mergeEdge!.from.y).toBe(transposeNode!.y);
    expect(mergeEdge!.to.x).toBe(canonicalNode!.x);
    expect(mergeEdge!.to.y).toBe(canonicalNode!.y);
  });
});

describe('createMergePath', () => {
  it('creates valid SVG path string', () => {
    const path = createMergePath({ x: 100, y: 200 }, { x: 50, y: 100 });

    expect(path).toContain('M');
    expect(path).toContain('Q');
  });

  it('returns empty string for zero distance', () => {
    const path = createMergePath({ x: 50, y: 50 }, { x: 50, y: 50 });
    expect(path).toBe('');
  });
});
