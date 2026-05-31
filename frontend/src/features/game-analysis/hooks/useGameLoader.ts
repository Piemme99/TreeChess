import { useCallback } from 'react';
import { gamesApi } from '../../../services/api';
import { toast } from '../../../stores/toastStore';
import { useAnalysisBase } from '../../../shared/hooks';
import { getApiErrorMessage } from '../../../shared/utils/apiError';
import type { GameAnalysis } from '../../../types';

/**
 * Hook for loading and managing game analysis data.
 * Extends useAnalysisBase with game-specific functionality (reanalyze).
 */
export function useGameLoader() {
  const { id, analysis, setAnalysis, loading, reload } = useAnalysisBase();

  // Update a specific game in the analysis, located by gameIndex. Accepts either
  // a replacement game or an updater that derives the new game from the current
  // one — the functional form lets callers patch in place without closing over a
  // possibly-stale snapshot of the game.
  const updateGame = useCallback(
    (gameIndex: number, update: GameAnalysis | ((prev: GameAnalysis) => GameAnalysis)) => {
      setAnalysis(prev => {
        if (!prev) return prev;
        const newResults = [...prev.results];
        const idx = newResults.findIndex(g => g.gameIndex === gameIndex);
        if (idx !== -1) {
          newResults[idx] = typeof update === 'function' ? update(newResults[idx]) : update;
        }
        return { ...prev, results: newResults };
      });
    },
    [setAnalysis]
  );

  // Reanalyze a game against a different repertoire
  const reanalyzeGame = useCallback(async (gameIndex: number, repertoireId: string): Promise<boolean> => {
    if (!id) return false;

    try {
      const reanalyzed = await gamesApi.reanalyze(id, gameIndex, repertoireId);
      updateGame(gameIndex, reanalyzed);
      toast.success('Game reanalyzed successfully');
      return true;
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Failed to reanalyze game'));
      return false;
    }
  }, [id, updateGame]);

  return { id, analysis, loading, reanalyzeGame, updateGame, reload };
}
