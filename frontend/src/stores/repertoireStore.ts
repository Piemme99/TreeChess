import { create } from 'zustand';
import type { Repertoire, RepertoireNode, Color, ApiError } from '../types';
import { repertoireApi } from '../services/api';

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
  fetchRepertoire: (id: string) => Promise<Repertoire | null>;

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
  getRepertoiresByColor: (color: Color) => Repertoire[];
  getSelectedRepertoire: () => Repertoire | null;
  getSelectedNode: () => RepertoireNode | null;
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
      // Update in the list
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
      return null;
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

  getRepertoiresByColor: (color) => {
    return get().repertoires.filter((r) => r.color === color);
  },

  getSelectedRepertoire: () => {
    const { repertoires, selectedRepertoireId } = get();
    if (!selectedRepertoireId) return null;
    return repertoires.find((r) => r.id === selectedRepertoireId) || null;
  },

  getSelectedNode: () => {
    const repertoire = get().getSelectedRepertoire();
    const selectedId = get().selectedNodeId;
    if (!repertoire || !selectedId) return null;
    return findNodeInTree(repertoire.treeData, selectedId);
  },

  findNode: (repertoire, nodeId) => {
    return findNodeInTree(repertoire.treeData, nodeId);
  }
}));

// Helper hook to get repertoires by color
export const useRepertoiresByColor = (color: Color) => {
  return useRepertoireStore((state) => state.repertoires.filter((r) => r.color === color));
};

// Helper hook to get a specific repertoire by ID
export const useRepertoireById = (id: string | null) => {
  return useRepertoireStore((state) =>
    id ? state.repertoires.find((r) => r.id === id) || null : null
  );
};
