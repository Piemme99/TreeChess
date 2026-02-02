import type { RepertoireNode } from '../../../../../../types';
import type { LayoutNode, LayoutEdge, TreeLayout, Point } from './types';
import {
  NODE_RADIUS,
  NODE_SPACING_X,
  NODE_SPACING_Y,
  ROOT_OFFSET_X,
  ROOT_OFFSET_Y
} from '../constants';

/**
 * Calculates the visual layout for a repertoire tree (vertical: top-to-bottom).
 * Siblings spread horizontally, depth increases vertically (downward).
 */
export function calculateLayout(root: RepertoireNode): TreeLayout {
  const nodes: LayoutNode[] = [];
  const edges: LayoutEdge[] = [];
  let maxX = 0;
  let maxY = 0;

  function layoutNode(
    node: RepertoireNode,
    depth: number,
    startX: number
  ): { width: number; centerX: number } {
    const y = ROOT_OFFSET_Y + depth * NODE_SPACING_Y;

    if (node.children.length === 0) {
      const x = startX + NODE_SPACING_X / 2;
      nodes.push({ id: node.id, x, y, node, depth });
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      return { width: NODE_SPACING_X, centerX: x };
    }

    let currentX = startX;
    const childCenters: number[] = [];

    for (const child of node.children) {
      const result = layoutNode(child, depth + 1, currentX);
      childCenters.push(result.centerX);
      currentX += result.width;
    }

    const totalWidth = currentX - startX;
    const centerX = (childCenters[0] + childCenters[childCenters.length - 1]) / 2;

    nodes.push({ id: node.id, x: centerX, y, node, depth });
    maxX = Math.max(maxX, centerX);
    maxY = Math.max(maxY, y);

    // Create edges to children
    for (let i = 0; i < node.children.length; i++) {
      const childNode = nodes.find((n) => n.id === node.children[i].id);
      if (childNode) {
        edges.push({
          id: `${node.id}-${node.children[i].id}`,
          from: { x: centerX, y },
          to: { x: childNode.x, y: childNode.y }
        });
      }
    }

    return { width: totalWidth, centerX };
  }

  layoutNode(root, 0, ROOT_OFFSET_X);

  return {
    nodes,
    edges,
    width: maxX + NODE_RADIUS + 50,
    height: maxY + NODE_RADIUS + 50
  };
}

/**
 * Creates a cubic bezier curve path between two points.
 * The curve has vertical tangents for a clean top-to-bottom tree appearance.
 */
export function createBezierPath(from: Point, to: Point): string {
  const midY = (from.y + to.y) / 2;
  return `M ${from.x} ${from.y + NODE_RADIUS} C ${from.x} ${midY}, ${to.x} ${midY}, ${to.x} ${to.y - NODE_RADIUS}`;
}
