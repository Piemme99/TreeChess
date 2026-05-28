import { describe, it, expect } from 'vitest';
import { sanitizeUsername } from './sanitizeUsername';

describe('sanitizeUsername', () => {
  it('trims surrounding whitespace', () => {
    expect(sanitizeUsername('  DrNykterstein  ')).toBe('DrNykterstein');
  });

  it('returns empty string for blank input', () => {
    expect(sanitizeUsername('   ')).toBe('');
  });

  it('strips a leading @', () => {
    expect(sanitizeUsername('@thibault')).toBe('thibault');
  });

  it('extracts the handle from a Lichess profile URL', () => {
    expect(sanitizeUsername('https://lichess.org/@/thibault')).toBe('thibault');
    expect(sanitizeUsername('lichess.org/@/DrNykterstein')).toBe('DrNykterstein');
  });

  it('extracts the handle from a Chess.com profile URL', () => {
    expect(sanitizeUsername('https://www.chess.com/member/hikaru')).toBe('hikaru');
    expect(sanitizeUsername('chess.com/member/MagnusCarlsen')).toBe('MagnusCarlsen');
  });

  it('drops query strings and fragments from pasted URLs', () => {
    expect(sanitizeUsername('https://lichess.org/@/thibault?tab=games')).toBe('thibault');
  });

  it('leaves a plain username untouched', () => {
    expect(sanitizeUsername('penguingm1')).toBe('penguingm1');
  });
});
