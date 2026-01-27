import { useRef, useEffect } from 'react';
import { toast } from '../../../../stores/toastStore';
import { findNodeByFEN } from '../utils/nodeUtils';
import type { Repertoire } from '../../../../types';

interface PendingAddNode {
  repertoireId: string;
  repertoireName: string;
  parentFEN: string;
  moveSAN: string;
  gameInfo: string;
}

export function usePendingAddNode(
  repertoire: Repertoire | null,
  repertoireId: string | undefined,
  selectNode: (id: string) => void,
  onMoveFound: (move: string) => void
) {
  const pendingAddProcessed = useRef(false);

  useEffect(() => {
    if (!repertoire || !repertoireId || pendingAddProcessed.current) return;

    const pendingData = sessionStorage.getItem('pendingAddNode');
    if (!pendingData) return;

    try {
      const pending: PendingAddNode = JSON.parse(pendingData);

      sessionStorage.removeItem('pendingAddNode');
      pendingAddProcessed.current = true;

      if (pending.repertoireId !== repertoireId) {
        toast.warning(`This move is for "${pending.repertoireName}"`);
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
  }, [repertoire, repertoireId, selectNode, onMoveFound]);
}
