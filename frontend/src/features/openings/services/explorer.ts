// Explorateur Lichess : les parties au niveau du joueur et celles des maîtres. Lichess exige un jeton pour toutes
// ses bases : le backend relaie avec celui du compte Lichess connecté ; en dev, sans backend, un jeton personnel
// dans VITE_LICHESS_TOKEN (frontend/.env.local, ignoré par git) permet d'interroger Lichess directement.
import { useSyncExternalStore } from 'react';
import { api } from '../../../services/api';
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
const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) || '/api';
const SPEEDS = 'blitz,rapid';
const STRONG_SPEEDS = 'blitz,rapid,classical';
const STORAGE = 'kumquat-explorer:';
// Lichess demande d'attendre une minute pleine après un 429.
const RATE_LIMIT_PAUSE = 60_000;
const SPACING = 250;

export const hasExplorer = () => true;

let chain: Promise<unknown> = Promise.resolve();

function urlOf(database: Database, fen: string, ratings: readonly number[]) {
  const query = new URLSearchParams({ variant: 'standard', fen, moves: '8' });
  if (database === 'masters') {
    query.set('topGames', '4');
  } else {
    query.set('speeds', database === 'strong' ? STRONG_SPEEDS : SPEEDS);
    query.set('ratings', ratings.join(','));
    query.set('topGames', '0');
    query.set('recentGames', '0');
  }
  const path = database === 'masters' ? 'masters' : 'lichess';
  return TOKEN ? `https://explorer.lichess.ovh/${path}?${query}` : `/explorer/${path}?${query}`;
}

/** Où se connecter avec Lichess, pour revenir ensuite sur la page en cours. */
export function lichessSignInUrl() {
  return `${API_BASE}/auth/lichess/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`;
}

let signInNeeded = false;
const listeners = new Set<() => void>();

/** Le relais n'a pas la position en cache et il faut un compte Lichess connecté pour la demander. */
export function useExplorerSignIn(): boolean {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => signInNeeded,
  );
}

interface Reply {
  status: number;
  data?: unknown;
}

function send(url: string): Promise<Reply | null> {
  if (TOKEN) {
    return fetch(url, { headers: { Authorization: `Bearer ${TOKEN}` } }).then(
      async (response) => ({ status: response.status, data: response.ok ? await response.json() : undefined }),
      () => null,
    );
  }
  // Le client de l'API joint la session et rafraîchit le jeton d'accès s'il a expiré.
  return api.get(url).then(
    (response) => ({ status: response.status, data: response.data }),
    (error: { response?: { status: number; data?: unknown } }) => (error.response ? { status: error.response.status, data: error.response.data } : null),
  );
}

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Une requête à la fois, comme Lichess le demande ; le cache local évite de refaire l'arbre à chaque rechargement.
export function explore(database: Database, fen: string, ratings: readonly number[]): Promise<ExplorerResult | null> {
  const url = urlOf(database, fen, ratings);
  const stored = localStorage.getItem(STORAGE + url);
  if (stored) return Promise.resolve(JSON.parse(stored) as ExplorerResult);

  const run = async (): Promise<ExplorerResult | null> => {
    for (let attempt = 0; attempt < 2; attempt++) {
      // Un réseau coupé ou un refus CORS rejette la requête : sans ce filet, l'appelant attendrait pour toujours.
      const reply = await send(url).catch(() => null);
      if (!reply) return null;
      if (reply.status === 429) {
        await pause(RATE_LIMIT_PAUSE);
        continue;
      }
      if (reply.status === 403 && /^lichess_/.test((reply.data as { code?: string } | undefined)?.code ?? '')) {
        signInNeeded = true;
        listeners.forEach((listener) => listener());
        return null;
      }
      if (reply.status !== 200 || !reply.data) return null;
      const result = reply.data as ExplorerResult;
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
