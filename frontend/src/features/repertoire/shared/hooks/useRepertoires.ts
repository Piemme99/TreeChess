import { useEffect, useMemo } from 'react';
import { useRepertoireStore } from '../../../../stores/repertoireStore';
import { toast } from '../../../../stores/toastStore';

export function useRepertoires() {
  const repertoires = useRepertoireStore((state) => state.repertoires);
  const loading = useRepertoireStore((state) => state.loading);
  const fetchRepertoires = useRepertoireStore((state) => state.fetchRepertoires);

  useEffect(() => {
    const loadRepertoires = async () => {
      if (repertoires.length > 0) return;

      try {
        await fetchRepertoires();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load repertoires';
        toast.error(message);
      }
    };

    loadRepertoires();
  }, [repertoires.length, fetchRepertoires]);

  // Use useMemo to avoid creating new arrays on every render
  const whiteRepertoires = useMemo(
    () => repertoires.filter((r) => r.color === 'white'),
    [repertoires]
  );

  const blackRepertoires = useMemo(
    () => repertoires.filter((r) => r.color === 'black'),
    [repertoires]
  );

  return {
    repertoires,
    whiteRepertoires,
    blackRepertoires,
    loading
  };
}
