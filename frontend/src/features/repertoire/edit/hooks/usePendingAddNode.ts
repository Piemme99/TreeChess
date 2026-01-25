import { useRef, useEffect } from 'react';
import { toast } from '../../../../stores/toastStore';
import { findNodeByFEN } from '../utils/nodeUtils';
import type { Color, Repertoire } from '../../../../types';

interface PendingAddNode {
  color: string;
  parentFEN: string;
  moveSAN: string;
  gameInfo: string;
}

export function usePendingAddNode(
  repertoire: Repertoire | null,
  color: Color | undefined,
  selectNode: (id: string) => void,
  onMoveFound: (move: string) => void
) {
  const pendingAddProcessed = useRef(false);

  useEffect(() => {
    if (!repertoire || pendingAddProcessed.current) return;

    const pendingData = sessionStorage.getItem('pendingAddNode');
    if (!pendingData) return;

    try {
      const pending: PendingAddNode = JSON.parse(pendingData);

      sessionStorage.removeItem('pendingAddNode');
      pendingAddProcessed.current = true;

      if (pending.color !== color) {
        toast.warning(`This move is for the ${pending.color} repertoire`);
        return;
      }

      const targetNode = findNodeByFEN(repertoire.treeData, pending.parentFEN);

      if (targetNode) {
        selectNode(targetNode.id);
        onMoveFound(pending.moveSAN);
        toast.info(`Add "${pending.moveSAN}" from ${pending.gameInfo}`);
      } else {
        toast.warning('Position not found in repertoire. Navigate manually to add the move.');
      }
    } catch {
      sessionStorage.removeItem('pendingAddNode');
    }
  }, [repertoire, color, selectNode, onMoveFound]);
}