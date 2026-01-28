import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { importApi } from '../../services/api';
import { toast } from '../../stores/toastStore';
import { useAbortController, isAbortError } from './useAbortController';
import type { AnalysisDetail } from '../../types';

/**
 * Base hook for loading analysis data by ID from URL params.
 * Handles loading state, error handling, and request cancellation.
 */
export function useAnalysisBase() {
  const { id } = useParams<{ id: string }>();
  const [analysis, setAnalysis] = useState<AnalysisDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const { getSignal } = useAbortController();

  const loadAnalysis = useCallback(async () => {
    if (!id) return;

    const signal = getSignal();
    setLoading(true);
    
    try {
      const data = await importApi.get(id, { signal });
      if (!signal.aborted) {
        setAnalysis(data);
      }
    } catch (error) {
      if (!isAbortError(error)) {
        toast.error('Failed to load analysis');
      }
    } finally {
      if (!signal.aborted) {
        setLoading(false);
      }
    }
  }, [id, getSignal]);

  useEffect(() => {
    loadAnalysis();
  }, [loadAnalysis]);

  return { id, analysis, setAnalysis, loading, reload: loadAnalysis };
}
