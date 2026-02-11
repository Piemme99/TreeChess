import type { RepertoireNode, ShortColor } from '../../../types';

export interface TrainingMove {
  nodeId: string;
  fen: string;
  san: string;
  resultFen: string;
  isUserMove: boolean;
}

export type TrainingLine = TrainingMove[];

/**
 * Generate all training lines from a repertoire tree.
 *
 * Recurses into ALL children at every position to produce one line per
 * root-to-leaf path (full repertoire coverage). The `isUserMove` flag on
 * each move tells the state machine whether to wait for user input or
 * auto-play the opponent's move.
 *
 * Transposition nodes (transpositionOf != null with no children) are treated as leaves.
 */
export function generateTrainingLines(
  root: RepertoireNode,
  userColor: ShortColor
): TrainingLine[] {
  const lines: TrainingLine[] = [];

  function walk(node: RepertoireNode, currentLine: TrainingMove[]): void {
    // Leaf node or transposition stub — finish line
    const isTranspositionLeaf = node.transpositionOf != null && node.children.length === 0;
    if (node.children.length === 0 || isTranspositionLeaf) {
      if (currentLine.length > 0) {
        lines.push([...currentLine]);
      }
      return;
    }

    const isUserMove = node.colorToMove === userColor;

    for (const child of node.children) {
      const move: TrainingMove = {
        nodeId: child.id,
        fen: node.fen,
        san: child.move!,
        resultFen: child.fen,
        isUserMove,
      };
      currentLine.push(move);
      walk(child, currentLine);
      currentLine.pop();
    }
  }

  walk(root, []);

  // Shuffle lines for randomized training order
  shuffleArray(lines);

  return lines;
}

/**
 * Select a random subset of lines from all generated lines.
 * If count >= lines.length, returns all lines (already shuffled).
 */
export function selectRandomLines(lines: TrainingLine[], count: number): TrainingLine[] {
  if (count >= lines.length) {
    return lines;
  }
  return lines.slice(0, count);
}

/**
 * Build a lookup map from node ID to RepertoireNode for fast access
 * when the user plays an alternative move from the repertoire.
 */
export function buildNodeMap(root: RepertoireNode): Map<string, RepertoireNode> {
  const map = new Map<string, RepertoireNode>();

  function walk(node: RepertoireNode): void {
    map.set(node.id, node);
    for (const child of node.children) {
      walk(child);
    }
  }

  walk(root);
  return map;
}

/**
 * Given a node in the repertoire tree, generate a random continuation
 * (sequence of TrainingMoves) from that node down to a random leaf.
 *
 * This is used when the user plays an alternative move from the repertoire
 * that wasn't in the pre-selected line — we dynamically generate the rest
 * of the line by walking randomly through the subtree.
 */
export function generateContinuationFromNode(
  node: RepertoireNode,
  userColor: ShortColor
): TrainingMove[] {
  const moves: TrainingMove[] = [];
  let current = node;

  while (current.children.length > 0) {
    // Stop at transposition stubs
    if (current.transpositionOf != null && current.children.length === 0) {
      break;
    }

    const isUserMove = current.colorToMove === userColor;

    // Pick a random child to follow
    const child = current.children[Math.floor(Math.random() * current.children.length)];

    moves.push({
      nodeId: child.id,
      fen: current.fen,
      san: child.move!,
      resultFen: child.fen,
      isUserMove,
    });

    current = child;
  }

  return moves;
}

/**
 * Find a child node of a given parent node that matches the played SAN move.
 * Returns the child node if found, null otherwise.
 */
export function findChildBySan(
  parentNode: RepertoireNode,
  san: string
): RepertoireNode | null {
  for (const child of parentNode.children) {
    if (child.move === san) {
      return child;
    }
  }
  return null;
}

/** Fisher-Yates shuffle (in-place). */
function shuffleArray<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}
