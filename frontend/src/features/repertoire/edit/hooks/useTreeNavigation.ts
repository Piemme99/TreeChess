import { useEffect, useCallback } from 'react';
import type { RepertoireNode } from '../../../../types';
import { findNode } from '../utils/nodeUtils';

function findParent(root: RepertoireNode, nodeId: string): RepertoireNode | null {
  for (const child of root.children) {
    if (child.id === nodeId) return root;
    const found = findParent(child, nodeId);
    if (found) return found;
  }
  return null;
}

export function useTreeNavigation(
  treeData: RepertoireNode | undefined,
  selectedNodeId: string | null,
  selectNode: (id: string) => void
) {
  const goToParent = useCallback(() => {
    if (!treeData || !selectedNodeId) return;
    const parent = findParent(treeData, selectedNodeId);
    if (parent) selectNode(parent.id);
  }, [treeData, selectedNodeId, selectNode]);

  const goToFirstChild = useCallback(() => {
    if (!treeData || !selectedNodeId) return;
    const node = findNode(treeData, selectedNodeId);
    if (node && node.children.length > 0) {
      selectNode(node.children[0].id);
    }
  }, [treeData, selectedNodeId, selectNode]);

  const goToSibling = useCallback((direction: 1 | -1) => {
    if (!treeData || !selectedNodeId) return;
    const parent = findParent(treeData, selectedNodeId);
    if (!parent) return;
    const siblings = parent.children;
    const idx = siblings.findIndex(c => c.id === selectedNodeId);
    const nextIdx = idx + direction;
    if (nextIdx >= 0 && nextIdx < siblings.length) {
      selectNode(siblings[nextIdx].id);
    }
  }, [treeData, selectedNodeId, selectNode]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
      return;
    }

    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        goToParent();
        break;
      case 'ArrowRight':
        e.preventDefault();
        goToFirstChild();
        break;
      case 'ArrowUp':
        e.preventDefault();
        goToSibling(-1);
        break;
      case 'ArrowDown':
        e.preventDefault();
        goToSibling(1);
        break;
    }
  }, [goToParent, goToFirstChild, goToSibling]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}
