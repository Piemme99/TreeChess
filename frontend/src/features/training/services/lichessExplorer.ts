// Opening Explorer client. Calls the backend proxy at /api/training/opening.
// The backend gates the upstream Lichess Explorer call behind the requesting
// user's Lichess OAuth token and a shared Postgres cache; this client just
// forwards the FEN, parses the response, and translates structured backend
// errors into typed ExplorerError values for the Training UI to branch on.

import { trainingApi } from '../../../services/api';

const MIN_GAMES_THRESHOLD = 100;
const MAX_CACHE_SIZE = 5000;

export interface ExplorerMove {
  uci: string;
  san: string;
  white: number;
  draws: number;
  black: number;
  averageRating: number;
}

export interface ExplorerResponse {
  white: number;
  draws: number;
  black: number;
  moves: ExplorerMove[];
}

export type ExplorerErrorCode =
  | 'rate_limited'
  | 'upstream_unavailable'
  | 'lichess_not_linked'
  | 'lichess_token_invalid'
  | 'invalid_fen'
  | 'network_error'
  | 'unknown';

export class ExplorerError extends Error {
  code: ExplorerErrorCode;
  status?: number;
  retryAfterSeconds?: number;

  constructor(code: ExplorerErrorCode, message: string, status?: number, retryAfterSeconds?: number) {
    super(message);
    this.name = 'ExplorerError';
    this.code = code;
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

// LRU cache: Map iteration order = insertion order, so we evict oldest.
const cache = new Map<string, ExplorerResponse>();

function cacheGet(key: string): ExplorerResponse | undefined {
  const value = cache.get(key);
  if (value !== undefined) {
    cache.delete(key);
    cache.set(key, value);
  }
  return value;
}

function cacheSet(key: string, value: ExplorerResponse): void {
  if (cache.has(key)) cache.delete(key);
  cache.set(key, value);
  if (cache.size > MAX_CACHE_SIZE) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
}

// Test seam — production code does not need to clear the cache.
export function resetExplorerCacheForTests(): void {
  cache.clear();
}

interface ApiErrorShape {
  response?: {
    status?: number;
    data?: {
      code?: string;
      error?: string;
      retryAfterSeconds?: number;
    };
  };
}

function toExplorerError(err: unknown): ExplorerError {
  const e = err as ApiErrorShape;
  const status = e.response?.status;
  const data = e.response?.data;

  // No response at all → transport-level failure (CORS, DNS, offline, ...).
  if (status === undefined) {
    return new ExplorerError('network_error', 'Could not reach the server. Check your connection.');
  }

  const code = (data?.code as ExplorerErrorCode | undefined) ?? 'unknown';
  const message = data?.error ?? `Opening data unavailable (HTTP ${status}).`;

  switch (code) {
    case 'lichess_not_linked':
    case 'lichess_token_invalid':
    case 'rate_limited':
    case 'upstream_unavailable':
    case 'invalid_fen':
      return new ExplorerError(code, message, status, data?.retryAfterSeconds);
    default:
      return new ExplorerError('unknown', message, status);
  }
}

export async function fetchExplorerData(fen: string): Promise<ExplorerResponse> {
  const cached = cacheGet(fen);
  if (cached) return cached;

  try {
    const data = await trainingApi.opening(fen);
    cacheSet(fen, data);
    return data;
  } catch (err) {
    throw toExplorerError(err);
  }
}

function totalGames(move: ExplorerMove): number {
  return move.white + move.draws + move.black;
}

export function getMostPopularMove(response: ExplorerResponse): ExplorerMove | null {
  if (response.moves.length === 0) return null;
  return response.moves.reduce((best, m) => (totalGames(m) > totalGames(best) ? m : best));
}

/**
 * Select a random opponent move weighted by number of games played.
 */
export function getWeightedRandomMove(response: ExplorerResponse): ExplorerMove | null {
  if (response.moves.length === 0) return null;
  if (response.moves.length === 1) return response.moves[0];

  const totalWeight = response.moves.reduce((sum, m) => sum + totalGames(m), 0);
  if (totalWeight === 0) return response.moves[0];

  let roll = Math.random() * totalWeight;
  for (const move of response.moves) {
    roll -= totalGames(move);
    if (roll <= 0) return move;
  }
  return response.moves[response.moves.length - 1];
}

export function getMovePopularity(response: ExplorerResponse, san: string): number | null {
  const total = response.white + response.draws + response.black;
  if (total === 0) return null;

  const move = response.moves.find((m) => m.san === san);
  if (!move) return null;

  return (totalGames(move) / total) * 100;
}

export function getMoveWinRate(response: ExplorerResponse, san: string, userColor: 'w' | 'b'): number | null {
  const move = response.moves.find((m) => m.san === san);
  if (!move) return null;
  const total = totalGames(move);
  if (total === 0) return null;
  if (userColor === 'w') {
    return ((move.white + move.draws * 0.5) / total) * 100;
  }
  return ((move.black + move.draws * 0.5) / total) * 100;
}

export function getBestMoveWinRate(response: ExplorerResponse, userColor: 'w' | 'b'): number | null {
  if (response.moves.length === 0) return null;
  const positionTotal = response.white + response.draws + response.black;
  const minGames = Math.max(100, positionTotal * 0.01);

  let best: number | null = null;
  for (const move of response.moves) {
    const total = totalGames(move);
    if (total < minGames) continue;
    const wr = userColor === 'w'
      ? ((move.white + move.draws * 0.5) / total) * 100
      : ((move.black + move.draws * 0.5) / total) * 100;
    if (best === null || wr > best) best = wr;
  }
  return best;
}

export function calcWinRate(response: ExplorerResponse, userColor: 'w' | 'b'): number {
  const total = response.white + response.draws + response.black;
  if (total === 0) return 50;

  if (userColor === 'w') {
    return ((response.white + response.draws * 0.5) / total) * 100;
  }
  return ((response.black + response.draws * 0.5) / total) * 100;
}

export function isOutOfBook(response: ExplorerResponse): boolean {
  const total = response.white + response.draws + response.black;
  return total < MIN_GAMES_THRESHOLD;
}
