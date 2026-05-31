import { describe, it, expect } from 'vitest';
import { parseOpeningName } from './parseOpeningName';

describe('parseOpeningName', () => {
  it('prefers the explicit Opening header', () => {
    expect(
      parseOpeningName({ Opening: 'Sicilian Defense', ECOUrl: 'https://x/openings/Foo', ECO: 'B20' }),
    ).toBe('Sicilian Defense');
  });

  it('derives the name from a Chess.com ECOUrl slug', () => {
    expect(
      parseOpeningName({
        ECOUrl: 'https://www.chess.com/openings/Sicilian-Defense-Najdorf-Variation',
      }),
    ).toBe('Sicilian Defense Najdorf Variation');
  });

  it('strips a trailing move sequence from the ECOUrl slug', () => {
    expect(
      parseOpeningName({
        ECOUrl: 'https://www.chess.com/openings/Ruy-Lopez-Berlin-Defense-4.O-O-Nge7-5.Re1',
      }),
    ).toBe('Ruy Lopez Berlin Defense');
  });

  it('strips an ellipsis fragment from the ECOUrl slug', () => {
    expect(
      parseOpeningName({
        ECOUrl: 'https://www.chess.com/openings/Italian-Game...3.Bc4',
      }),
    ).toBe('Italian Game');
  });

  it('ignores query strings on the ECOUrl', () => {
    expect(
      parseOpeningName({
        ECOUrl: 'https://www.chess.com/openings/Caro-Kann-Defense?ref=1',
      }),
    ).toBe('Caro Kann Defense');
  });

  it('falls back to the ECO code when no Opening or usable ECOUrl is present', () => {
    expect(parseOpeningName({ ECO: 'C50' })).toBe('C50');
  });

  it('falls back to the ECO code when the ECOUrl has no /openings/ segment', () => {
    expect(parseOpeningName({ ECOUrl: 'https://www.chess.com/games/123', ECO: 'D02' })).toBe('D02');
  });

  it('returns undefined when no opening information is available', () => {
    expect(parseOpeningName({})).toBeUndefined();
  });
});
