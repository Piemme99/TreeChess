// PROTOTYPE — import depuis l'API publique chess.com (pas d'auth). Jetable.

export interface RawGame {
  pgn: string;
  /** Rempli à l'agrégation : les premiers coups en SAN, pour ne pas rejouer le PGN deux fois. */
  moves?: string[];
  userIsWhite: boolean;
  /** Résultat du point de vue du joueur : 1 / 0.5 / 0. */
  score: number;
  timeClass: string;
  endTime: number;
  opponent: string;
  opponentRating: number;
}

interface ApiGame {
  pgn?: string;
  rules?: string;
  time_class?: string;
  end_time?: number;
  white?: { username?: string; result?: string; rating?: number };
  black?: { username?: string; result?: string; rating?: number };
}

export async function fetchArchives(user: string): Promise<string[]> {
  const res = await fetch(`https://api.chess.com/pub/player/${user.toLowerCase()}/games/archives`);
  if (!res.ok) throw new Error(`archives: HTTP ${res.status}`);
  const body = (await res.json()) as { archives?: string[] };
  return body.archives ?? [];
}

export async function fetchMonth(url: string, user: string): Promise<RawGame[]> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  const body = (await res.json()) as { games?: ApiGame[] };
  const lower = user.toLowerCase();

  const out: RawGame[] = [];
  for (const g of body.games ?? []) {
    if (g.rules !== 'chess' || !g.pgn) continue;
    const white = g.white?.username?.toLowerCase();
    const black = g.black?.username?.toLowerCase();
    if (white !== lower && black !== lower) continue;

    const userIsWhite = white === lower;
    const mine = userIsWhite ? g.white : g.black;
    const theirs = userIsWhite ? g.black : g.white;
    const score = mine?.result === 'win' ? 1 : theirs?.result === 'win' ? 0 : 0.5;

    out.push({
      pgn: g.pgn,
      userIsWhite,
      score,
      timeClass: g.time_class ?? 'unknown',
      endTime: g.end_time ?? 0,
      opponent: theirs?.username ?? '?',
      opponentRating: theirs?.rating ?? 0,
    });
  }
  return out;
}
