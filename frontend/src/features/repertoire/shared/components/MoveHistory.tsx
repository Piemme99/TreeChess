import type { RepertoireNode } from '../../../../types';

interface MoveHistoryProps {
  rootNode: RepertoireNode;
  selectedNodeId: string | null;
}

/**
 * Finds the path from root to a specific node
 */
function findPathToNode(
  root: RepertoireNode,
  targetId: string,
  path: RepertoireNode[] = []
): RepertoireNode[] | null {
  const currentPath = [...path, root];

  if (root.id === targetId) {
    return currentPath;
  }

  for (const child of root.children) {
    const result = findPathToNode(child, targetId, currentPath);
    if (result) {
      return result;
    }
  }

  return null;
}

/**
 * Formats moves into standard chess notation with move numbers
 * e.g., "1. e4 c5 2. Nf3 d6 3. d4"
 */
function formatMoveSequence(nodes: RepertoireNode[]): string {
  const moves: string[] = [];

  for (const node of nodes) {
    if (node.move === null) continue; // Skip root

    const moveNumber = node.moveNumber;
    const isWhiteMove = node.colorToMove === 'b'; // After white moves, it's black's turn

    if (isWhiteMove) {
      moves.push(`${moveNumber}. ${node.move}`);
    } else {
      // Black's move - check if we need to add "..."
      const prevMove = moves[moves.length - 1];
      if (prevMove && prevMove.startsWith(`${moveNumber}.`)) {
        moves.push(node.move);
      } else {
        moves.push(`${moveNumber}... ${node.move}`);
      }
    }
  }

  return moves.join(' ');
}

export function MoveHistory({ rootNode, selectedNodeId }: MoveHistoryProps) {
  if (!selectedNodeId) {
    return (
      <div className="flex items-center gap-2 p-4 bg-bg-card rounded-md font-mono text-sm overflow-x-auto">
        <span className="font-semibold text-text-muted whitespace-nowrap">Moves played:</span>
        <span className="text-text whitespace-nowrap">Select a position</span>
      </div>
    );
  }

  const path = findPathToNode(rootNode, selectedNodeId);

  if (!path || path.length <= 1) {
    return (
      <div className="flex items-center gap-2 p-4 bg-bg-card rounded-md font-mono text-sm overflow-x-auto">
        <span className="font-semibold text-text-muted whitespace-nowrap">Moves played:</span>
        <span className="text-text whitespace-nowrap">Starting position</span>
      </div>
    );
  }

  const moveSequence = formatMoveSequence(path);

  return (
    <div className="flex items-center gap-2 p-4 bg-bg-card rounded-md font-mono text-sm overflow-x-auto">
      <span className="font-semibold text-text-muted whitespace-nowrap">Moves played:</span>
      <span className="text-text whitespace-nowrap">{moveSequence}</span>
    </div>
  );
}
