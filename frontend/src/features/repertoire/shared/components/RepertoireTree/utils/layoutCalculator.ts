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
 * Calculates the visual layout for a repertoire tree.
 * Uses a recursive algorithm that positions children first,
 * then centers parents between their children.
 */
export function calculateLayout(root: RepertoireNode): TreeLayout {
  const nodes: LayoutNode[] = [];
  const edges: LayoutEdge[] = [];
  let maxX = 0;
  let maxY = 0;

  function layoutNode(
    node: RepertoireNode,
    depth: number,
    startY: number
  ): { height: number; centerY: number } {
    const x = ROOT_OFFSET_X + depth * NODE_SPACING_X;

    if (node.children.length === 0) {
      const y = startY + NODE_SPACING_Y / 2;
      nodes.push({ id: node.id, x, y, node, depth });
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      return { height: NODE_SPACING_Y, centerY: y };
    }

    let currentY = startY;
    const childCenters: number[] = [];

    for (const child of node.children) {
      const result = layoutNode(child, depth + 1, currentY);
      childCenters.push(result.centerY);
      currentY += result.height;
    }

    const totalHeight = currentY - startY;
    const centerY = (childCenters[0] + childCenters[childCenters.length - 1]) / 2;

    nodes.push({ id: node.id, x, y: centerY, node, depth });
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, centerY);

    // Create edges to children
    for (let i = 0; i < node.children.length; i++) {
      const childNode = nodes.find((n) => n.id === node.children[i].id);
      if (childNode) {
        edges.push({
          from: { x, y: centerY },
          to: { x: childNode.x, y: childNode.y }
        });
      }
    }

    return { height: totalHeight, centerY };
  }

  layoutNode(root, 0, ROOT_OFFSET_Y);

  return {
    nodes,
    edges,
    width: maxX + NODE_RADIUS + 50,
    height: maxY + NODE_RADIUS + 50
  };
}

/**
 * Creates a cubic bezier curve path between two points.
 * The curve has horizontal tangents for a clean tree appearance.
 */
export function createBezierPath(from: Point, to: Point): string {
  const midX = (from.x + to.x) / 2;
  return `M ${from.x + NODE_RADIUS} ${from.y} C ${midX} ${from.y}, ${midX} ${to.y}, ${to.x - NODE_RADIUS} ${to.y}`;
}
