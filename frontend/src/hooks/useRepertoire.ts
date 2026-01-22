import { useCallback } from 'react';
import { useRepertoireStore } from '../stores/repertoireStore';
import { repertoireApi } from '../services/api';
import { toast } from '../stores/toastStore';
import type { Color, RepertoireNode, AddNodeRequest } from '../types';

/**
 * Custom hook for repertoire operations
 */
export function useRepertoire(color: Color) {
  const {
    whiteRepertoire,
    blackRepertoire,
    selectedNodeId,
    loading,
    setRepertoire,
    selectNode,
    setLoading,
    setError
  } = useRepertoireStore();

  const repertoire = color === 'white' ? whiteRepertoire : blackRepertoire;

  const findNode = useCallback(
    (node: RepertoireNode, id: string): RepertoireNode | null => {
      if (node.id === id) return node;
      for (const child of node.children) {
        const found = findNode(child, id);
        if (found) return found;
      }
      return null;
    },
    []
  );

  const loadRepertoire = useCallback(async () => {
    setLoading(true);
    try {
      const data = await repertoireApi.get(color);
      setRepertoire(color, data);
      selectNode(data.treeData.id);
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load repertoire';
      setError({ message });
      toast.error(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [color, setRepertoire, selectNode, setLoading, setError]);

  const addNode = useCallback(
    async (request: AddNodeRequest) => {
      try {
        const updatedRepertoire = await repertoireApi.addNode(color, request);
        setRepertoire(color, updatedRepertoire);

        // Select the newly added node
        const parentNode = findNode(updatedRepertoire.treeData, request.parentId);
        if (parentNode) {
          const newNode = parentNode.children.find((c) => c.move === request.move);
          if (newNode) {
            selectNode(newNode.id);
          }
        }

        toast.success('Move added');
        return updatedRepertoire;
      } catch {
        toast.error('Failed to add move');
        throw new Error('Failed to add move');
      }
    },
    [color, setRepertoire, selectNode, findNode]
  );

  const deleteNode = useCallback(
    async (nodeId: string, parentId: string | null) => {
      try {
        const updatedRepertoire = await repertoireApi.deleteNode(color, nodeId);
        setRepertoire(color, updatedRepertoire);

        // Select parent or root after deletion
        if (parentId) {
          selectNode(parentId);
        } else {
          selectNode(updatedRepertoire.treeData.id);
        }

        toast.success('Branch deleted');
        return updatedRepertoire;
      } catch {
        toast.error('Failed to delete branch');
        throw new Error('Failed to delete branch');
      }
    },
    [color, setRepertoire, selectNode]
  );

  const getSelectedNode = useCallback((): RepertoireNode | null => {
    if (!repertoire || !selectedNodeId) return null;
    return findNode(repertoire.treeData, selectedNodeId);
  }, [repertoire, selectedNodeId, findNode]);

  return {
    repertoire,
    selectedNodeId,
    loading,
    findNode,
    loadRepertoire,
    addNode,
    deleteNode,
    selectNode,
    getSelectedNode
  };
}
