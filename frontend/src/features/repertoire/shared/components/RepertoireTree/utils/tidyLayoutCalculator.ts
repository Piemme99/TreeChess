import * as d3 from 'd3-hierarchy';
import type { RepertoireNode } from '../../../../../../types';
import type { LayoutNode, LayoutEdge, TreeLayout, Point } from './types';
import { NODE_RADIUS, NODE_SPACING_X, NODE_SPACING_Y, ROOT_OFFSET_X, ROOT_OFFSET_Y } from '../constants';

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
 * Calculates the tidy tree layout (top-to-bottom hierarchy).
 * Uses D3 tree layout with root at top, children below.
 */
export function calculateTidyLayout(
  root: RepertoireNode,
  collapsedNodes?: Set<string>
): TreeLayout {
  const d3Root = toD3Hierarchy(root, collapsedNodes);
  const hierarchy = d3.hierarchy(d3Root);

  const maxDepth = getMaxDepth(d3Root);

  // Create tree layout with per-node sizing for branch-name-aware spacing
  const BRANCH_CHAR_WIDTH = 11; // approximate px per character at fontSize 22
  const BRANCH_GAP = 20; // minimum gap between adjacent branch name labels

  const tree = d3.tree<D3Node>()
    .nodeSize([NODE_SPACING_X, NODE_SPACING_Y])
    .separation((a, b) => {
      const aName = a.data.node.branchName;
      const bName = b.data.node.branchName;
      const baseSep = a.parent === b.parent ? 1 : 2;

      if (aName || bName) {
        const aHalf = aName ? (aName.length * BRANCH_CHAR_WIDTH) / 2 : NODE_SPACING_X / 2;
        const bHalf = bName ? (bName.length * BRANCH_CHAR_WIDTH) / 2 : NODE_SPACING_X / 2;
        return Math.max(baseSep, (aHalf + bHalf + BRANCH_GAP) / NODE_SPACING_X);
      }

      return baseSep;
    });

  // Apply layout
  const layoutRoot = tree(hierarchy);

  // Compute actual horizontal bounds (nodeSize centers root at x=0)
  let minX = 0, maxX = 0;
  layoutRoot.each((d3Node) => {
    if (d3Node.x < minX) minX = d3Node.x;
    if (d3Node.x > maxX) maxX = d3Node.x;
  });

  const xShift = -minX + ROOT_OFFSET_X;

  const nodes: LayoutNode[] = [];
  const edges: LayoutEdge[] = [];

  // Track resolved branch colors per node (propagated from ancestors)
  const resolvedBranchColor = new Map<string, string | undefined>();

  // Convert D3 nodes to our layout format
  layoutRoot.each((d3Node) => {
    const x = d3Node.x + xShift;
    const y = d3Node.y + ROOT_OFFSET_Y;

    // Resolve branch color: own branchColor overrides parent's
    const parentColor = d3Node.parent ? resolvedBranchColor.get(d3Node.parent.data.id) : undefined;
    const effectiveColor = d3Node.data.node.branchColor || parentColor;
    resolvedBranchColor.set(d3Node.data.id, effectiveColor || undefined);

    nodes.push({
      id: d3Node.data.id,
      x,
      y,
      node: d3Node.data.node,
      depth: d3Node.depth,
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
        const isMainLineEdge = !!d3Node.parent.data.node.isMainLine && !!d3Node.data.node.isMainLine;

        edges.push({
          id: `${parentLayout.id}-${childLayout.id}`,
          from: { x: parentLayout.x, y: parentLayout.y },
          to: { x: childLayout.x, y: childLayout.y },
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

  // Calculate bounding box (all positive coordinates)
  const padding = NODE_RADIUS * 2 + 50;
  const actualWidth = maxX - minX;
  const treeHeight = maxDepth * NODE_SPACING_Y;
  const width = actualWidth + ROOT_OFFSET_X * 2 + padding;
  const height = treeHeight + ROOT_OFFSET_Y * 2 + padding;

  return {
    nodes,
    edges,
    width,
    height
  };
}

/**
 * Creates a stepped path for tidy tree edges (parent to child).
 * Uses an elbow-style path going down then across.
 */
export function createTidyPath(from: Point, to: Point): string {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist === 0) return '';

  // Start from bottom of parent node
  const startX = from.x;
  const startY = from.y + NODE_RADIUS;

  // End at top of child node
  const endX = to.x;
  const endY = to.y - NODE_RADIUS;

  // Mid point for the step
  const midY = (startY + endY) / 2;

  // Create a smooth S-curve path
  return `M ${startX} ${startY} C ${startX} ${midY} ${endX} ${midY} ${endX} ${endY}`;
}

/**
 * Creates a curved path for merge/transposition edges in tidy layout.
 */
export function createTidyMergePath(from: Point, to: Point): string {
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

  // Curve perpendicular to the line
  const midX = (startX + endX) / 2;
  const midY = (startY + endY) / 2;

  const perpX = -uy;
  const perpY = ux;

  const curveAmount = Math.max(30, dist * 0.3);

  const controlX = midX + perpX * curveAmount;
  const controlY = midY + perpY * curveAmount;

  return `M ${startX} ${startY} Q ${controlX} ${controlY} ${endX} ${endY}`;
}
