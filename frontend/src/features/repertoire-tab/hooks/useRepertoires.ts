import { useEffect } from 'react';
import { useRepertoireStore } from '../../../stores/repertoireStore';
import { repertoireApi } from '../../../services/api';
import { toast } from '../../../stores/toastStore';

export function useRepertoires() {
  const {
    whiteRepertoire,
    blackRepertoire,
    loading,
    setRepertoire,
    setLoading
  } = useRepertoireStore();

  useEffect(() => {
    const loadRepertoires = async () => {
      if (whiteRepertoire && blackRepertoire) return;

      setLoading(true);
      try {
        const [white, black] = await Promise.all([
          repertoireApi.get('white'),
          repertoireApi.get('black')
        ]);
        setRepertoire('white', white);
        setRepertoire('black', black);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load repertoires';
        toast.error(message);
      } finally {
        setLoading(false);
      }
    };

    loadRepertoires();
  }, [whiteRepertoire, blackRepertoire, setRepertoire, setLoading]);

  return { whiteRepertoire, blackRepertoire, loading };
}