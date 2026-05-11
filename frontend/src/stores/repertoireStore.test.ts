import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useRepertoireStore } from './repertoireStore';
import { createRepertoire, createCategory } from '../test/factories';


// --- Mock the API module ---
vi.mock('../services/api', () => ({
  repertoireApi: {
    list: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    rename: vi.fn(),
    updateDescription: vi.fn(),
    delete: vi.fn(),
    mergeRepertoires: vi.fn(),
    assignCategory: vi.fn(),
  },
  categoryApi: {
    list: vi.fn(),
    create: vi.fn(),
    rename: vi.fn(),
    delete: vi.fn(),
  },
}));

// Mock toastStore
vi.mock('./toastStore', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
}));

import { repertoireApi, categoryApi } from '../services/api';
import { toast } from './toastStore';

const mockRepertoireApi = vi.mocked(repertoireApi);
const mockCategoryApi = vi.mocked(categoryApi);
const mockToast = vi.mocked(toast);

// --- Helpers ---

function getState() {
  return useRepertoireStore.getState();
}

function resetStore() {
  useRepertoireStore.setState({
    repertoires: [],
    categories: [],
    expandedCategories: new Set<string>(),
    selectedRepertoireId: null,
    selectedNodeId: null,
    loading: false,
    error: null,
  });
}

// --- Tests ---

