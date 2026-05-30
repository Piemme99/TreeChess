import { repertoireApi } from '../../../services/api';
import { findNodeByFEN } from '../../repertoire/edit/utils/nodeUtils';
import { makeMove, getShortFEN, deriveChildMoveNumber } from '../../../shared/utils/chess';
import type { AddNodeRequest, RepertoireNode } from '../../../types';

/**
 * A single move to graft, expressed as the parent position, the SAN played, and
 * the resulting position. Same shape the repertoire editor's pending-add flow
 * consumes — see usePendingAddNode.
 */
export interface LineMove {
  parentFEN: string;
  moveSAN: string;
  resultFEN: string;
}

export interface AddLineResult {
  /** SANs that were newly added to the repertoire, in order. */
  added: string[];
  /** SANs that already existed on the path and were left untouched. */
  skipped: string[];
  /** Set when the sequence could not be fully applied. `added` still lists what landed. */
  error?: string;
}

/**
 * Graft a line of moves onto an existing repertoire in place, without leaving
 * the current view. Fetches the repertoire's current tree, then walks the
 * sequence move-by-move: positions already present are skipped, new positions
 * are POSTed. Stops at the first position it cannot locate or a move it cannot
 * play, reporting what was added so far.
 *
 * This mirrors the sequence walk in the editor's `usePendingAddNode`, but
 * returns a result for the caller to surface (a toast) instead of redirecting.
 */
export async function addLineToRepertoire(
  repertoireId: string,
  moves: LineMove[]
): Promise<AddLineResult> {
  const added: string[] = [];
  const skipped: string[] = [];

  let repertoire;
  try {
    repertoire = await repertoireApi.get(repertoireId);
  } catch {
    return { added, skipped, error: 'Failed to load repertoire' };
  }

  let currentTree: RepertoireNode = repertoire.treeData;

  for (const entry of moves) {
    const parentNode = findNodeByFEN(currentTree, entry.parentFEN);
    if (!parentNode) {
      return {
        added,
        skipped,
        error: `Could not find the position before ${entry.moveSAN} in the repertoire`
      };
    }

    const existingChild = parentNode.children.find((c) => c.move === entry.moveSAN);
    if (existingChild) {
      skipped.push(entry.moveSAN);
      continue;
    }

    const newFEN = makeMove(parentNode.fen, entry.moveSAN);
    if (!newFEN) {
      return { added, skipped, error: `Invalid move: ${entry.moveSAN}` };
    }

    try {
      const request: AddNodeRequest = {
        parentId: parentNode.id,
        move: entry.moveSAN,
        fen: getShortFEN(newFEN),
        moveNumber: deriveChildMoveNumber(parentNode.moveNumber, parentNode.colorToMove),
        colorToMove: parentNode.colorToMove === 'w' ? 'b' : 'w'
      };

      const updated = await repertoireApi.addNode(repertoireId, request);
      currentTree = updated.treeData;
      added.push(entry.moveSAN);
    } catch {
      return { added, skipped, error: `Failed to add ${entry.moveSAN}` };
    }
  }

  return { added, skipped };
}
