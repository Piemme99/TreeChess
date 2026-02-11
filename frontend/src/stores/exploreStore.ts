import { create } from 'zustand';
import type { Repertoire, ApiError } from '../types';
import { exploreApi } from '../services/api';
import { toast } from './toastStore';
import { useRepertoireStore } from './repertoireStore';

interface ExploreState {
  publicRepertoires: Repertoire[];
  loading: boolean;
  error: ApiError | null;

  fetchPublicRepertoires: () => Promise<void>;
  importRepertoire: (id: string) => Promise<Repertoire>;
}

export const useExploreStore = create<ExploreState>((set) => ({
  publicRepertoires: [],
  loading: false,
  error: null,

  fetchPublicRepertoires: async () => {
    set({ loading: true, error: null });
    try {
      const repertoires = await exploreApi.listPublic();
      set({ publicRepertoires: repertoires, loading: false });
    } catch {
      set({
        error: { message: 'Failed to fetch public repertoires' },
        loading: false
      });
    }
  },

  importRepertoire: async (id: string) => {
    try {
      const imported = await exploreApi.importRepertoire(id);
      // Add to the user's repertoire store
      useRepertoireStore.getState().addRepertoire(imported);
      toast.success('Repertoire imported successfully');
      return imported;
    } catch (err) {
      const message = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
        || 'Failed to import repertoire';
      toast.error(message);
      throw err;
    }
  }
}));
