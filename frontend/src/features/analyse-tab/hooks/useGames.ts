import { useState, useEffect, useCallback } from 'react';
import { type GameSummary } from '../../../types';
import { gamesApi } from '../../../services/api';
import { toast } from '../../../stores/toastStore';
import { useAbortController, isAbortError } from '../../../shared/hooks';

const PAGE_SIZE = 20;

export function useGames(timeClass?: string, repertoire?: string, source?: string) {
  const [games, setGames] = useState<GameSummary[]>([]);
  const [total, setTotal] = useState(0);
  // Global count of "New" games (synced and not yet viewed) across all imports,
  // independent of the current page. The per-page split in GamesList only sees
  // this page's rows, so we fetch the true total separately to label the header.
  const [newTotal, setNewTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const { getSignal } = useAbortController();

  const loadGames = useCallback(async (newOffset = 0) => {
    const signal = getSignal();
    setLoading(true);
    try {
      // Minimal page size — we only need `.total`, not the rows. Note: listNew
      // does not forward the timeClass/repertoire/source filters, so this is the
      // unfiltered global New total.
      const [data, newData] = await Promise.all([
        gamesApi.list(PAGE_SIZE, newOffset, timeClass, repertoire, source, { signal }),
        gamesApi.listNew(1, 0, { signal })
      ]);
      if (!signal.aborted) {
        setGames(data.games || []);
        setTotal(data.total);
        setNewTotal(newData.total);
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

  const markGameViewed = useCallback((analysisId: string, gameIndex: number) => {
    setGames((prev) => prev.map((g) =>
      g.analysisId === analysisId && g.gameIndex === gameIndex
        ? { ...g, synced: false }
        : g
    ));
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
    newTotal,
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
