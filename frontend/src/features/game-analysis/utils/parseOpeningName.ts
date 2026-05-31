import type { PGNHeaders } from '../../../types';

/**
 * Resolve a human-readable opening name from PGN headers.
 *
 * Preference order:
 *  1. The explicit `Opening` header (Lichess and most PGN sources set this).
 *  2. The Chess.com `ECOUrl`, whose slug encodes the opening name plus a move
 *     sequence (e.g. ".../Sicilian-Defense-Najdorf-Variation-4.O-O-Nge7"). We
 *     strip the trailing move sequence and turn dashes into spaces.
 *  3. The bare `ECO` code as a last resort.
 *
 * Returns undefined when none of the headers carry opening information.
 */
export function parseOpeningName(headers: PGNHeaders): string | undefined {
  const { Opening, ECOUrl, ECO } = headers;

  if (Opening) return Opening;

  if (ECOUrl) {
    const match = ECOUrl.match(/\/openings\/([^?]+)/);
    if (match) {
      let name = match[1];
      // Drop "..." ellipsis fragments and everything after them.
      name = name.replace(/\.{2,}.*$/, '');
      // Drop move sequences like "-4.O-O-Nge7-5.Re1".
      name = name.replace(/-\d+\..*$/, '');
      // "Sicilian-Defense-Najdorf-Variation" -> "Sicilian Defense Najdorf Variation".
      return name.replace(/-/g, ' ');
    }
  }

  return ECO;
}
