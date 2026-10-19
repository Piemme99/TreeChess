import { hierarchy, tree } from 'd3-hierarchy';
import { figurine } from '../domain/notation';
import type { VisibleNode } from './fold';
import type { MapNode } from './repertoireMap';

export const ROW = 38;
export const COLUMN = 128;
export const PILL_HEIGHT = 26;
const CHAR = 7.4;
const PADDING = 18;

export interface PlacedNode {
  node: MapNode;
  hidden: number;
  x: number;
  y: number;
  width: number;
  label: string;
}

export interface PlacedEdge {
  from: PlacedNode;
  to: PlacedNode;
}

export interface MapLayout {
  nodes: PlacedNode[];
  edges: PlacedEdge[];
  bounds: { x: number; y: number; width: number; height: number };
}

/** Le coup tel qu'il se lit sur la carte : le numéro pour les Blancs, le coup seul pour les Noirs. */
export function labelOf(node: MapNode): string {
  if (node.san === null) return 'Start';
  return figurine(node.ply % 2 === 1 ? `${Math.ceil(node.ply / 2)}.${node.san}` : node.san);
}

/** Les nœuds visibles disposés de gauche à droite, un demi-coup par colonne. */
export function layoutMap(root: MapNode, visible: readonly VisibleNode[]): MapLayout {
  const shown = new Map(visible.map((entry) => [entry.node.key, entry]));
  const children = (node: MapNode) => node.children.filter((child) => shown.has(child.key));
  const placed = tree<MapNode>().nodeSize([ROW, COLUMN])(hierarchy(root, children));

  const byKey = new Map<string, PlacedNode>();
  placed.each((point) => {
    const label = labelOf(point.data);
    byKey.set(point.data.key, {
      node: point.data,
      hidden: shown.get(point.data.key)!.hidden,
      x: point.depth * COLUMN,
      y: point.x,
      width: label.length * CHAR + PADDING,
      label,
    });
  });
  const nodes = [...byKey.values()];
  const edges = placed.links().map((link) => ({ from: byKey.get(link.source.data.key)!, to: byKey.get(link.target.data.key)! }));

  const minY = Math.min(...nodes.map((node) => node.y)) - ROW;
  const maxY = Math.max(...nodes.map((node) => node.y)) + ROW;
  const maxX = Math.max(...nodes.map((node) => node.x + node.width / 2 + 40));
  return { nodes, edges, bounds: { x: -40, y: minY, width: maxX + 40, height: maxY - minY } };
}
