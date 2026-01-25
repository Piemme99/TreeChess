import { create } from 'zustand';
import type { EngineEvaluation, EngineState } from '../types';

interface EngineStoreState extends EngineState {
  setAnalyzing: (analyzing: boolean, fen?: string) => void;
  setEvaluation: (evaluation: EngineEvaluation) => void;
  setError: (error: string) => void;
  reset: () => void;
}

export const useEngineStore = create<EngineStoreState>((set) => ({
  isAnalyzing: false,
  currentEvaluation: null,
  currentFEN: '',
  error: null,

  setAnalyzing: (analyzing: boolean, fen?: string) => {
    set((state) => ({ 
      isAnalyzing: analyzing, 
      currentFEN: fen ?? state.currentFEN,
      error: null 
    }));
  },

  setEvaluation: (evaluation: EngineEvaluation) => {
    set({ currentEvaluation: evaluation, isAnalyzing: false });
  },

  setError: (error: string) => {
    set({ error, isAnalyzing: false });
  },

  reset: () => {
    set({
      isAnalyzing: false,
      currentEvaluation: null,
      currentFEN: '',
      error: null
    });
  }
}));
