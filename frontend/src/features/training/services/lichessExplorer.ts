// Lichess Explorer API client with in-memory cache and rate limiting

const EXPLORER_BASE_URL = 'https://explorer.lichess.ovh/lichess';
const EXPLORER_SPEEDS = 'blitz,rapid,classical';
const EXPLORER_RATINGS = '1600,1800,2000,2200,2500';
const MIN_GAMES_THRESHOLD = 100;
const API_DELAY_MS = 200;
const RETRY_DELAY_MS = 2000;
const REQUEST_TIMEOUT_MS = 10000;

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

// In-memory cache
const cache = new Map<string, ExplorerResponse>();

// Rate limiting
let lastRequestTime = 0;

async function rateLimitedFetch(url: string): Promise<Response> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < API_DELAY_MS) {
    await new Promise((r) => setTimeout(r, API_DELAY_MS - elapsed));
  }
  lastRequestTime = Date.now();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const resp = await fetch(url, { signal: controller.signal });

    if (resp.status === 429) {
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      lastRequestTime = Date.now();
      return fetch(url, { signal: controller.signal });
    }

    return resp;
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchExplorerData(fen: string): Promise<ExplorerResponse> {
  const cached = cache.get(fen);
  if (cached) return cached;

  const url = `${EXPLORER_BASE_URL}?variant=standard&speeds=${EXPLORER_SPEEDS}&ratings=${EXPLORER_RATINGS}&fen=${encodeURIComponent(fen)}`;
  const resp = await rateLimitedFetch(url);

  if (!resp.ok) {
    throw new Error(`Explorer API error: ${resp.status}`);
  }

  const data: ExplorerResponse = await resp.json();
  cache.set(fen, data);
  return data;
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
 * More popular moves are more likely to be chosen, but every move
 * in the database has a chance — so the user faces different lines
 * across training sessions.
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

  // Fallback (should not happen due to floating-point)
  return response.moves[response.moves.length - 1];
}

export function getMovePopularity(response: ExplorerResponse, san: string): number | null {
  const total = response.white + response.draws + response.black;
  if (total === 0) return null;

  const move = response.moves.find((m) => m.san === san);
  if (!move) return null;

  return (totalGames(move) / total) * 100;
}

/**
 * Returns the user win rate (%) for a specific move in a position.
 * Returns null if the move is not found.
 */
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

/**
 * Returns the user win rate (%) of the best "mainstream" move in a position.
 * Only considers moves with at least 1% of the total games at this position
 * to avoid noise from rare lines with inflated win rates.
 */
export function getBestMoveWinRate(response: ExplorerResponse, userColor: 'w' | 'b'): number | null {
  if (response.moves.length === 0) return null;
  const positionTotal = response.white + response.draws + response.black;
  // Minimum games: 1% of position total, but at least 100
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
