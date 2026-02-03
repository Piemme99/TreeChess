import { useEffect, useMemo, useCallback } from 'react';
import { useRepertoireStore } from '../../../../stores/repertoireStore';
import { toast } from '../../../../stores/toastStore';

export function useRepertoires() {
  const repertoires = useRepertoireStore((state) => state.repertoires);
  const categories = useRepertoireStore((state) => state.categories);
  const loading = useRepertoireStore((state) => state.loading);
  const fetchRepertoires = useRepertoireStore((state) => state.fetchRepertoires);
  const fetchCategories = useRepertoireStore((state) => state.fetchCategories);

  useEffect(() => {
    const loadData = async () => {
      if (repertoires.length > 0 && categories.length > 0) return;

      try {
        await Promise.all([
          repertoires.length === 0 ? fetchRepertoires() : Promise.resolve(),
          categories.length === 0 ? fetchCategories() : Promise.resolve()
        ]);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load data';
        toast.error(message);
      }
    };

    loadData();
  }, [repertoires.length, categories.length, fetchRepertoires, fetchCategories]);

  // Use useMemo to avoid creating new arrays on every render
  const whiteRepertoires = useMemo(
    () => repertoires.filter((r) => r.color === 'white'),
    [repertoires]
  );

  const blackRepertoires = useMemo(
    () => repertoires.filter((r) => r.color === 'black'),
    [repertoires]
  );

  const whiteCategories = useMemo(
    () => categories.filter((c) => c.color === 'white'),
    [categories]
  );

  const blackCategories = useMemo(
    () => categories.filter((c) => c.color === 'black'),
    [categories]
  );

  const refresh = useCallback(async () => {
    await Promise.all([fetchRepertoires(), fetchCategories()]);
  }, [fetchRepertoires, fetchCategories]);

  return {
    repertoires,
    categories,
    whiteRepertoires,
    blackRepertoires,
    whiteCategories,
    blackCategories,
    loading,
    refresh
  };
}
