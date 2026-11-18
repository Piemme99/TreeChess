import { useEffect, useState } from 'react';
import { useExplorerLevel } from '../source/useExplorerLevel';
import { explore, hasExplorer, useExplorerSignIn, type Database, type ExplorerResult } from '../line/explorer';

// Au-delà, on dit au joueur que l'explorateur ne répond pas plutôt que de le laisser attendre.
const TIMEOUT = 10_000;
const NO_RATINGS: number[] = [];

export type ExplorerAnswer = ExplorerResult | 'missing' | 'failed' | 'sign-in' | undefined;

/** Ce que jouent les joueurs d'une base depuis une position ; `undefined` pendant la requête. */
export function useExplorerAt(fen: string, database: Database = 'lichess'): ExplorerAnswer {
  const level = useExplorerLevel();
  const ratings = database === 'masters' ? NO_RATINGS : database === 'strong' ? level.strong : level.opponents;
  const key = `${database} ${ratings.join(',')} ${fen}`;
  const [found, setFound] = useState<{ key: string; result: ExplorerResult | 'failed' } | null>(null);
  const signIn = useExplorerSignIn();
  useEffect(() => {
    if (!hasExplorer()) return;
    let live = true;
    const timer = setTimeout(() => live && setFound((known) => (known?.key === key ? known : { key, result: 'failed' })), TIMEOUT);
    explore(database, fen, ratings).then((result) => live && setFound({ key, result: result ?? 'failed' }));
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [key, database, fen, ratings]);
  if (!hasExplorer()) return 'missing';
  if (found?.key !== key) return undefined;
  return found.result === 'failed' && signIn ? 'sign-in' : found.result;
}
