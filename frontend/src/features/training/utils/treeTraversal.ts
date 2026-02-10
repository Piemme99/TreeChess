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
  for (let i = lines.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [lines[i], lines[j]] = [lines[j], lines[i]];
  }

  return lines;
}
