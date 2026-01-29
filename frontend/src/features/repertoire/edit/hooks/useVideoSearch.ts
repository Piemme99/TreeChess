import { useState, useCallback } from 'react';
import { videoApi } from '../../../../services/api';
import type { VideoSearchResult } from '../../../../types';

export function useVideoSearch() {
  const [results, setResults] = useState<VideoSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const search = useCallback(async (fen: string) => {
    if (!fen) return;

    setLoading(true);
    setSearched(true);

    try {
      const data = await videoApi.searchByFEN(fen);
      setResults(data);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setResults([]);
    setSearched(false);
  }, []);

  return { results, loading, searched, search, reset };
}
