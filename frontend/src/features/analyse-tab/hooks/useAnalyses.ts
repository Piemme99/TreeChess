import { useState, useEffect, useCallback } from 'react';
import { type AnalysisSummary } from '../../../types';
import { importApi } from '../../../services/api';
import { toast } from '../../../stores/toastStore';
import { useAbortController, isAbortError } from '../../../shared/hooks';

export function useAnalyses() {
  const [analyses, setAnalyses] = useState<AnalysisSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const { getSignal } = useAbortController();

  const loadAnalyses = useCallback(async () => {
    const signal = getSignal();
    try {
      const data = await importApi.list({ signal });
      if (!signal.aborted) {
        setAnalyses(data || []);
      }
    } catch (error) {
      if (!isAbortError(error)) {
        toast.error('Failed to load analyses');
      }
    } finally {
      if (!signal.aborted) {
        setLoading(false);
      }
    }
  }, [getSignal]);

  useEffect(() => {
    loadAnalyses();
  }, [loadAnalyses]);

  const deleteAnalysis = useCallback((id: string) => {
    setAnalyses((prev) => prev.filter((a) => a.id !== id));
  }, []);

  return { analyses, loading, deleteAnalysis };
}
