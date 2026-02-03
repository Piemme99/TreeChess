import { create } from 'zustand';
import type { Repertoire, RepertoireNode, Color, ApiError, Category } from '../types';
import { repertoireApi, categoryApi } from '../services/api';
import { findNode as findNodeInTree } from '../features/repertoire/edit/utils/nodeUtils';

interface RepertoireState {
  // Dynamic list of all repertoires
  repertoires: Repertoire[];
  // Categories
  categories: Category[];
  expandedCategories: Set<string>;
  // Currently selected repertoire ID for viewing/editing
  selectedRepertoireId: string | null;
  // Currently selected node within the selected repertoire
  selectedNodeId: string | null;
  loading: boolean;
  error: ApiError | null;

  // Actions - data fetching
  fetchRepertoires: () => Promise<void>;
  fetchRepertoire: (id: string) => Promise<Repertoire>;
  fetchCategories: () => Promise<void>;

  // Actions - repertoire management
  createRepertoire: (name: string, color: Color) => Promise<Repertoire>;
  renameRepertoire: (id: string, name: string) => Promise<void>;
  deleteRepertoire: (id: string) => Promise<void>;
  mergeRepertoires: (ids: string[], name: string) => Promise<Repertoire>;
  assignRepertoireToCategory: (repertoireId: string, categoryId: string | null) => Promise<void>;

  // Actions - category management
  createCategory: (name: string, color: Color) => Promise<Category>;
  renameCategory: (id: string, name: string) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  toggleCategoryExpanded: (id: string) => void;
  addCategory: (category: Category) => void;

  // Actions - selection
  selectRepertoire: (id: string | null) => void;
  selectNode: (nodeId: string | null) => void;

  // Actions - update repertoire in store (after addNode/deleteNode)
  updateRepertoire: (repertoire: Repertoire) => void;
  addRepertoire: (repertoire: Repertoire) => void;
  removeRepertoire: (id: string) => void;

  // State management
  setLoading: (loading: boolean) => void;
  setError: (error: ApiError | null) => void;
  clearError: () => void;
  clearAll: () => void;

  // Computed helpers
  findNode: (repertoire: Repertoire, nodeId: string) => RepertoireNode | null;
}

export const useRepertoireStore = create<RepertoireState>((set, get) => ({
  repertoires: [],
  categories: [],
  expandedCategories: new Set<string>(),
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

  fetchCategories: async () => {
    try {
      const categories = await categoryApi.list();
      set({ categories });
    } catch (err) {
      console.error('Failed to fetch categories:', err);
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

  mergeRepertoires: async (ids: string[], name: string) => {
    set({ loading: true, error: null });
    try {
      const result = await repertoireApi.mergeRepertoires(ids, name);
      set((state) => ({
        repertoires: [
          ...state.repertoires.filter((r) => !ids.includes(r.id)),
          result.merged
        ],
        selectedRepertoireId:
          ids.includes(state.selectedRepertoireId || '') ? null : state.selectedRepertoireId,
        loading: false
      }));
      return result.merged;
    } catch (err) {
      set({
        error: { message: 'Failed to merge repertoires' },
        loading: false
      });
      throw err;
    }
  },

  assignRepertoireToCategory: async (repertoireId: string, categoryId: string | null) => {
    set({ loading: true, error: null });
    try {
      const repertoire = await repertoireApi.assignCategory(repertoireId, categoryId);
      set((state) => ({
        repertoires: state.repertoires.map((r) =>
          r.id === repertoireId ? repertoire : r
        ),
        loading: false
      }));
    } catch (err) {
      set({
        error: { message: 'Failed to assign category' },
        loading: false
      });
      throw err;
    }
  },

  createCategory: async (name: string, color: Color) => {
    set({ loading: true, error: null });
    try {
      const category = await categoryApi.create({ name, color });
      set((state) => ({
        categories: [...state.categories, category],
        expandedCategories: new Set([...state.expandedCategories, category.id]),
        loading: false
      }));
      return category;
    } catch (err) {
      set({
        error: { message: 'Failed to create category' },
        loading: false
      });
      throw err;
    }
  },

  renameCategory: async (id: string, name: string) => {
    set({ loading: true, error: null });
    try {
      const category = await categoryApi.rename(id, name);
      set((state) => ({
        categories: state.categories.map((c) =>
          c.id === id ? category : c
        ),
        loading: false
      }));
    } catch (err) {
      set({
        error: { message: 'Failed to rename category' },
        loading: false
      });
      throw err;
    }
  },

  deleteCategory: async (id: string) => {
    set({ loading: true, error: null });
    try {
      await categoryApi.delete(id);
      set((state) => ({
        categories: state.categories.filter((c) => c.id !== id),
        // Also remove category from repertoires
        repertoires: state.repertoires.map((r) =>
          r.categoryId === id ? { ...r, categoryId: null } : r
        ).filter((r) => r.categoryId !== id), // Cascade delete removes repertoires
        loading: false
      }));
      // Refetch repertoires since cascade delete removes them
      get().fetchRepertoires();
    } catch (err) {
      set({
        error: { message: 'Failed to delete category' },
        loading: false
      });
      throw err;
    }
  },

  toggleCategoryExpanded: (id: string) => {
    set((state) => {
      const newExpanded = new Set(state.expandedCategories);
      if (newExpanded.has(id)) {
        newExpanded.delete(id);
      } else {
        newExpanded.add(id);
      }
      return { expandedCategories: newExpanded };
    });
  },

  addCategory: (category: Category) => {
    set((state) => ({
      categories: [...state.categories, category],
      expandedCategories: new Set([...state.expandedCategories, category.id])
    }));
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

  addRepertoire: (repertoire) => {
    set((state) => ({
      repertoires: [...state.repertoires, repertoire]
    }));
  },

  removeRepertoire: (id) => {
    set((state) => ({
      repertoires: state.repertoires.filter((r) => r.id !== id)
    }));
  },

  setLoading: (loading) => set({ loading }),

  setError: (error) => set({ error }),

  clearError: () => set({ error: null }),

  clearAll: () => set({
    repertoires: [],
    categories: [],
    expandedCategories: new Set<string>(),
    selectedRepertoireId: null,
    selectedNodeId: null,
    loading: false,
    error: null,
  }),

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

// Category selectors
export const useCategoriesByColor = (color: Color) => {
  return useRepertoireStore((state) => state.categories.filter((c) => c.color === color));
};

export const useRepertoiresByCategory = (categoryId: string) => {
  return useRepertoireStore((state) =>
    state.repertoires.filter((r) => r.categoryId === categoryId)
  );
};

export const useUncategorizedRepertoires = (color: Color) => {
  return useRepertoireStore((state) =>
    state.repertoires.filter((r) => r.color === color && !r.categoryId)
  );
};

export const useCategoryExpanded = (id: string) => {
  return useRepertoireStore((state) => state.expandedCategories.has(id));
};
