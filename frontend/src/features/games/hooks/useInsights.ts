import { useState, useEffect, useRef, useCallback } from 'react';
import type { InsightsResponse } from '../../../types';
import { gamesApi } from '../../../services/api';

const POLL_INTERVAL = 5000;

export function useInsights() {
  const [insights, setInsights] = useState<InsightsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchInsights = useCallback((signal?: AbortSignal) => {
    return gamesApi.insights({ signal })
      .then((data) => {
        setInsights(data);
        setError(null);
        return data;
      })
      .catch((err) => {
        if (err.code !== 'ERR_CANCELED') {
          setError('Failed to load insights');
        }
        return null;
      });
  }, []);

  // Initial fetch
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    fetchInsights(controller.signal).finally(() => setLoading(false));
    return () => controller.abort();
  }, [fetchInsights]);

  // Auto-poll while analysis is in progress
  useEffect(() => {
    if (insights && !insights.engineAnalysisDone) {
      intervalRef.current = setInterval(() => {
        fetchInsights();
      }, POLL_INTERVAL);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [insights?.engineAnalysisDone, fetchInsights]);

  const refresh = useCallback(() => {
    setLoading(true);
    fetchInsights().finally(() => setLoading(false));
  }, [fetchInsights]);

  return { insights, loading, error, refresh };
}
