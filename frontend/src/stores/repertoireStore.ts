import { create } from 'zustand';
import type { Repertoire, RepertoireNode, Color, ApiError } from '../types';
import { repertoireApi } from '../services/api';
import { findNode as findNodeInTree } from '../features/repertoire/edit/utils/nodeUtils';

interface RepertoireState {
  // Dynamic list of all repertoires
  repertoires: Repertoire[];
  // Currently selected repertoire ID for viewing/editing
  selectedRepertoireId: string | null;
  // Currently selected node within the selected repertoire
  selectedNodeId: string | null;
  loading: boolean;
  error: ApiError | null;

  // Actions - data fetching
  fetchRepertoires: () => Promise<void>;
  fetchRepertoire: (id: string) => Promise<Repertoire>;

  // Actions - repertoire management
  createRepertoire: (name: string, color: Color) => Promise<Repertoire>;
  renameRepertoire: (id: string, name: string) => Promise<void>;
  deleteRepertoire: (id: string) => Promise<void>;

  // Actions - selection
  selectRepertoire: (id: string | null) => void;
  selectNode: (nodeId: string | null) => void;

  // Actions - update repertoire in store (after addNode/deleteNode)
  updateRepertoire: (repertoire: Repertoire) => void;

  // State management
  setLoading: (loading: boolean) => void;
  setError: (error: ApiError | null) => void;
  clearError: () => void;

  // Computed helpers
  findNode: (repertoire: Repertoire, nodeId: string) => RepertoireNode | null;
}

export const useRepertoireStore = create<RepertoireState>((set) => ({
  repertoires: [],
  selectedRepertoireId: null,
  selectedNodeId: null,
  loading: false,
  error: null,

  fetchRepertoires: async () => {
    set({ loading: true, error: null });
    try {
      const repertoires = await repertoireApi.list();
      set({ repertoires, loading: false });
    } catch (err) {
      set({
        error: { message: 'Failed to fetch repertoires' },
        loading: false
      });
      throw err;
    }
  },

  fetchRepertoire: async (id: string) => {
    set({ loading: true, error: null });
    try {
      const repertoire = await repertoireApi.get(id);
      set((state) => ({
        repertoires: state.repertoires.map((r) =>
          r.id === id ? repertoire : r
        ),
        loading: false
      }));
      return repertoire;
    } catch (err) {
      set({
        error: { message: 'Failed to fetch repertoire' },
        loading: false
      });
      throw err;
    }
  },

  createRepertoire: async (name: string, color: Color) => {
    set({ loading: true, error: null });
    try {
      const repertoire = await repertoireApi.create({ name, color });
      set((state) => ({
        repertoires: [...state.repertoires, repertoire],
        loading: false
      }));
      return repertoire;
    } catch (err) {
      set({
        error: { message: 'Failed to create repertoire' },
        loading: false
      });
      throw err;
    }
  },

  renameRepertoire: async (id: string, name: string) => {
    set({ loading: true, error: null });
    try {
      const repertoire = await repertoireApi.rename(id, name);
      set((state) => ({
        repertoires: state.repertoires.map((r) =>
          r.id === id ? repertoire : r
        ),
        loading: false
      }));
    } catch (err) {
      set({
        error: { message: 'Failed to rename repertoire' },
        loading: false
      });
      throw err;
    }
  },

  deleteRepertoire: async (id: string) => {
    set({ loading: true, error: null });
    try {
      await repertoireApi.delete(id);
      set((state) => ({
        repertoires: state.repertoires.filter((r) => r.id !== id),
        selectedRepertoireId:
          state.selectedRepertoireId === id ? null : state.selectedRepertoireId,
        loading: false
      }));
    } catch (err) {
      set({
        error: { message: 'Failed to delete repertoire' },
        loading: false
      });
      throw err;
    }
  },

  selectRepertoire: (id) => set((state) => ({
    selectedRepertoireId: id,
    // Only reset selectedNodeId if we're changing to a different repertoire
    selectedNodeId: state.selectedRepertoireId === id ? state.selectedNodeId : null
  })),

  selectNode: (nodeId) => set({ selectedNodeId: nodeId }),

  updateRepertoire: (repertoire) => {
    set((state) => ({
      repertoires: state.repertoires.map((r) =>
        r.id === repertoire.id ? repertoire : r
      )
    }));
  },

  setLoading: (loading) => set({ loading }),

  setError: (error) => set({ error }),

  clearError: () => set({ error: null }),

  findNode: (repertoire, nodeId) => {
    return findNodeInTree(repertoire.treeData, nodeId);
  }
}));

// Selector hooks for optimized re-renders
export const useRepertoiresByColor = (color: Color) => {
  return useRepertoireStore((state) => state.repertoires.filter((r) => r.color === color));
};

export const useRepertoireById = (id: string | null) => {
  return useRepertoireStore((state) =>
    id ? state.repertoires.find((r) => r.id === id) || null : null
  );
};

export const useSelectedRepertoire = () => {
  return useRepertoireStore((state) => {
    if (!state.selectedRepertoireId) return null;
    return state.repertoires.find((r) => r.id === state.selectedRepertoireId) || null;
  });
};

export const useSelectedNode = () => {
  return useRepertoireStore((state) => {
    if (!state.selectedRepertoireId || !state.selectedNodeId) return null;
    const repertoire = state.repertoires.find((r) => r.id === state.selectedRepertoireId);
    if (!repertoire) return null;
    return findNodeInTree(repertoire.treeData, state.selectedNodeId);
  });
};
