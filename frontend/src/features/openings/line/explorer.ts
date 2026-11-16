// Explorateur Lichess : les parties au niveau du joueur et celles des maîtres. Un jeton personnel
// facultatif dans VITE_LICHESS_TOKEN (frontend/.env.local, ignoré par git), en attendant l'OAuth du backend.
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

/** `lichess` : le niveau du joueur ; `strong` : les forts joueurs de Lichess, pour choisir ses propres coups. */
export type Database = 'lichess' | 'strong' | 'masters';

const TOKEN = import.meta.env.VITE_LICHESS_TOKEN as string | undefined;
// Les adversaires contre qui se préparer, un peu au-dessus du joueur (près de 1800, PMG le 16/11/2026) : il voulait
// 1700–2100, l'explorateur ne connaît que des tranches de 200 points (1600 = 1600–1799).
const RATINGS = '1600,1800,2000';
const SPEEDS = 'blitz,rapid';
// Des joueurs forts, mais assez nombreux pour couvrir les lignes d'amateur où la base des maîtres n'a que quelques parties.
const STRONG_RATINGS = '2200,2500';
const STRONG_SPEEDS = 'blitz,rapid,classical';
/** La tranche interrogée, telle qu'on la nomme à l'écran. */
export const LEVEL_LABEL = '1600–2200 · blitz & rapid · Lichess';
const STORAGE = 'kumquat-explorer:';
// Lichess demande d'attendre une minute pleine après un 429.
const RATE_LIMIT_PAUSE = 60_000;
const SPACING = 250;

export const hasExplorer = () => true;

let chain: Promise<unknown> = Promise.resolve();

function urlOf(database: Database, fen: string) {
  const query = new URLSearchParams({ variant: 'standard', fen, moves: '8' });
  if (database === 'masters') {
    query.set('topGames', '4');
  } else {
    query.set('speeds', database === 'strong' ? STRONG_SPEEDS : SPEEDS);
    query.set('ratings', database === 'strong' ? STRONG_RATINGS : RATINGS);
    query.set('topGames', '0');
    query.set('recentGames', '0');
  }
  return `https://explorer.lichess.ovh/${database === 'masters' ? 'masters' : 'lichess'}?${query}`;
}

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Une requête à la fois, comme Lichess le demande ; le cache local évite de refaire l'arbre à chaque rechargement.
export function explore(database: Database, fen: string): Promise<ExplorerResult | null> {
  const url = urlOf(database, fen);
  const stored = localStorage.getItem(STORAGE + url);
  if (stored) return Promise.resolve(JSON.parse(stored) as ExplorerResult);

  const run = async (): Promise<ExplorerResult | null> => {
    for (let attempt = 0; attempt < 2; attempt++) {
      // Depuis novembre 2026, l'explorateur répond sans jeton mais son CORS refuse l'en-tête Authorization :
      // le jeton ne sert plus qu'en second essai, si Lichess le redemande.
      let response = await fetch(url).catch(() => null);
      if (response?.status === 401 && TOKEN) response = await fetch(url, { headers: { Authorization: `Bearer ${TOKEN}` } }).catch(() => null);
      // Un réseau coupé ou un refus CORS rejette le fetch : sans ce filet, l'appelant attendrait pour toujours.
      if (!response) return null;
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
