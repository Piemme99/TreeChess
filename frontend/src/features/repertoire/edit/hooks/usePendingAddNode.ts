import { useRef, useEffect, useCallback } from 'react';
import { toast } from '../../../../stores/toastStore';
import { findNodeByFEN, findNode } from '../utils/nodeUtils';
import { repertoireApi } from '../../../../services/api';
import { makeMove, getShortFEN } from '../../../../shared/utils/chess';
import type { Repertoire, RepertoireNode, AddNodeRequest } from '../../../../types';

interface PendingMoveEntry {
  parentFEN: string;
  moveSAN: string;
  resultFEN: string;
}

interface PendingAddSequence {
  repertoireId: string;
  repertoireName: string;
  gameInfo: string;
  moves: PendingMoveEntry[];
}

// Legacy single-move format
interface PendingAddNode {
  repertoireId: string;
  repertoireName: string;
  parentFEN: string;
  moveSAN: string;
  gameInfo: string;
}

type PendingData = PendingAddSequence | PendingAddNode;

function isSequenceFormat(data: PendingData): data is PendingAddSequence {
  return 'moves' in data && Array.isArray(data.moves);
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

  const addMoveSequence = useCallback(async (
    repId: string,
    treeData: RepertoireNode,
    moves: PendingMoveEntry[],
    gameInfo: string,
    doSelectNode: (id: string) => void,
    doSetRepertoire: (rep: Repertoire) => void
  ) => {
    let currentTree = treeData;
    let added = 0;
    let skipped = 0;

    for (const entry of moves) {
      const parentNode = findNodeByFEN(currentTree, entry.parentFEN);
      if (!parentNode) {
        if (added > 0) {
          toast.warning(`Added ${added} move(s), but could not find position for "${entry.moveSAN}"`);
        } else {
          toast.warning('Position not found in repertoire. Navigate manually to add the move.');
        }
        return;
      }

      // Check if move already exists as child
      const existingChild = parentNode.children.find((c) => c.move === entry.moveSAN);
      if (existingChild) {
        doSelectNode(existingChild.id);
        skipped++;
        continue;
      }

      // Validate the move
      const newFEN = makeMove(parentNode.fen, entry.moveSAN);
      if (!newFEN) {
        toast.error(`Invalid move: ${entry.moveSAN}`);
        return;
      }

      try {
        const request: AddNodeRequest = {
          parentId: parentNode.id,
          move: entry.moveSAN,
          fen: getShortFEN(newFEN),
          moveNumber: parentNode.moveNumber + (parentNode.colorToMove === 'b' ? 1 : 0),
          colorToMove: parentNode.colorToMove === 'w' ? 'b' : 'w'
        };

        const updatedRepertoire = await repertoireApi.addNode(repId, request);
        doSetRepertoire(updatedRepertoire);
        currentTree = updatedRepertoire.treeData;

        // Select the newly added node
        const updatedParent = findNode(currentTree, parentNode.id);
        if (updatedParent) {
          const addedNode = updatedParent.children.find((c) => c.move === entry.moveSAN);
          if (addedNode) {
            doSelectNode(addedNode.id);
          }
        }

        added++;
      } catch {
        if (added > 0) {
          toast.warning(`Added ${added} move(s), then failed on "${entry.moveSAN}"`);
        } else {
          toast.error('Failed to add move to repertoire');
        }
        return;
      }
    }

    // Summary toast
    if (added === 0 && skipped > 0) {
      toast.info(`All ${skipped} move(s) already exist in repertoire`);
    } else if (added > 0 && skipped > 0) {
      toast.success(`Added ${added} move(s), ${skipped} already existed (from ${gameInfo})`);
    } else if (added > 0) {
      toast.success(`Added ${added} move(s) from ${gameInfo}`);
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
      const pending: PendingData = JSON.parse(pendingData);

      // Clear session storage immediately
      sessionStorage.removeItem('pendingAddNode');
      pendingAddProcessed.current = true;

      if (pending.repertoireId !== repertoireId) {
        toast.warning(`This move is for "${pending.repertoireName}"`);
        isProcessingRef.current = false;
        return;
      }

      if (isSequenceFormat(pending)) {
        // New sequence format
        addMoveSequence(
          repertoireId,
          repertoire.treeData,
          pending.moves,
          pending.gameInfo,
          selectNode,
          setRepertoire
        ).finally(() => {
          isProcessingRef.current = false;
        });
      } else {
        // Legacy single-move format
        const targetNode = findNodeByFEN(repertoire.treeData, pending.parentFEN);

        if (targetNode) {
          selectNode(targetNode.id);
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
      }
    } catch {
      sessionStorage.removeItem('pendingAddNode');
      isProcessingRef.current = false;
    }
  }, [repertoire, repertoireId, selectNode, setRepertoire, addMoveDirectly, addMoveSequence]);
}
