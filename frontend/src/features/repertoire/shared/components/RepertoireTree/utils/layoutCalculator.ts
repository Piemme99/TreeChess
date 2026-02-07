import * as d3 from 'd3-hierarchy';
import type { RepertoireNode } from '../../../../../../types';
import type { LayoutNode, LayoutEdge, TreeLayout, Point, PolarPoint, LayoutMode } from './types';
import { NODE_RADIUS, MIN_RADIUS, RADIUS_PER_DEPTH } from '../constants';
import { radialToCartesian } from './radialHelpers';
import { calculateTidyLayout } from './tidyLayoutCalculator';

interface D3Node {
  id: string;
  node: RepertoireNode;
  children: D3Node[];
  hiddenDescendantCount?: number;
}

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
 * Converts a RepertoireNode tree to a D3-compatible hierarchy structure.
 * Filters out children of collapsed nodes.
 */
function toD3Hierarchy(
  node: RepertoireNode,
  collapsedNodes?: Set<string>
): D3Node {
  const isCollapsed = collapsedNodes?.has(node.id) && node.children.length > 0;
  const hiddenCount = isCollapsed ? countDescendants(node) : undefined;

  const children = isCollapsed
    ? []
    : node.children.map((child) => toD3Hierarchy(child, collapsedNodes));

  // Reorder children so the main line child is in the center
  if (children.length > 1) {
    const mainLineIdx = children.findIndex((c) => c.node.isMainLine);
    if (mainLineIdx >= 0) {
      const [mainLineChild] = children.splice(mainLineIdx, 1);
      const centerIdx = Math.floor(children.length / 2);
      children.splice(centerIdx, 0, mainLineChild);
    }
  }

  return {
    id: node.id,
    node,
    children,
    hiddenDescendantCount: hiddenCount
  };
}

/**
 * Calculates the maximum depth of the tree.
 */
function getMaxDepth(node: D3Node, currentDepth = 0): number {
  if (node.children.length === 0) return currentDepth;
  return Math.max(
    ...node.children.map((child) => getMaxDepth(child, currentDepth + 1))
  );
}

/**
 * Calculates the radial layout for a repertoire tree.
 * Uses D3 cluster layout with polar to Cartesian projection.
 * Root is at center (0, 0), branches radiate outward.
 */
export function calculateRadialLayout(
  root: RepertoireNode,
  collapsedNodes?: Set<string>
): TreeLayout {
  const d3Root = toD3Hierarchy(root, collapsedNodes);
  const hierarchy = d3.hierarchy(d3Root);

  // Calculate radius based on max depth
  const maxDepth = getMaxDepth(d3Root);
  const totalRadius = MIN_RADIUS + maxDepth * RADIUS_PER_DEPTH;

  // Create cluster layout
  // size([angle, radius]) - angle in radians (2*PI for full circle)
  const cluster = d3.cluster<D3Node>().size([2 * Math.PI, totalRadius]);

  // Apply layout
  const layoutRoot = cluster(hierarchy);

  const nodes: LayoutNode[] = [];
  const edges: LayoutEdge[] = [];

  // Track resolved branch colors per node (propagated from ancestors)
  const resolvedBranchColor = new Map<string, string | undefined>();

  // Convert D3 nodes to our layout format
  layoutRoot.each((d3Node) => {
    const depth = d3Node.depth;
    let x: number, y: number;

    if (depth === 0) {
      // Root at center
      x = 0;
      y = 0;
    } else {
      // Convert polar to Cartesian
      // d3Node.x is angle, d3Node.y is radius in D3 cluster
      const angle = d3Node.x;
      const radius = MIN_RADIUS + (depth - 1) * RADIUS_PER_DEPTH;
      const cartesian = radialToCartesian(angle, radius);
      x = cartesian.x;
      y = cartesian.y;
    }

    // Resolve branch color: own branchColor overrides parent's
    const parentColor = d3Node.parent ? resolvedBranchColor.get(d3Node.parent.data.id) : undefined;
    const effectiveColor = d3Node.data.node.branchColor || parentColor;
    resolvedBranchColor.set(d3Node.data.id, effectiveColor || undefined);

    nodes.push({
      id: d3Node.data.id,
      x,
      y,
      node: d3Node.data.node,
      depth,
      hiddenDescendantCount: d3Node.data.hiddenDescendantCount,
      branchColor: effectiveColor || undefined
    });
  });

  // Create node map for fast lookup
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  // Create edges from parent to children
  layoutRoot.each((d3Node) => {
    if (d3Node.parent) {
      const parentLayout = nodeMap.get(d3Node.parent.data.id);
      const childLayout = nodeMap.get(d3Node.data.id);

      if (parentLayout && childLayout) {
        // Calculate polar coordinates for edge path
        const fromPolar: PolarPoint =
          d3Node.parent.depth === 0
            ? { angle: d3Node.x, radius: 0 }
            : {
                angle: d3Node.parent.x,
                radius: MIN_RADIUS + (d3Node.parent.depth - 1) * RADIUS_PER_DEPTH
              };

        const toPolar: PolarPoint = {
          angle: d3Node.x,
          radius: MIN_RADIUS + (d3Node.depth - 1) * RADIUS_PER_DEPTH
        };

        const isMainLineEdge = !!d3Node.parent.data.node.isMainLine && !!d3Node.data.node.isMainLine;

        edges.push({
          id: `${parentLayout.id}-${childLayout.id}`,
          from: { x: parentLayout.x, y: parentLayout.y },
          to: { x: childLayout.x, y: childLayout.y },
          fromPolar,
          toPolar,
          type: 'parent-child',
          isMainLine: isMainLineEdge,
          branchColor: resolvedBranchColor.get(d3Node.data.id)
        });
      }
    }
  });

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

  // Calculate bounding box (centered at 0,0)
  const padding = NODE_RADIUS * 2 + 50;
  const dimension = (totalRadius + padding) * 2;

  return {
    nodes,
    edges,
    width: dimension,
    height: dimension
  };
}

