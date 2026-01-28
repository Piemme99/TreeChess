import { describe, it, expect } from 'vitest';
import { calculateLayout, createBezierPath } from './layoutCalculator';
import type { RepertoireNode } from '../../../../../../types';
import { NODE_RADIUS, NODE_SPACING_X, ROOT_OFFSET_X } from '../constants';

function createNode(
  id: string,
  move: string | null = null,
  children: RepertoireNode[] = []
): RepertoireNode {
  return {
    id,
    fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    move,
    moveNumber: 0,
    colorToMove: 'w',
    parentId: null,
    children
  };
}

describe('calculateLayout', () => {
  describe('single root node', () => {
    it('positions root node correctly', () => {
      const root = createNode('root');
      const layout = calculateLayout(root);

      expect(layout.nodes).toHaveLength(1);
      expect(layout.nodes[0].id).toBe('root');
      expect(layout.nodes[0].x).toBe(ROOT_OFFSET_X);
      expect(layout.nodes[0].depth).toBe(0);
    });

    it('returns empty edges for single node', () => {
      const root = createNode('root');
      const layout = calculateLayout(root);

      expect(layout.edges).toHaveLength(0);
    });
  });

  describe('linear tree (no branches)', () => {
    it('positions nodes at increasing x coordinates', () => {
      const root = createNode('root', null, [
        createNode('c1', 'e4', [createNode('c2', 'e5', [createNode('c3', 'Nf3')])])
      ]);

      const layout = calculateLayout(root);

      expect(layout.nodes).toHaveLength(4);

      const nodeById = (id: string) => layout.nodes.find((n) => n.id === id)!;

      expect(nodeById('root').x).toBe(ROOT_OFFSET_X);
      expect(nodeById('c1').x).toBe(ROOT_OFFSET_X + NODE_SPACING_X);
      expect(nodeById('c2').x).toBe(ROOT_OFFSET_X + NODE_SPACING_X * 2);
      expect(nodeById('c3').x).toBe(ROOT_OFFSET_X + NODE_SPACING_X * 3);
    });

    it('creates edges between consecutive nodes', () => {
      const root = createNode('root', null, [createNode('c1', 'e4')]);

      const layout = calculateLayout(root);

      expect(layout.edges).toHaveLength(1);
      expect(layout.edges[0].from.x).toBe(ROOT_OFFSET_X);
      expect(layout.edges[0].to.x).toBe(ROOT_OFFSET_X + NODE_SPACING_X);
    });

    it('nodes on same line have same y coordinate', () => {
      const root = createNode('root', null, [
        createNode('c1', 'e4', [createNode('c2', 'e5')])
      ]);

      const layout = calculateLayout(root);
      const yValues = layout.nodes.map((n) => n.y);

      // All nodes should have the same y since it's a linear tree
      expect(new Set(yValues).size).toBe(1);
    });
  });

  describe('branching tree', () => {
    it('spreads children vertically', () => {
      const root = createNode('root', null, [
        createNode('c1', 'e4'),
        createNode('c2', 'd4')
      ]);

      const layout = calculateLayout(root);

      const c1 = layout.nodes.find((n) => n.id === 'c1')!;
      const c2 = layout.nodes.find((n) => n.id === 'c2')!;

      // Children should have different y coordinates
      expect(c1.y).not.toBe(c2.y);
      // First child should be above second (smaller y)
      expect(c1.y).toBeLessThan(c2.y);
    });

    it('parent is vertically centered between children', () => {
      const root = createNode('root', null, [
        createNode('c1', 'e4'),
        createNode('c2', 'd4')
      ]);

      const layout = calculateLayout(root);

      const rootNode = layout.nodes.find((n) => n.id === 'root')!;
      const c1 = layout.nodes.find((n) => n.id === 'c1')!;
      const c2 = layout.nodes.find((n) => n.id === 'c2')!;

      const expectedY = (c1.y + c2.y) / 2;
      expect(rootNode.y).toBe(expectedY);
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
    it('calculates width based on deepest node', () => {
      const root = createNode('root', null, [
        createNode('c1', 'e4', [createNode('c2', 'e5')])
      ]);

      const layout = calculateLayout(root);

      // Width should accommodate the deepest node plus padding
      const deepestX = ROOT_OFFSET_X + NODE_SPACING_X * 2;
      expect(layout.width).toBe(deepestX + NODE_RADIUS + 50);
    });

    it('calculates height based on spread nodes', () => {
      const root = createNode('root', null, [
        createNode('c1', 'e4'),
        createNode('c2', 'd4')
      ]);

      const layout = calculateLayout(root);

      const maxY = Math.max(...layout.nodes.map((n) => n.y));
      expect(layout.height).toBe(maxY + NODE_RADIUS + 50);
    });
  });
});

describe('createBezierPath', () => {
  it('creates valid SVG path string', () => {
    const path = createBezierPath({ x: 0, y: 50 }, { x: 100, y: 50 });

    expect(path).toContain('M');
    expect(path).toContain('C');
  });

  it('starts after source node radius', () => {
    const path = createBezierPath({ x: 60, y: 50 }, { x: 160, y: 50 });

    // Path should start at from.x + NODE_RADIUS
    expect(path.startsWith(`M ${60 + NODE_RADIUS}`)).toBe(true);
  });

  it('ends before target node radius', () => {
    const path = createBezierPath({ x: 60, y: 50 }, { x: 160, y: 100 });

    // Path should end at to.x - NODE_RADIUS
    expect(path).toContain(`${160 - NODE_RADIUS} 100`);
  });

  it('uses midpoint for control points', () => {
    const from = { x: 0, y: 50 };
    const to = { x: 100, y: 150 };
    const path = createBezierPath(from, to);

    const midX = (from.x + to.x) / 2;
    // Control points should use midX
    expect(path).toContain(`${midX}`);
  });
});
