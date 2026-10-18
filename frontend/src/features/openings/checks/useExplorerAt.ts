import { useEffect, useState } from 'react';
import { explore, hasExplorer, type ExplorerResult } from '../line/explorer';

/** Ce que jouent les joueurs du niveau du joueur depuis une position ; `undefined` pendant la requête. */
export function useExplorerAt(fen: string): ExplorerResult | null | undefined {
  const [found, setFound] = useState<{ fen: string; result: ExplorerResult | null } | null>(null);
  useEffect(() => {
    if (!hasExplorer()) return;
    let live = true;
    explore('lichess', fen).then((result) => live && setFound({ fen, result }));
    return () => {
      live = false;
    };
  }, [fen]);
  if (!hasExplorer()) return null;
  return found?.fen === fen ? found.result : undefined;
}
