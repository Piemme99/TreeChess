import { useState, useEffect, useCallback } from 'react';
import { type AnalysisSummary } from '../../../types';
import { importApi } from '../../../services/api';
import { toast } from '../../../stores/toastStore';

export function useAnalyses() {
  const [analyses, setAnalyses] = useState<AnalysisSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const loadAnalyses = useCallback(async () => {
    try {
      const data = await importApi.list();
      setAnalyses(data || []);
    } catch {
      toast.error('Failed to load analyses');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAnalyses();
  }, [loadAnalyses]);

  const deleteAnalysis = useCallback((id: string) => {
    setAnalyses((prev) => prev.filter((a) => a.id !== id));
  }, []);

  return { analyses, loading, deleteAnalysis };
}