describe('repertoireStore', () => {
  beforeEach(() => {
    resetStore();
    vi.clearAllMocks();
  });

  // --- fetchRepertoires ---

  describe('fetchRepertoires', () => {
    it('sets repertoires and loading=false on success', async () => {
      const reps = [createRepertoire({ id: 'r1' }), createRepertoire({ id: 'r2' })];
      mockRepertoireApi.list.mockResolvedValue(reps);

      await getState().fetchRepertoires();

      expect(getState().repertoires).toEqual(reps);
      expect(getState().loading).toBe(false);
      expect(getState().error).toBeNull();
    });

    it('sets error and throws on failure', async () => {
      mockRepertoireApi.list.mockRejectedValue(new Error('Network error'));

      await expect(getState().fetchRepertoires()).rejects.toThrow();

      expect(getState().error).toEqual({ message: 'Failed to fetch repertoires' });
      expect(getState().loading).toBe(false);
    });

    it('sets loading=true before fetching', async () => {
      let loadingDuringFetch = false;
      mockRepertoireApi.list.mockImplementation(async () => {
        loadingDuringFetch = getState().loading;
        return [];
      });

      await getState().fetchRepertoires();

      expect(loadingDuringFetch).toBe(true);
    });
  });

  // --- fetchRepertoire ---

  describe('fetchRepertoire', () => {
    it('updates specific repertoire in the array', async () => {
      const existing = createRepertoire({ id: 'r1', name: 'Old Name' });
      const updated = createRepertoire({ id: 'r1', name: 'New Name' });
      useRepertoireStore.setState({ repertoires: [existing] });
      mockRepertoireApi.get.mockResolvedValue(updated);

      const result = await getState().fetchRepertoire('r1');

      expect(result.name).toBe('New Name');
      expect(getState().repertoires[0].name).toBe('New Name');
    });

    it('returns the fetched repertoire', async () => {
      const rep = createRepertoire({ id: 'r1' });
      useRepertoireStore.setState({ repertoires: [rep] });
      mockRepertoireApi.get.mockResolvedValue(rep);

      const result = await getState().fetchRepertoire('r1');

      expect(result).toEqual(rep);
    });

    it('adds the repertoire to the store when not already present', async () => {
      // Repro: F5 on /repertoire/:id/edit loads the page with an empty store.
      // Without this, the fetched repertoire was dropped and the editor was
      // stuck on the "Loading repertoire..." screen forever.
      const rep = createRepertoire({ id: 'r1' });
      mockRepertoireApi.get.mockResolvedValue(rep);

      const result = await getState().fetchRepertoire('r1');

      expect(result).toEqual(rep);
      expect(getState().repertoires).toHaveLength(1);
      expect(getState().repertoires[0]).toEqual(rep);
    });

    it('sets error and throws on failure', async () => {
      mockRepertoireApi.get.mockRejectedValue(new Error('Not found'));

      await expect(getState().fetchRepertoire('r1')).rejects.toThrow();
      expect(getState().error).toEqual({ message: 'Failed to fetch repertoire' });
    });
  });

  // --- fetchCategories ---

  describe('fetchCategories', () => {
    it('sets categories on success', async () => {
      const cats = [createCategory({ id: 'c1' }), createCategory({ id: 'c2' })];
      mockCategoryApi.list.mockResolvedValue(cats);

      await getState().fetchCategories();

      expect(getState().categories).toEqual(cats);
    });

    it('calls toast.error on failure (does not throw)', async () => {
      mockCategoryApi.list.mockRejectedValue(new Error('Failed'));

      await getState().fetchCategories(); // should NOT throw

      expect(mockToast.error).toHaveBeenCalledWith('Failed to load categories');
    });
  });

  // --- createRepertoire ---

  describe('createRepertoire', () => {
    it('appends to repertoires array', async () => {
      const existing = createRepertoire({ id: 'r1' });
      useRepertoireStore.setState({ repertoires: [existing] });
      const created = createRepertoire({ id: 'r2' });
      mockRepertoireApi.create.mockResolvedValue(created);

      const result = await getState().createRepertoire('New', 'white');

      expect(getState().repertoires).toHaveLength(2);
      expect(getState().repertoires[1]).toEqual(created);
      expect(result).toEqual(created);
    });

    it('sets error and throws on failure', async () => {
      mockRepertoireApi.create.mockRejectedValue(new Error('Limit reached'));

      await expect(getState().createRepertoire('New', 'white')).rejects.toThrow();
      expect(getState().error).toEqual({ message: 'Failed to create repertoire' });
    });
  });

  // --- renameRepertoire ---

  describe('renameRepertoire', () => {
    it('updates name in repertoires array', async () => {
      const rep = createRepertoire({ id: 'r1', name: 'Old' });
      useRepertoireStore.setState({ repertoires: [rep] });
      const renamed = createRepertoire({ id: 'r1', name: 'New' });
      mockRepertoireApi.rename.mockResolvedValue(renamed);

      await getState().renameRepertoire('r1', 'New');

      expect(getState().repertoires[0].name).toBe('New');
    });
  });

  // --- updateDescription ---

  describe('updateDescription', () => {
    it('updates repertoire on success', async () => {
      const rep = createRepertoire({ id: 'r1', description: '' });
      useRepertoireStore.setState({ repertoires: [rep] });
      const updated = createRepertoire({ id: 'r1', description: 'New desc' });
      mockRepertoireApi.updateDescription.mockResolvedValue(updated);

      await getState().updateDescription('r1', 'New desc');

      expect(getState().repertoires[0].description).toBe('New desc');
    });

    it('calls toast.error and throws on failure', async () => {
      mockRepertoireApi.updateDescription.mockRejectedValue(new Error('Failed'));

      await expect(getState().updateDescription('r1', 'desc')).rejects.toThrow();
      expect(mockToast.error).toHaveBeenCalledWith('Failed to update description');
    });
  });

  // --- deleteRepertoire ---

  describe('deleteRepertoire', () => {
    it('removes from array', async () => {
      const reps = [createRepertoire({ id: 'r1' }), createRepertoire({ id: 'r2' })];
      useRepertoireStore.setState({ repertoires: reps });
      mockRepertoireApi.delete.mockResolvedValue(undefined);

      await getState().deleteRepertoire('r1');

      expect(getState().repertoires).toHaveLength(1);
      expect(getState().repertoires[0].id).toBe('r2');
    });

    it('clears selectedRepertoireId if it was the deleted one', async () => {
      useRepertoireStore.setState({
        repertoires: [createRepertoire({ id: 'r1' })],
        selectedRepertoireId: 'r1',
      });
      mockRepertoireApi.delete.mockResolvedValue(undefined);

      await getState().deleteRepertoire('r1');

      expect(getState().selectedRepertoireId).toBeNull();
    });

    it('preserves selectedRepertoireId if it was a different one', async () => {
      useRepertoireStore.setState({
        repertoires: [createRepertoire({ id: 'r1' }), createRepertoire({ id: 'r2' })],
        selectedRepertoireId: 'r2',
      });
      mockRepertoireApi.delete.mockResolvedValue(undefined);

      await getState().deleteRepertoire('r1');

      expect(getState().selectedRepertoireId).toBe('r2');
    });
  });

  // --- mergeRepertoires ---

  describe('mergeRepertoires', () => {
    it('removes source repertoires and adds merged result', async () => {
      const r1 = createRepertoire({ id: 'r1' });
      const r2 = createRepertoire({ id: 'r2' });
      const r3 = createRepertoire({ id: 'r3' });
      const merged = createRepertoire({ id: 'r-merged', name: 'Merged' });
      useRepertoireStore.setState({ repertoires: [r1, r2, r3] });
      mockRepertoireApi.mergeRepertoires.mockResolvedValue({ merged });

      const result = await getState().mergeRepertoires(['r1', 'r2'], 'Merged');

      expect(result).toEqual(merged);
      const ids = getState().repertoires.map((r) => r.id);
      expect(ids).not.toContain('r1');
      expect(ids).not.toContain('r2');
      expect(ids).toContain('r3');
      expect(ids).toContain('r-merged');
    });

    it('clears selectedRepertoireId if it was one of the merged', async () => {
      useRepertoireStore.setState({
        repertoires: [createRepertoire({ id: 'r1' }), createRepertoire({ id: 'r2' })],
        selectedRepertoireId: 'r1',
      });
      mockRepertoireApi.mergeRepertoires.mockResolvedValue({
        merged: createRepertoire({ id: 'r-merged' }),
      });

      await getState().mergeRepertoires(['r1', 'r2'], 'Merged');

      expect(getState().selectedRepertoireId).toBeNull();
    });
  });

  // --- assignRepertoireToCategory ---

  describe('assignRepertoireToCategory', () => {
    it('updates the repertoire in the array', async () => {
      const rep = createRepertoire({ id: 'r1', categoryId: null });
      const updated = createRepertoire({ id: 'r1', categoryId: 'c1' });
      useRepertoireStore.setState({ repertoires: [rep] });
      mockRepertoireApi.assignCategory.mockResolvedValue(updated);

      await getState().assignRepertoireToCategory('r1', 'c1');

      expect(getState().repertoires[0].categoryId).toBe('c1');
    });
  });

  // --- Category management ---

  describe('createCategory', () => {
    it('appends to categories and auto-expands', async () => {
      const cat = createCategory({ id: 'c1' });
      mockCategoryApi.create.mockResolvedValue(cat);

      const result = await getState().createCategory('Test Cat', 'white');

      expect(result).toEqual(cat);
      expect(getState().categories).toHaveLength(1);
      expect(getState().expandedCategories.has('c1')).toBe(true);
    });
  });

  describe('renameCategory', () => {
    it('updates category in array', async () => {
      const cat = createCategory({ id: 'c1', name: 'Old' });
      const renamed = createCategory({ id: 'c1', name: 'New' });
      useRepertoireStore.setState({ categories: [cat] });
      mockCategoryApi.rename.mockResolvedValue(renamed);

      await getState().renameCategory('c1', 'New');

      expect(getState().categories[0].name).toBe('New');
    });
  });

  describe('deleteCategory', () => {
    it('removes category and refetches repertoires', async () => {
      const cat = createCategory({ id: 'c1' });
      useRepertoireStore.setState({ categories: [cat], repertoires: [] });
      mockCategoryApi.delete.mockResolvedValue(undefined);
      mockRepertoireApi.list.mockResolvedValue([]); // refetch after delete

      await getState().deleteCategory('c1');

      expect(getState().categories).toHaveLength(0);
      // fetchRepertoires is called fire-and-forget after delete
      expect(mockRepertoireApi.list).toHaveBeenCalled();
    });
  });

  describe('toggleCategoryExpanded', () => {
    it('adds category to expanded set', () => {
      getState().toggleCategoryExpanded('c1');
      expect(getState().expandedCategories.has('c1')).toBe(true);
    });

    it('removes category from expanded set on second toggle', () => {
      getState().toggleCategoryExpanded('c1');
      getState().toggleCategoryExpanded('c1');
      expect(getState().expandedCategories.has('c1')).toBe(false);
    });
  });

  // --- Selection ---

  describe('selectRepertoire', () => {
    it('sets selectedRepertoireId', () => {
      getState().selectRepertoire('r1');
      expect(getState().selectedRepertoireId).toBe('r1');
    });

    it('resets selectedNodeId when selecting a different repertoire', () => {
      useRepertoireStore.setState({
        selectedRepertoireId: 'r1',
        selectedNodeId: 'node-1',
      });

      getState().selectRepertoire('r2');

      expect(getState().selectedRepertoireId).toBe('r2');
      expect(getState().selectedNodeId).toBeNull();
    });

    it('preserves selectedNodeId when selecting the same repertoire', () => {
      useRepertoireStore.setState({
        selectedRepertoireId: 'r1',
        selectedNodeId: 'node-1',
      });

      getState().selectRepertoire('r1');

      expect(getState().selectedNodeId).toBe('node-1');
    });

    it('handles null (deselect)', () => {
      useRepertoireStore.setState({ selectedRepertoireId: 'r1' });

      getState().selectRepertoire(null);

      expect(getState().selectedRepertoireId).toBeNull();
    });
  });

  describe('selectNode', () => {
    it('sets selectedNodeId', () => {
      getState().selectNode('node-1');
      expect(getState().selectedNodeId).toBe('node-1');
    });
  });

  // --- State management ---

  describe('updateRepertoire', () => {
    it('replaces repertoire in array by id', () => {
      const rep = createRepertoire({ id: 'r1', name: 'Old' });
      const updated = createRepertoire({ id: 'r1', name: 'Updated' });
      useRepertoireStore.setState({ repertoires: [rep] });

      getState().updateRepertoire(updated);

      expect(getState().repertoires[0].name).toBe('Updated');
    });
  });

  describe('addRepertoire', () => {
    it('appends to array', () => {
      const rep = createRepertoire({ id: 'r1' });
      getState().addRepertoire(rep);
      expect(getState().repertoires).toHaveLength(1);
    });
  });

  describe('removeRepertoire', () => {
    it('filters from array', () => {
      useRepertoireStore.setState({
        repertoires: [createRepertoire({ id: 'r1' }), createRepertoire({ id: 'r2' })],
      });

      getState().removeRepertoire('r1');

      expect(getState().repertoires).toHaveLength(1);
      expect(getState().repertoires[0].id).toBe('r2');
    });
  });

  describe('clearAll', () => {
    it('resets all state to defaults', () => {
      useRepertoireStore.setState({
        repertoires: [createRepertoire()],
        categories: [createCategory()],
        expandedCategories: new Set(['c1']),
        selectedRepertoireId: 'r1',
        selectedNodeId: 'n1',
        loading: true,
        error: { message: 'err' },
      });

      getState().clearAll();

      expect(getState().repertoires).toHaveLength(0);
      expect(getState().categories).toHaveLength(0);
      expect(getState().expandedCategories.size).toBe(0);
      expect(getState().selectedRepertoireId).toBeNull();
      expect(getState().selectedNodeId).toBeNull();
      expect(getState().loading).toBe(false);
      expect(getState().error).toBeNull();
    });
  });

  describe('setLoading / setError / clearError', () => {
    it('setLoading sets loading', () => {
      getState().setLoading(true);
      expect(getState().loading).toBe(true);
    });

    it('setError sets error', () => {
      getState().setError({ message: 'err' });
      expect(getState().error).toEqual({ message: 'err' });
    });

    it('clearError clears error', () => {
      useRepertoireStore.setState({ error: { message: 'err' } });
      getState().clearError();
      expect(getState().error).toBeNull();
    });
  });
});
