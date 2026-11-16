import { useEffect, useState } from 'react';
import { explore, hasExplorer, type ExplorerResult } from '../line/explorer';

// Au-delà, on dit au joueur que l'explorateur ne répond pas plutôt que de le laisser attendre.
const TIMEOUT = 10_000;

export type ExplorerAnswer = ExplorerResult | 'missing' | 'failed' | undefined;

/** Ce que jouent les joueurs du niveau du joueur depuis une position ; `undefined` pendant la requête. */
export function useExplorerAt(fen: string): ExplorerAnswer {
  const [found, setFound] = useState<{ fen: string; result: ExplorerResult | 'failed' } | null>(null);
  useEffect(() => {
    if (!hasExplorer()) return;
    let live = true;
    const timer = setTimeout(() => live && setFound((known) => (known?.fen === fen ? known : { fen, result: 'failed' })), TIMEOUT);
    explore('lichess', fen).then((result) => live && setFound({ fen, result: result ?? 'failed' }));
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [fen]);
  if (!hasExplorer()) return 'missing';
  return found?.fen === fen ? found.result : undefined;
}
