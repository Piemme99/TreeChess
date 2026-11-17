import { describe, expect, it } from 'vitest';
import { importedSource } from './gameSource';

describe('importedSource', () => {
  it('reads an imported game from the player side: colour, moves, result, day', () => {
    const source = importedSource('Piemme78', [{ color: 'black', moves: 'e4 c6 d4 d5', score: 1, playedAt: '2026-11-02' }], '2026-11-17');
    expect(source.games).toEqual([{ side: 'b', moves: ['e4', 'c6', 'd4', 'd5'], score: 1, playedAt: '2026-11-02' }]);
  });

  it('builds the repertoire from every game played up to the import, that day included, and never replays', () => {
    const source = importedSource('Piemme78', [], '2026-12-31');
    expect(source.firstDay).toBe('2026-12-31');
    expect(source.start).toBe('2027-01-01');
    expect(source.replay).toBe(false);
  });

  it('keeps the decisions of each account apart from the demo', () => {
    expect(importedSource('Piemme78', [], '2026-11-17').id).toBe('lichess:piemme78');
  });
});
