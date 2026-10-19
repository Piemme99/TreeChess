import { Chess } from 'chess.js';
import { nodeAt, type OpeningTree } from '../domain/openingTree';
import type { Side } from '../domain/playedGame';
import type { Priority } from '../domain/priorities';
import { positionKey, repertoireMovesAt, type Repertoire } from '../domain/repertoire';

/** Une position du répertoire, dessinée une fois ; `stub` : déjà dessinée ailleurs, cette arrivée n'est qu'un bout d'arête. */
export interface MapNode {
  key: string;
  path: readonly string[];
  san: string | null;
  ply: number;
  position: string;
  /** Parties passées par là sur la période récente, toutes arrivées confondues. */
  games: number;
  children: MapNode[];
  stub: boolean;
  /** Pour un bout d'arête : la clé du nœud où la position est dessinée. */
  owner?: string;
  /** Parties qui attendent une décision à cette position. */
  toSettle: number;
  /** Rang de la priorité qui finit ici. */
  priority?: number;
}

export interface MapMarks {
  /** Par clé de position : les parties à trancher. */
  toSettle: ReadonlyMap<string, number>;
  priorities: readonly Priority[];
}

export const keyOf = (path: readonly string[]) => path.join(' ');

/** Le répertoire d'un camp déployé depuis la position de départ ; une position atteinte par deux ordres de coups appartient au plus court. */
export function buildRepertoireMap(repertoire: Repertoire, recent: OpeningTree, marks: MapMarks): MapNode {
  const start = new Chess().fen();
  const root: MapNode = node([], null, 0, positionKey(start), recent, marks);
  const owners = new Map<string, MapNode>([[root.position, root]]);
  const queue: { node: MapNode; fen: string }[] = [{ node: root, fen: start }];

  while (queue.length) {
    const { node: parent, fen } = queue.shift()!;
    for (const move of repertoireMovesAt(repertoire, fen)) {
      const chess = new Chess(fen);
      chess.move(move.san);
      const path = [...parent.path, move.san];
      const child = node(path, move.san, parent.ply + 1, positionKey(chess.fen()), recent, marks);
      const owner = owners.get(child.position);
      if (owner) {
        child.stub = true;
        child.owner = owner.key;
        owner.games += child.games;
      } else {
        owners.set(child.position, child);
        queue.push({ node: child, fen: chess.fen() });
      }
      parent.children.push(child);
    }
  }
  pin(repertoire.side, marks.priorities, owners);
  return root;
}

function node(path: readonly string[], san: string | null, ply: number, position: string, recent: OpeningTree, marks: MapMarks): MapNode {
  return {
    key: keyOf(path),
    path,
    san,
    ply,
    position,
    games: nodeAt(recent, path)?.games ?? 0,
    children: [],
    stub: false,
    toSettle: marks.toSettle.get(position) ?? 0,
  };
}

// Une priorité est une ligne de l'arbre d'ouvertures : elle peut finir hors du répertoire, l'épingle n'a alors pas de nœud.
function pin(side: Side, priorities: readonly Priority[], owners: ReadonlyMap<string, MapNode>) {
  priorities.forEach((priority, index) => {
    if (priority.side !== side) return;
    const owner = owners.get(positionAfter(priority.path));
    if (owner && owner.priority === undefined) owner.priority = index + 1;
  });
}

function positionAfter(path: readonly string[]): string {
  const chess = new Chess();
  for (const san of path) chess.move(san);
  return positionKey(chess.fen());
}

export function forEachNode(root: MapNode, visit: (node: MapNode, parent: MapNode | null) => void) {
  const walk = (node: MapNode, parent: MapNode | null) => {
    visit(node, parent);
    node.children.forEach((child) => walk(child, node));
  };
  walk(root, null);
}

export const isMarked = (node: MapNode) => node.toSettle > 0 || node.priority !== undefined;

/** Les nœuds marqués, les plus de parties à trancher d'abord, puis les priorités par rang. */
export function markedNodes(root: MapNode): { toSettle: MapNode[]; priorities: MapNode[] } {
  const toSettle: MapNode[] = [];
  const priorities: MapNode[] = [];
  forEachNode(root, (node) => {
    if (node.stub) return;
    if (node.toSettle) toSettle.push(node);
    if (node.priority !== undefined) priorities.push(node);
  });
  toSettle.sort((a, b) => b.toSettle - a.toSettle);
  priorities.sort((a, b) => a.priority! - b.priority!);
  return { toSettle, priorities };
}
