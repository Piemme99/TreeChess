import { describe, it, expect } from 'vitest';
import { toEpd, resolveOpening, type OpeningTable } from './openings';

const SICILIAN = 'rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq -';
const NAJDORF = 'rnbqkb1r/1p2pppp/p2p1n2/8/3NP3/2N5/PPP2PPP/R1BQKB1R w KQkq -';

const table: OpeningTable = {
  [SICILIAN]: { eco: 'B20', name: 'Sicilian Defense' },
  [NAJDORF]: { eco: 'B90', name: 'Sicilian Defense: Najdorf Variation' },
};

describe('toEpd', () => {
  it('keeps only the first four FEN fields', () => {
    expect(toEpd('rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2')).toBe(SICILIAN);
  });
});

describe('resolveOpening', () => {
  it('returns null when no position on the path is named', () => {
    expect(resolveOpening(['8/8/8/8/8/8/8/8 w - -'], table)).toBeNull();
  });

  it('matches the current position exactly (in book)', () => {
    const result = resolveOpening([`${SICILIAN} 0 2`], table);
    expect(result).toEqual({ eco: 'B20', name: 'Sicilian Defense', isExact: true });
  });

  it('returns the deepest named opening along the path', () => {
    const result = resolveOpening([`${SICILIAN} 0 2`, `${NAJDORF} 0 6`], table);
    expect(result).toEqual({ eco: 'B90', name: 'Sicilian Defense: Najdorf Variation', isExact: true });
  });

  it('keeps the last known opening with isExact=false once out of book', () => {
    const offBook = 'rnbqkb1r/1p2pppp/p2p1n2/8/3NPP2/2N5/PPP3PP/R1BQKB1R b KQkq -';
    const result = resolveOpening([`${SICILIAN} 0 2`, `${NAJDORF} 0 6`, `${offBook} 0 7`], table);
    expect(result).toEqual({ eco: 'B90', name: 'Sicilian Defense: Najdorf Variation', isExact: false });
  });
});
