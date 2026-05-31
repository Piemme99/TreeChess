import type { RepertoireNode } from '../../../../types';

export function findNode(node: RepertoireNode, id: string): RepertoireNode | null {
  if (node.id === id) return node;
  for (const child of node.children) {
    const found = findNode(child, id);
    if (found) return found;
  }
  return null;
}

export function findPathToNode(
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

// Identify a position by its board placement AND side-to-move (the first two
// FEN fields). Comparing placement alone collides two distinct positions that
// share a piece arrangement but differ in whose turn it is (e.g. a null-move
// transposition), which would graft moves onto the wrong node.
function positionKey(fen: string): string {
  return fen.split(' ').slice(0, 2).join(' ');
}

export function findNodeByFEN(node: RepertoireNode, targetFEN: string): RepertoireNode | null {
  const targetKey = positionKey(targetFEN);

  if (positionKey(node.fen) === targetKey) return node;

  for (const child of node.children) {
    const found = findNodeByFEN(child, targetFEN);
    if (found) return found;
  }
  return null;
}