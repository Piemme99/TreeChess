import { create } from 'zustand';
import type { Repertoire, RepertoireNode, Color, ApiError } from '../types';

interface RepertoireState {
  whiteRepertoire: Repertoire | null;
  blackRepertoire: Repertoire | null;
  selectedNodeId: string | null;
  loading: boolean;
  error: ApiError | null;

  setRepertoire: (color: Color, repertoire: Repertoire) => void;
  selectNode: (nodeId: string | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: ApiError | null) => void;
  clearError: () => void;

  getRepertoire: (color: Color) => Repertoire | null;
  getSelectedNode: (color: Color) => RepertoireNode | null;
  findNode: (repertoire: Repertoire, nodeId: string) => RepertoireNode | null;
}

function findNodeInTree(node: RepertoireNode, id: string): RepertoireNode | null {
  if (node.id === id) return node;
  for (const child of node.children) {
    const found = findNodeInTree(child, id);
    if (found) return found;
  }
  return null;
}

export const useRepertoireStore = create<RepertoireState>((set, get) => ({
  whiteRepertoire: null,
  blackRepertoire: null,
  selectedNodeId: null,
  loading: false,
  error: null,

  setRepertoire: (color, repertoire) => {
    if (color === 'white') {
      set({ whiteRepertoire: repertoire });
    } else {
      set({ blackRepertoire: repertoire });
    }
  },

  selectNode: (nodeId) => set({ selectedNodeId: nodeId }),

  setLoading: (loading) => set({ loading }),

  setError: (error) => set({ error }),

  clearError: () => set({ error: null }),

  getRepertoire: (color) => {
    return color === 'white' ? get().whiteRepertoire : get().blackRepertoire;
  },

  getSelectedNode: (color) => {
    const repertoire = get().getRepertoire(color);
    const selectedId = get().selectedNodeId;
    if (!repertoire || !selectedId) return null;
    return findNodeInTree(repertoire.treeData, selectedId);
  },

  findNode: (repertoire, nodeId) => {
    return findNodeInTree(repertoire.treeData, nodeId);
  }
}));
