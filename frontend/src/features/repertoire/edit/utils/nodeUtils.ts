import type { RepertoireNode } from '../../../../types';

export function findNode(node: RepertoireNode, id: string): RepertoireNode | null {
  if (node.id === id) return node;
  for (const child of node.children) {
    const found = findNode(child, id);
    if (found) return found;
  }
  return null;
}

export function findNodeByFEN(node: RepertoireNode, targetFEN: string): RepertoireNode | null {
  const nodePosition = node.fen.split(' ')[0];
  const targetPosition = targetFEN.split(' ')[0];

  if (nodePosition === targetPosition) return node;

  for (const child of node.children) {
    const found = findNodeByFEN(child, targetFEN);
    if (found) return found;
  }
  return null;
}