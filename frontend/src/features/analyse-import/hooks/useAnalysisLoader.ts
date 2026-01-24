import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { importApi } from '../../../services/api';
import { toast } from '../../../stores/toastStore';
import type { AnalysisDetail } from '../../../types';

export function useAnalysisLoader() {
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

  return { analysis, loading };
}