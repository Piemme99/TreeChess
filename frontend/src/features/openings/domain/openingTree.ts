import type { PlayedGame, Side } from './playedGame';

export interface OpeningNode {
  readonly san: string | null;
  readonly games: number;
  readonly score: number;
  readonly children: readonly OpeningNode[];
}

export interface OpeningTree {
  readonly side: Side;
  readonly root: OpeningNode;
}

interface NodeUnderConstruction {
  san: string | null;
  games: number;
  score: number;
  children: Map<string, NodeUnderConstruction>;
}

export function buildOpeningTree(
  games: readonly PlayedGame[],
  side: Side,
  maxPlies: number,
): OpeningTree {
  const root = createNode(null);

  for (const game of games) {
    if (game.side !== side) continue;

    let node = root;
    record(node, game.score);
    for (const san of game.moves.slice(0, maxPlies)) {
      node = childFor(node, san);
      record(node, game.score);
    }
  }

  return { side, root: freeze(root) };
}

export function nodeAt(tree: OpeningTree, path: readonly string[]): OpeningNode | undefined {
  let node: OpeningNode | undefined = tree.root;
  for (const san of path) {
    node = node.children.find((child) => child.san === san);
    if (!node) return undefined;
  }
  return node;
}

function createNode(san: string | null): NodeUnderConstruction {
  return { san, games: 0, score: 0, children: new Map() };
}

function record(node: NodeUnderConstruction, score: number): void {
  node.games++;
  node.score += score;
}

function childFor(parent: NodeUnderConstruction, san: string): NodeUnderConstruction {
  let child = parent.children.get(san);
  if (!child) {
    child = createNode(san);
    parent.children.set(san, child);
  }
  return child;
}

function freeze(node: NodeUnderConstruction): OpeningNode {
  return {
    san: node.san,
    games: node.games,
    score: node.score,
    children: [...node.children.values()]
      .map(freeze)
      .sort((a, b) => b.games - a.games),
  };
}

export function isPlayerMove(side: Side, ply: number): boolean {
  if (ply === 0) return false;
  return (ply % 2 === 1) === (side === 'w');
}

export function forEachLine(
  tree: OpeningTree,
  visit: (node: OpeningNode, path: readonly string[]) => void,
): void {
  const walk = (node: OpeningNode, path: readonly string[]) => {
    visit(node, path);
    for (const child of node.children) walk(child, [...path, child.san!]);
  };
  walk(tree.root, []);
}
