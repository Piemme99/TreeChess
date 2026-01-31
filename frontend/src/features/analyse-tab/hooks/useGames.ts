import { useState, useEffect, useCallback } from 'react';
import { type GameSummary } from '../../../types';
import { gamesApi } from '../../../services/api';
import { toast } from '../../../stores/toastStore';
import { useAbortController, isAbortError } from '../../../shared/hooks';

const PAGE_SIZE = 20;

export function useGames(timeClass?: string, repertoire?: string, source?: string) {
  const [games, setGames] = useState<GameSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const { getSignal } = useAbortController();

  const loadGames = useCallback(async (newOffset = 0) => {
    const signal = getSignal();
    setLoading(true);
    try {
      const data = await gamesApi.list(PAGE_SIZE, newOffset, timeClass, repertoire, source, { signal });
      if (!signal.aborted) {
        setGames(data.games || []);
        setTotal(data.total);
        setOffset(newOffset);
      }
    } catch (error) {
      if (!isAbortError(error)) {
        toast.error('Failed to load games');
      }
    } finally {
      if (!signal.aborted) {
        setLoading(false);
      }
    }
  }, [getSignal, timeClass, repertoire, source]);

  useEffect(() => {
    loadGames(0);
  }, [loadGames]);

  const deleteGame = useCallback((analysisId: string, gameIndex: number) => {
    setGames((prev) => prev.filter(
      (g) => !(g.analysisId === analysisId && g.gameIndex === gameIndex)
    ));
    setTotal((prev) => prev - 1);
  }, []);

  const markGameViewed = useCallback((analysisId: string, gameIndex: number) => {
    setGames((prev) => prev.map((g) =>
      g.analysisId === analysisId && g.gameIndex === gameIndex
        ? { ...g, synced: false }
        : g
    ));
  }, []);

  const deleteGames = useCallback((items: { analysisId: string; gameIndex: number }[]) => {
    const keys = new Set(items.map((g) => `${g.analysisId}-${g.gameIndex}`));
    setGames((prev) => prev.filter((g) => !keys.has(`${g.analysisId}-${g.gameIndex}`)));
    setTotal((prev) => prev - items.length);
  }, []);

  const nextPage = useCallback(() => {
    const newOffset = offset + PAGE_SIZE;
    if (newOffset < total) {
      loadGames(newOffset);
    }
  }, [offset, total, loadGames]);

  const prevPage = useCallback(() => {
    const newOffset = Math.max(0, offset - PAGE_SIZE);
    if (newOffset !== offset) {
      loadGames(newOffset);
    }
  }, [offset, loadGames]);

  const hasNextPage = offset + PAGE_SIZE < total;
  const hasPrevPage = offset > 0;
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return {
    games,
    loading,
    total,
    deleteGame,
    deleteGames,
    markGameViewed,
    nextPage,
    prevPage,
    hasNextPage,
    hasPrevPage,
    currentPage,
    totalPages,
    refresh: () => loadGames(offset)
  };
}
