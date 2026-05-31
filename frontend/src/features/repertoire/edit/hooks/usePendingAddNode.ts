import { useRef, useEffect, useCallback } from 'react';
import { toast } from '../../../../stores/toastStore';
import { findNodeByFEN, findNode } from '../utils/nodeUtils';
import { repertoireApi } from '../../../../services/api';
import { makeMove } from '../../../../shared/utils/chess';
import {
  buildAddNodeRequest,
  clearPendingAddNode,
  clearPendingNavigate,
  readPendingAddNode,
  readPendingNavigate,
  type PendingMoveEntry,
} from '../../../../shared/repertoireHandoff';
import type { Repertoire, RepertoireNode } from '../../../../types';

export function usePendingAddNode(
  repertoire: Repertoire | null,
  repertoireId: string | undefined,
  selectNode: (id: string) => void,
  setRepertoire: (repertoire: Repertoire) => void
) {
  const pendingAddProcessed = useRef(false);
  const pendingNavProcessed = useRef(false);
  const isProcessingRef = useRef(false);

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
        const request = buildAddNodeRequest(parentNode, entry.moveSAN, newFEN);

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

    const pending = readPendingAddNode();
    if (!pending) return;

    // Mark as processing immediately to prevent re-runs
    isProcessingRef.current = true;

    // Consume the stash immediately so a re-mount can't replay it.
    clearPendingAddNode();
    pendingAddProcessed.current = true;

    if (pending.repertoireId !== repertoireId) {
      toast.warning(`This move is for "${pending.repertoireName}"`);
      isProcessingRef.current = false;
      return;
    }

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
  }, [repertoire, repertoireId, selectNode, setRepertoire, addMoveSequence]);

  // Handle navigate-to-FEN requests (from game analysis "Open in Repertoire")
  useEffect(() => {
    if (!repertoire || !repertoireId) return;
    if (pendingNavProcessed.current) return;

    const pending = readPendingNavigate();
    if (!pending) return;

    pendingNavProcessed.current = true;
    clearPendingNavigate();

    if (pending.repertoireId !== repertoireId) return;

    const targetNode = findNodeByFEN(repertoire.treeData, pending.fen);
    if (targetNode) {
      selectNode(targetNode.id);
    } else {
      toast.warning('Position not found in repertoire');
    }
  }, [repertoire, repertoireId, selectNode]);

}
