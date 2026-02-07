import { useState, useEffect, useCallback } from 'react';
import type { DashboardStatsResponse } from '../../../types';
import { dashboardApi } from '../../../services/api';

export function useDashboardStats() {
  const [stats, setStats] = useState<DashboardStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback((signal?: AbortSignal) => {
    return dashboardApi.stats({ signal })
      .then((data) => {
        setStats(data);
        setError(null);
        return data;
      })
      .catch((err) => {
        if (err.code !== 'ERR_CANCELED') {
          setError('Failed to load dashboard stats');
        }
        return null;
      });
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    fetchStats(controller.signal).finally(() => setLoading(false));
    return () => controller.abort();
  }, [fetchStats]);

  const refresh = useCallback(() => {
    setLoading(true);
    fetchStats().finally(() => setLoading(false));
  }, [fetchStats]);

  return { stats, loading, error, refresh };
}
