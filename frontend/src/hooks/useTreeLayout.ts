import { useMemo } from 'react';
import type { RepertoireNode } from '../types';

interface LayoutNode {
  id: string;
  x: number;
  y: number;
  node: RepertoireNode;
}

interface LayoutEdge {
  from: { x: number; y: number };
  to: { x: number; y: number };
}

interface TreeLayout {
  nodes: LayoutNode[];
  edges: LayoutEdge[];
}

interface UseTreeLayoutOptions {
  nodeSpacingX?: number;
  nodeSpacingY?: number;
  nodeRadius?: number;
}

/**
 * Calculates tree layout using a simple recursive algorithm
 * Returns positioned nodes and edges for SVG rendering
 */
export function useTreeLayout(
  root: RepertoireNode,
  options: UseTreeLayoutOptions = {}
): TreeLayout {
  const {
    nodeSpacingX = 80,
    nodeSpacingY = 60,
    nodeRadius = 16
  } = options;

  return useMemo(() => {
    const nodes: LayoutNode[] = [];
    const edges: LayoutEdge[] = [];

    // Calculate subtree heights for proper spacing
    function getSubtreeHeight(node: RepertoireNode): number {
      if (node.children.length === 0) return 1;
      return node.children.reduce((sum, child) => sum + getSubtreeHeight(child), 0);
    }

    // Position nodes recursively
    function positionNode(
      node: RepertoireNode,
      depth: number,
      yOffset: number
    ): number {
      const x = depth * nodeSpacingX + nodeRadius + 20;
      const subtreeHeight = getSubtreeHeight(node);
      const nodeY = yOffset + (subtreeHeight * nodeSpacingY) / 2;

      nodes.push({
        id: node.id,
        x,
        y: nodeY,
        node
      });

      let currentY = yOffset;
      for (const child of node.children) {
        const childSubtreeHeight = getSubtreeHeight(child);
        const childY = currentY + (childSubtreeHeight * nodeSpacingY) / 2;

        edges.push({
          from: { x: x + nodeRadius, y: nodeY },
          to: { x: (depth + 1) * nodeSpacingX + 20, y: childY }
        });

        positionNode(child, depth + 1, currentY);
        currentY += childSubtreeHeight * nodeSpacingY;
      }

      return subtreeHeight;
    }

    positionNode(root, 0, 20);

    return { nodes, edges };
  }, [root, nodeSpacingX, nodeSpacingY, nodeRadius]);
}

/**
 * Creates a Bezier curve path between two points
 */
export function createBezierPath(
  from: { x: number; y: number },
  to: { x: number; y: number }
): string {
  const midX = (from.x + to.x) / 2;
  return `M ${from.x} ${from.y} C ${midX} ${from.y}, ${midX} ${to.y}, ${to.x} ${to.y}`;
}
