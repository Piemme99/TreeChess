import type { RepertoireNode } from '../../../../../../types';

/** Position coordinates */
export interface Point {
  x: number;
  y: number;
}

/** A node in the calculated layout */
export interface LayoutNode {
  id: string;
  x: number;
  y: number;
  node: RepertoireNode;
  depth: number;
}

/** An edge connecting two nodes */
export interface LayoutEdge {
  from: Point;
  to: Point;
}

/** Complete tree layout calculation result */
export interface TreeLayout {
  nodes: LayoutNode[];
  edges: LayoutEdge[];
  width: number;
  height: number;
}

/** ViewBox state for SVG pan/zoom */
export interface ViewBox {
  x: number;
  y: number;
  width: number;
  height: number;
}
