import { useEffect, useState } from 'react';
import { explore, hasExplorer, type Database, type ExplorerResult } from '../line/explorer';

// Au-delà, on dit au joueur que l'explorateur ne répond pas plutôt que de le laisser attendre.
const TIMEOUT = 10_000;

export type ExplorerAnswer = ExplorerResult | 'missing' | 'failed' | undefined;

/** Ce que jouent les joueurs d'une base depuis une position ; `undefined` pendant la requête. */
export function useExplorerAt(fen: string, database: Database = 'lichess'): ExplorerAnswer {
  const key = `${database} ${fen}`;
  const [found, setFound] = useState<{ key: string; result: ExplorerResult | 'failed' } | null>(null);
  useEffect(() => {
    if (!hasExplorer()) return;
    let live = true;
    const timer = setTimeout(() => live && setFound((known) => (known?.key === key ? known : { key, result: 'failed' })), TIMEOUT);
    explore(database, fen).then((result) => live && setFound({ key, result: result ?? 'failed' }));
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [key, database, fen]);
  if (!hasExplorer()) return 'missing';
  return found?.key === key ? found.result : undefined;
}
