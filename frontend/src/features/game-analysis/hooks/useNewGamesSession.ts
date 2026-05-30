import { useEffect, useState } from 'react';
import { gamesApi } from '../../../services/api';
import { useAbortController, isAbortError } from '../../../shared/hooks';
import type { GameSummary } from '../../../types';

const PAGE_SIZE = 100;

/**
 * Loads every "New" game (synced and not yet viewed) across all imports, in the
 * order the Games tab shows them. This is the ordered list the analyse-session
 * steps through. Fetched once per mount; the list is a stable snapshot so
 * stepping between games (or marking some viewed) does not shift it underfoot.
 */
export function useNewGamesSession() {
  const [sessionGames, setSessionGames] = useState<GameSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const { getSignal } = useAbortController();

  useEffect(() => {
    const signal = getSignal();

    (async () => {
      try {
        const collected: GameSummary[] = [];
        let offset = 0;
        for (;;) {
          const res = await gamesApi.listNew(PAGE_SIZE, offset, { signal });
          collected.push(...res.games);
          if (res.games.length === 0 || collected.length >= res.total) break;
          offset += PAGE_SIZE;
        }
        if (!signal.aborted) setSessionGames(collected);
      } catch (error) {
        // Non-critical: if the list can't load the session nav simply won't show.
        if (!isAbortError(error)) setSessionGames([]);
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    })();
  }, [getSignal]);

  return { sessionGames, loading };
}
