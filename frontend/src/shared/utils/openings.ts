// Opening-name lookup against the bundled lichess-org/chess-openings dataset.
// The dataset (src/shared/data/openings.json) maps a position EPD — the first
// four FEN fields (board, side to move, castling, en passant) — to its ECO code
// and opening name. See scripts/generate-openings.mjs for how it is produced.

export interface OpeningInfo {
  eco: string;
  name: string;
}

export type OpeningTable = Record<string, OpeningInfo>;

export interface ResolvedOpening extends OpeningInfo {
  /** True when the deepest named position matched is the current one (in book). */
  isExact: boolean;
}

/** The first four FEN fields identify an opening position. */
export function toEpd(fen: string): string {
  return fen.split(' ').slice(0, 4).join(' ');
}

/**
 * Resolve the opening for a position given the path of FENs leading to it
 * (from the starting position to the current one, in order).
 *
 * Returns the deepest named opening encountered along the path, so that once a
 * line leaves theory we keep showing the last known opening with isExact=false.
 * Returns null when no position on the path is a named opening.
 */
export function resolveOpening(fenPath: string[], table: OpeningTable): ResolvedOpening | null {
  let best: ResolvedOpening | null = null;
  for (let i = 0; i < fenPath.length; i++) {
    const info = table[toEpd(fenPath[i])];
    if (info) {
      best = { ...info, isExact: i === fenPath.length - 1 };
    }
  }
  return best;
}