/**
 * Creates a simple straight line path between two points.
 * Offsets from node edges.
 */
export function createBezierPath(from: Point, to: Point): string {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist === 0) return '';

  const ux = dx / dist;
  const uy = dy / dist;

  const startX = from.x + ux * NODE_RADIUS;
  const startY = from.y + uy * NODE_RADIUS;
  const endX = to.x - ux * NODE_RADIUS;
  const endY = to.y - uy * NODE_RADIUS;

  // Subtle curve via control point
  const midX = (startX + endX) / 2;
  const midY = (startY + endY) / 2;
  const curveOffset = Math.min(20, dist * 0.15);
  const perpX = -uy * curveOffset;
  const perpY = ux * curveOffset;

  return `M ${startX} ${startY} Q ${midX + perpX} ${midY + perpY} ${endX} ${endY}`;
}

/**
 * Creates a curved path for merge/transposition edges.
 * Arcs outward from center to avoid crossing nodes.
 */
export function createMergePath(from: Point, to: Point): string {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist === 0) return '';

  const ux = dx / dist;
  const uy = dy / dist;

  const startX = from.x + ux * NODE_RADIUS;
  const startY = from.y + uy * NODE_RADIUS;
  const endX = to.x - ux * NODE_RADIUS;
  const endY = to.y - uy * NODE_RADIUS;

  // Arc outward from center
  const midX = (startX + endX) / 2;
  const midY = (startY + endY) / 2;

  const fromDist = Math.sqrt(from.x * from.x + from.y * from.y);
  const toDist = Math.sqrt(to.x * to.x + to.y * to.y);
  const avgDist = (fromDist + toDist) / 2;

  const perpX = -uy;
  const perpY = ux;

  const testX = midX + perpX;
  const testY = midY + perpY;
  const testDist = Math.sqrt(testX * testX + testY * testY);

  const outwardSign = testDist > avgDist ? 1 : -1;
  const curveAmount = Math.max(30, dist * 0.3);

  const controlX = midX + perpX * curveAmount * outwardSign;
  const controlY = midY + perpY * curveAmount * outwardSign;

  return `M ${startX} ${startY} Q ${controlX} ${controlY} ${endX} ${endY}`;
}

/**
 * Unified layout calculator that delegates to the appropriate layout function
 * based on the layout mode.
 */
export function calculateLayout(
  root: RepertoireNode,
  collapsedNodes?: Set<string>,
  mode: LayoutMode = 'radial'
): TreeLayout {
  if (mode === 'tidy') {
    return calculateTidyLayout(root, collapsedNodes);
  }
  return calculateRadialLayout(root, collapsedNodes);
}
