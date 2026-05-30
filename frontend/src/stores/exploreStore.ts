import { create } from 'zustand';
import type { Repertoire, ExploreTemplate, ApiError } from '../types';
import { exploreApi } from '../services/api';
import { toast } from './toastStore';
import { useRepertoireStore } from './repertoireStore';
import { getApiErrorMessage } from '../shared/utils/apiError';

interface ExploreState {
  publicRepertoires: Repertoire[];
  starterTemplates: ExploreTemplate[];
  loading: boolean;
  error: ApiError | null;

  fetchPublicRepertoires: () => Promise<void>;
  fetchStarterTemplates: () => Promise<void>;
  importRepertoire: (id: string) => Promise<Repertoire>;
  importTemplate: (id: string) => Promise<Repertoire>;
}

export const useExploreStore = create<ExploreState>((set) => ({
  publicRepertoires: [],
  starterTemplates: [],
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

  fetchStarterTemplates: async () => {
    try {
      const templates = await exploreApi.listTemplates();
      set({ starterTemplates: templates });
    } catch {
      // Silently fail — starter templates are non-critical
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
      const message = getApiErrorMessage(err, 'Failed to import repertoire');
      toast.error(message);
      throw err;
    }
  },

  importTemplate: async (id: string) => {
    try {
      const imported = await exploreApi.importTemplate(id);
      useRepertoireStore.getState().addRepertoire(imported);
      toast.success('Repertoire imported successfully');
      return imported;
    } catch (err) {
      const message = getApiErrorMessage(err, 'Failed to import template');
      toast.error(message);
      throw err;
    }
  }
}));
