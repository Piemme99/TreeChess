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
 * Counts all descendants of a node recursively.
 */
function countDescendants(node: RepertoireNode): number {
  let count = 0;
  for (const child of node.children) {
    count += 1 + countDescendants(child);
  }
  return count;
}

/**
 * Calculates the visual layout for a repertoire tree (vertical: top-to-bottom).
 * Siblings spread horizontally, depth increases vertically (downward).
 * @param root The root node of the tree
 * @param collapsedNodes Optional set of node IDs that are collapsed (children hidden)
 */
export function calculateLayout(root: RepertoireNode, collapsedNodes?: Set<string>): TreeLayout {
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
    const isCollapsed = collapsedNodes?.has(node.id) && node.children.length > 0;

    if (node.children.length === 0 || isCollapsed) {
      const x = startX + NODE_SPACING_X / 2;
      const hiddenCount = isCollapsed ? countDescendants(node) : undefined;
      nodes.push({ id: node.id, x, y, node, depth, hiddenDescendantCount: hiddenCount });
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
          to: { x: childNode.x, y: childNode.y },
          type: 'parent-child'
        });
      }
    }

    return { width: totalWidth, centerX };
  }

  layoutNode(root, 0, ROOT_OFFSET_X);

  // Create a map for fast node lookup by ID
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  // Create merge edges for transpositions
  for (const layoutNode of nodes) {
    const transpositionOf = layoutNode.node.transpositionOf;
    if (transpositionOf) {
      const canonicalNode = nodeMap.get(transpositionOf);
      if (canonicalNode) {
        edges.push({
          id: `merge-${layoutNode.id}-${transpositionOf}`,
          from: { x: layoutNode.x, y: layoutNode.y },
          to: { x: canonicalNode.x, y: canonicalNode.y },
          type: 'merge'
        });
      }
    }
  }

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

/**
 * Creates a curved path for merge/transposition edges (GitHub merge style).
 * The curve goes down from the node, arcs to the right, then loops back
 * to connect to the canonical node from the right side.
 */
export function createMergePath(from: Point, to: Point): string {
  // Start at bottom of transposition node
  const startX = from.x;
  const startY = from.y + NODE_RADIUS;

  // End at right side of canonical node
  const endX = to.x + NODE_RADIUS;
  const endY = to.y;

  // Moderate offset to the right (reduced from before)
  const curveOffset = Math.max(45, Math.abs(from.x - to.x) * 0.2 + 25);
  const peakX = Math.max(startX, endX) + curveOffset;

  // How far down the curve goes - more extension = rounder curve
  const bottomExtend = Math.max(40, Math.abs(endY - startY) * 0.4);
  const controlY = Math.max(startY, endY) + bottomExtend;

  // Both control points at same location = smooth rounded curve through that point
  return `M ${startX} ${startY} C ${peakX} ${controlY}, ${peakX} ${controlY}, ${endX} ${endY}`;
}
