import { useRef, useEffect, useCallback } from 'react';
import { toast } from '../../../../stores/toastStore';
import { findNodeByFEN, findNode } from '../utils/nodeUtils';
import { repertoireApi } from '../../../../services/api';
import { makeMove, getShortFEN } from '../../../../shared/utils/chess';
import type { Repertoire, RepertoireNode, AddNodeRequest } from '../../../../types';

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
  setRepertoire: (repertoire: Repertoire) => void
) {
  const pendingAddProcessed = useRef(false);
  const isProcessingRef = useRef(false);

  const addMoveDirectly = useCallback(async (
    repId: string,
    parentNode: RepertoireNode,
    moveSAN: string,
    gameInfo: string,
    doSelectNode: (id: string) => void,
    doSetRepertoire: (rep: Repertoire) => void
  ) => {
    // Check if move already exists
    const existingMove = parentNode.children.find((c) => c.move === moveSAN);
    if (existingMove) {
      doSelectNode(existingMove.id);
      toast.info(`Move "${moveSAN}" already exists in repertoire`);
      return;
    }

    // Validate and make the move
    const newFEN = makeMove(parentNode.fen, moveSAN);
    if (!newFEN) {
      toast.error(`Invalid move: ${moveSAN}`);
      return;
    }

    try {
      const request: AddNodeRequest = {
        parentId: parentNode.id,
        move: moveSAN,
        fen: getShortFEN(newFEN),
        moveNumber: parentNode.moveNumber + (parentNode.colorToMove === 'b' ? 1 : 0),
        colorToMove: parentNode.colorToMove === 'w' ? 'b' : 'w'
      };

      const updatedRepertoire = await repertoireApi.addNode(repId, request);
      doSetRepertoire(updatedRepertoire);

      // Find and select the newly added node
      const updatedParent = findNode(updatedRepertoire.treeData, parentNode.id);
      if (updatedParent) {
        const addedNode = updatedParent.children.find((c) => c.move === moveSAN);
        if (addedNode) {
          doSelectNode(addedNode.id);
        }
      }

      toast.success(`Move "${moveSAN}" added from ${gameInfo}`);
    } catch {
      toast.error('Failed to add move to repertoire');
    }
  }, []);

  useEffect(() => {
    if (!repertoire || !repertoireId) return;
    if (pendingAddProcessed.current || isProcessingRef.current) return;

    const pendingData = sessionStorage.getItem('pendingAddNode');
    if (!pendingData) return;

    // Mark as processing immediately to prevent re-runs
    isProcessingRef.current = true;

    try {
      const pending: PendingAddNode = JSON.parse(pendingData);

      // Clear session storage immediately
      sessionStorage.removeItem('pendingAddNode');
      pendingAddProcessed.current = true;

      if (pending.repertoireId !== repertoireId) {
        toast.warning(`This move is for "${pending.repertoireName}"`);
        isProcessingRef.current = false;
        return;
      }

      const targetNode = findNodeByFEN(repertoire.treeData, pending.parentFEN);

      if (targetNode) {
        selectNode(targetNode.id);
        // Add the move directly without modal
        addMoveDirectly(
          repertoireId,
          targetNode,
          pending.moveSAN,
          pending.gameInfo,
          selectNode,
          setRepertoire
        ).finally(() => {
          isProcessingRef.current = false;
        });
      } else {
        toast.warning('Position not found in repertoire. Navigate manually to add the move.');
        isProcessingRef.current = false;
      }
    } catch {
      sessionStorage.removeItem('pendingAddNode');
      isProcessingRef.current = false;
    }
  }, [repertoire, repertoireId, selectNode, setRepertoire, addMoveDirectly]);
}
