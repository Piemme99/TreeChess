// Explorateur Lichess : les parties au niveau du joueur et celles des maîtres. Il exige un jeton :
// en attendant de passer par l'OAuth du backend (brique import), un jeton personnel dans
// VITE_LICHESS_TOKEN (frontend/.env.local, ignoré par git).
import type { ExplorerStats } from '../domain/preparation';

export interface ExplorerGame {
  id: string;
  white: { name: string };
  black: { name: string };
  year: number;
  winner: 'white' | 'black' | null;
}

export interface ExplorerResult extends ExplorerStats {
  topGames?: ExplorerGame[];
}

export type Database = 'lichess' | 'masters';

const TOKEN = import.meta.env.VITE_LICHESS_TOKEN as string | undefined;
// Tranches de l'explorateur autour du joueur (Lichess : 1594 blitz, 1698 rapide le 18/10/2026).
const RATINGS = '1400,1600,1800';
const SPEEDS = 'blitz,rapid';
/** La tranche interrogée, telle qu'on la nomme à l'écran. */
export const LEVEL_LABEL = '1400–1800 · blitz & rapid · Lichess';
const STORAGE = 'kumquat-explorer:';
// Lichess demande d'attendre une minute pleine après un 429.
const RATE_LIMIT_PAUSE = 60_000;
const SPACING = 250;

export const hasExplorer = () => Boolean(TOKEN);

let chain: Promise<unknown> = Promise.resolve();

function urlOf(database: Database, fen: string) {
  const query = new URLSearchParams({ variant: 'standard', fen, moves: '8' });
  if (database === 'lichess') {
    query.set('speeds', SPEEDS);
    query.set('ratings', RATINGS);
    query.set('topGames', '0');
    query.set('recentGames', '0');
  } else {
    query.set('topGames', '4');
  }
  return `https://explorer.lichess.ovh/${database}?${query}`;
}

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Une requête à la fois, comme Lichess le demande ; le cache local évite de refaire l'arbre à chaque rechargement.
export function explore(database: Database, fen: string): Promise<ExplorerResult | null> {
  if (!TOKEN) return Promise.resolve(null);
  const url = urlOf(database, fen);
  const stored = localStorage.getItem(STORAGE + url);
  if (stored) return Promise.resolve(JSON.parse(stored) as ExplorerResult);

  const run = async (): Promise<ExplorerResult | null> => {
    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await fetch(url, { headers: { Authorization: `Bearer ${TOKEN}` } });
      if (response.status === 429) {
        await pause(RATE_LIMIT_PAUSE);
        continue;
      }
      if (!response.ok) return null;
      const result = (await response.json()) as ExplorerResult;
      localStorage.setItem(STORAGE + url, JSON.stringify(result));
      await pause(SPACING);
      return result;
    }
    return null;
  };
  const next = chain.then(run, run);
  chain = next.catch(() => null);
  return next;
}
