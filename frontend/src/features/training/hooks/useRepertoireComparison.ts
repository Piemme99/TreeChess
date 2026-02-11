import { useState, useEffect, useCallback } from 'react';
import { trainingApi } from '../../../services/api';
import type { MoveAnalysis, RepertoireRef } from '../../../types';
import type { MoveRecord } from './useExplorerTraining';

interface RepertoireComparison {
  matchedRepertoire: RepertoireRef | null;
  matchScore: number;
  moveAnalysis: MoveAnalysis[];
  loading: boolean;
  error: string | null;
}

/**
 * Calls the backend to compare explorer training moves against the user's repertoires.
 * Triggered when `enabled` is true (i.e. session is complete).
 */
export function useRepertoireComparison(
  moveHistory: MoveRecord[],
  userColor: 'w' | 'b',
  enabled: boolean,
): RepertoireComparison {
  const [matchedRepertoire, setMatchedRepertoire] = useState<RepertoireRef | null>(null);
  const [matchScore, setMatchScore] = useState(0);
  const [moveAnalysis, setMoveAnalysis] = useState<MoveAnalysis[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analyze = useCallback(async () => {
    if (moveHistory.length === 0) return;

    setLoading(true);
    setError(null);

    try {
      const moves = moveHistory.map(m => m.san);
      const color = userColor === 'w' ? 'white' as const : 'black' as const;
      const result = await trainingApi.analyze(moves, color);

      setMatchedRepertoire(result.matchedRepertoire);
      setMatchScore(result.matchScore);
      setMoveAnalysis(result.moves);
    } catch {
      setError('Failed to compare with repertoire');
    } finally {
      setLoading(false);
    }
  }, [moveHistory, userColor]);

  useEffect(() => {
    if (enabled) {
      analyze();
    }
  }, [enabled, analyze]);

  return {
    matchedRepertoire,
    matchScore,
    moveAnalysis,
    loading,
    error,
  };
}
