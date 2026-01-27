import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { importApi, gamesApi } from '../../../services/api';
import { toast } from '../../../stores/toastStore';
import type { AnalysisDetail, GameAnalysis } from '../../../types';

export function useGameLoader() {
  const { id } = useParams<{ id: string }>();
  const [analysis, setAnalysis] = useState<AnalysisDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const loadAnalysis = useCallback(async () => {
    if (!id) return;

    try {
      const data = await importApi.get(id);
      setAnalysis(data);
    } catch {
      toast.error('Failed to load analysis');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadAnalysis();
  }, [loadAnalysis]);

  // Update a specific game in the analysis (used after reanalysis)
  const updateGame = useCallback((gameIndex: number, updatedGame: GameAnalysis) => {
    setAnalysis(prev => {
      if (!prev) return prev;
      const newResults = [...prev.results];
      const idx = newResults.findIndex(g => g.gameIndex === gameIndex);
      if (idx !== -1) {
        newResults[idx] = updatedGame;
      }
      return { ...prev, results: newResults };
    });
  }, []);

  // Reanalyze a game against a different repertoire
  const reanalyzeGame = useCallback(async (gameIndex: number, repertoireId: string): Promise<boolean> => {
    if (!id) return false;

    try {
      const reanalyzed = await gamesApi.reanalyze(id, gameIndex, repertoireId);
      updateGame(gameIndex, reanalyzed);
      toast.success('Game reanalyzed successfully');
      return true;
    } catch (error) {
      const axiosError = error as { response?: { data?: { error?: string } } };
      const message = axiosError.response?.data?.error || 'Failed to reanalyze game';
      toast.error(message);
      return false;
    }
  }, [id, updateGame]);

  return { analysis, loading, reanalyzeGame };
}