import { useState, useCallback } from 'react';
import { useChess } from '../../../../shared/hooks/useChess';
import { repertoireApi } from '../../../../services/api';
import { toast } from '../../../../stores/toastStore';
import { findNode } from '../utils/nodeUtils';
import type { Color, RepertoireNode, Repertoire, AddNodeRequest } from '../../../../types';

export function useMoveActions(
  selectedNode: RepertoireNode | null,
  currentFEN: string,
  color: Color | undefined,
  setRepertoire: (color: Color, repertoire: Repertoire) => void,
  selectNode: (id: string) => void
) {
  const [actionLoading, setActionLoading] = useState(false);
  const [possibleMoves, setPossibleMoves] = useState<string[]>([]);
  const { makeMove, getShortFEN, isValidMove } = useChess();

  const handleBoardMove = useCallback(async (move: { san: string }) => {
    if (!color || !selectedNode) return;

    const existingMove = selectedNode.children.find((c) => c.move === move.san);
    if (existingMove) {
      selectNode(existingMove.id);
      return;
    }

    const newFEN = makeMove(currentFEN, move.san);
    if (!newFEN) {
      toast.error('Invalid move');
      return;
    }

    setActionLoading(true);
    try {
      const request: AddNodeRequest = {
        parentId: selectedNode.id,
        move: move.san,
        fen: getShortFEN(newFEN),
        moveNumber: selectedNode.moveNumber + (selectedNode.colorToMove === 'b' ? 1 : 0),
        colorToMove: selectedNode.colorToMove === 'w' ? 'b' : 'w'
      };

      const updatedRepertoire = await repertoireApi.addNode(color, request);
      setRepertoire(color, updatedRepertoire);

      const newNode = findNode(updatedRepertoire.treeData, selectedNode.id);
      if (newNode) {
        const addedNode = newNode.children.find((c) => c.move === move.san);
        if (addedNode) {
          selectNode(addedNode.id);
        }
      }

      toast.success('Move added');
    } catch {
      toast.error('Failed to add move');
    } finally {
      setActionLoading(false);
    }
  }, [color, selectedNode, currentFEN, setRepertoire, selectNode, makeMove, getShortFEN]);

  const handleAddMoveSubmit = useCallback(
    async (moveInput: string, setMoveError: (error: string) => void) => {
      if (!color || !selectedNode || !moveInput.trim()) return false;

      if (!isValidMove(currentFEN, moveInput.trim())) {
        setMoveError('Invalid move. Please use SAN notation (e.g., e4, Nf3, O-O)');
        return false;
      }

      const existingMove = selectedNode.children.find((c) => c.move === moveInput.trim());
      if (existingMove) {
        setMoveError('This move already exists in the repertoire');
        return false;
      }

      const newFEN = makeMove(currentFEN, moveInput.trim());
      if (!newFEN) {
        setMoveError('Invalid move');
        return false;
      }

      setActionLoading(true);
      try {
        const request: AddNodeRequest = {
          parentId: selectedNode.id,
          move: moveInput.trim(),
          fen: getShortFEN(newFEN),
          moveNumber: selectedNode.moveNumber + (selectedNode.colorToMove === 'b' ? 1 : 0),
          colorToMove: selectedNode.colorToMove === 'w' ? 'b' : 'w'
        };

        const updatedRepertoire = await repertoireApi.addNode(color, request);
        setRepertoire(color, updatedRepertoire);

        const newNode = findNode(updatedRepertoire.treeData, selectedNode.id);
        if (newNode) {
          const addedNode = newNode.children.find((c) => c.move === moveInput.trim());
          if (addedNode) {
            selectNode(addedNode.id);
          }
        }

        toast.success('Move added');
        return true;
      } catch {
        toast.error('Failed to add move');
        return false;
      } finally {
        setActionLoading(false);
      }
    },
    [color, selectedNode, currentFEN, setRepertoire, selectNode, makeMove, getShortFEN, isValidMove]
  );

  const handleDeleteBranch = useCallback(async () => {
    if (!color || !selectedNode || !selectedNode.parentId) return false;

    setActionLoading(true);
    try {
      const updatedRepertoire = await repertoireApi.deleteNode(color, selectedNode.id);
      setRepertoire(color, updatedRepertoire);

      if (selectedNode.parentId) {
        selectNode(selectedNode.parentId);
      } else {
        selectNode(updatedRepertoire.treeData.id);
      }

      toast.success('Branch deleted');
      return true;
    } catch {
      toast.error('Failed to delete branch');
      return false;
    } finally {
      setActionLoading(false);
    }
  }, [color, selectedNode, setRepertoire, selectNode]);

  return {
    actionLoading,
    possibleMoves,
    setPossibleMoves,
    handleBoardMove,
    handleAddMoveSubmit,
    handleDeleteBranch
  };
}