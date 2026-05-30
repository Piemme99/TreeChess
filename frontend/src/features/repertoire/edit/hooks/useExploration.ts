import { useCallback, useState } from 'react';
import { useChess } from '../../../../shared/hooks/useChess';
import { deriveChildMoveNumber } from '../../../../shared/utils/chess';
import { repertoireApi } from '../../../../services/api';
import { toast } from '../../../../stores/toastStore';
import { findNode } from '../utils/nodeUtils';
import type { RepertoireNode, Repertoire, AddNodeRequest } from '../../../../types';

interface ExploreMove {
  san: string;
  /** Full FEN of the position after the move (for the board + engine). */
  fen: string;
}

export interface UseExplorationReturn {
  exploring: boolean;
  saving: boolean;
  /** FEN to display while exploring, or null when not exploring. */
  exploreFEN: string | null;
  /** Full FENs of the explored moves, for the opening label path. */
  exploreFens: string[];
  hasExploredMoves: boolean;
  startExplore: () => void;
  discardExplore: () => void;
  exitExplore: () => void;
  playExploreMove: (san: string) => void;
  saveExplore: () => Promise<void>;
}

/**
 * Exploration mode for the repertoire editor: play moves on the board from the
 * selected node without committing them to the tree. Moves live in local state
 * only; the user can then save the line back into the repertoire or discard it.
 */
export function useExploration(
  selectedNode: RepertoireNode | null,
  repertoire: Repertoire | null,
  repertoireId: string | undefined,
  setRepertoire: (repertoire: Repertoire) => void,
  selectNode: (id: string) => void
): UseExplorationReturn {
  const { makeMove, getShortFEN } = useChess();
  const [exploring, setExploring] = useState(false);
  const [anchor, setAnchor] = useState<{ id: string; fen: string } | null>(null);
  const [moves, setMoves] = useState<ExploreMove[]>([]);
  const [saving, setSaving] = useState(false);

  const exploreFEN = exploring ? (moves.length ? moves[moves.length - 1].fen : anchor?.fen ?? null) : null;
  const exploreFens = moves.map((m) => m.fen);

  const startExplore = useCallback(() => {
    if (!selectedNode) return;
    setAnchor({ id: selectedNode.id, fen: selectedNode.fen });
    setMoves([]);
    setExploring(true);
  }, [selectedNode]);

  const reset = useCallback(() => {
    setExploring(false);
    setMoves([]);
    setAnchor(null);
  }, []);

  // Leave exploration and snap back to the node it started from.
  const discardExplore = useCallback(() => {
    const anchorId = anchor?.id;
    reset();
    if (anchorId) selectNode(anchorId);
  }, [anchor, reset, selectNode]);

  // Leave exploration without snapping (the caller is navigating elsewhere).
  const exitExplore = useCallback(() => {
    reset();
  }, [reset]);

  const playExploreMove = useCallback((san: string) => {
    setMoves((prev) => {
      const base = prev.length ? prev[prev.length - 1].fen : anchor?.fen;
      if (!base) return prev;
      const newFEN = makeMove(base, san);
      if (!newFEN) {
        toast.error('Invalid move');
        return prev;
      }
      return [...prev, { san, fen: newFEN }];
    });
  }, [anchor, makeMove]);

  const saveExplore = useCallback(async () => {
    if (!repertoireId || !repertoire || !anchor || moves.length === 0) return;

    setSaving(true);
    try {
      let tree = repertoire.treeData;
      let parent = findNode(tree, anchor.id);
      let lastId = parent?.id ?? null;

      for (const move of moves) {
        if (!parent) break;

        const existing = parent.children.find((c) => c.move === move.san);
        if (existing) {
          parent = existing;
          lastId = existing.id;
          continue;
        }

        const request: AddNodeRequest = {
          parentId: parent.id,
          move: move.san,
          fen: getShortFEN(move.fen),
          moveNumber: deriveChildMoveNumber(parent.moveNumber, parent.colorToMove),
          colorToMove: parent.colorToMove === 'w' ? 'b' : 'w',
        };

        const updated = await repertoireApi.addNode(repertoireId, request);
        tree = updated.treeData;
        setRepertoire(updated);

        const reParent = findNode(tree, parent.id);
        const added = reParent?.children.find((c) => c.move === move.san);
        if (!added) break;
        parent = added;
        lastId = added.id;
      }

      reset();
      if (lastId) selectNode(lastId);
      toast.success('Saved to repertoire');
    } catch {
      toast.error('Failed to save line');
    } finally {
      setSaving(false);
    }
  }, [repertoireId, repertoire, anchor, moves, getShortFEN, setRepertoire, selectNode, reset]);

  return {
    exploring,
    saving,
    exploreFEN,
    exploreFens,
    hasExploredMoves: moves.length > 0,
    startExplore,
    discardExplore,
    exitExplore,
    playExploreMove,
    saveExplore,
  };
}
