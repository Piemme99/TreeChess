import { describe, expect, it } from 'vitest';
import { Chess } from 'chess.js';
import { playedGamesFixture } from '../fixtures/playedGames';
import { buildOpeningTree } from './openingTree';
import type { PlayedGame } from './playedGame';
import { createRepertoire, repertoireLines, repertoireMovesAt } from './repertoire';

const TODAY = '2026-01-01';

const games = (count: number, side: PlayedGame['side'], moves: string, playedAt = '2025-06-01'): PlayedGame[] =>
  Array.from({ length: count }, () => ({ side, moves: moves.split(' '), score: 1, playedAt }));

const fenAfter = (moves: string) => {
  const chess = new Chess();
  for (const san of moves.split(' ').filter(Boolean)) chess.move(san);
  return chess.fen();
};

const sansAt = (repertoire: ReturnType<typeof createRepertoire>, moves: string) =>
  repertoireMovesAt(repertoire, fenAfter(moves)).map((move) => move.san);

describe('createRepertoire', () => {
  it('keeps every move played in at least a fifth of the games of a position', () => {
    const repertoire = createRepertoire([...games(8, 'b', 'e4 c6'), ...games(2, 'b', 'e4 c5'), ...games(30, 'b', 'd4 d5')], 'b', TODAY);

    expect(sansAt(repertoire, '')).toEqual(['d4', 'e4']);
    expect(sansAt(repertoire, 'e4')).toEqual(['c6']);
  });

  it('keeps two moves the player alternates between', () => {
    const repertoire = createRepertoire([...games(12, 'b', 'e4 c6'), ...games(6, 'b', 'e4 c5')], 'b', TODAY);

    expect(sansAt(repertoire, 'e4')).toEqual(['c6', 'c5']);
  });

  it('needs five games before a move enters', () => {
    const repertoire = createRepertoire(games(4, 'w', 'e4 e5 Nf3'), 'w', TODAY);

    expect(sansAt(repertoire, '')).toEqual([]);
  });

  it('reads only the twelve months before today', () => {
    const repertoire = createRepertoire(
      [...games(10, 'w', 'd4', '2024-06-01'), ...games(10, 'w', 'c4', '2026-02-01'), ...games(10, 'w', 'e4')],
      'w',
      TODAY,
    );

    expect(sansAt(repertoire, '')).toEqual(['e4']);
  });

  it('keeps the games of the other side out', () => {
    const repertoire = createRepertoire([...games(10, 'w', 'e4'), ...games(10, 'b', 'd4')], 'w', TODAY);

    expect(sansAt(repertoire, '')).toEqual(['e4']);
  });

  it('records each move as a habit added on the creation day', () => {
    const repertoire = createRepertoire(games(10, 'w', 'e4'), 'w', TODAY);

    expect(repertoireMovesAt(repertoire, fenAfter(''))).toEqual([{ san: 'e4', source: 'habit', addedAt: TODAY }]);
  });

  it('merges lines that transpose into the same position', () => {
    const repertoire = createRepertoire([...games(10, 'w', 'Nf3 d5 d4 Nf6'), ...games(10, 'w', 'd4 d5 Nf3 Nc6')], 'w', TODAY);

    expect(sansAt(repertoire, 'd4 d5 Nf3')).toEqual(['Nf6', 'Nc6']);
  });
});

describe("createRepertoire on Piemme78's games", () => {
  it('holds both first moves with White and both defences against 1.e4 in 2025', () => {
    expect(sansAt(createRepertoire(playedGamesFixture, 'w', TODAY), '')).toEqual(['e4', 'd4']);
    expect(sansAt(createRepertoire(playedGamesFixture, 'b', TODAY), 'e4')).toEqual(['c6', 'c5']);
  });
});

describe('repertoireLines', () => {
  it('marks the lines of the tree that stay inside the repertoire', () => {
    const played = [...games(10, 'w', 'e4 e5 Nf3'), ...games(10, 'w', 'e4 c5 Nf3'), ...games(1, 'w', 'e4 c5 c3')];
    const repertoire = createRepertoire(played, 'w', TODAY);
    const lines = repertoireLines(repertoire, buildOpeningTree(played, 'w', 16));

    expect([...lines].sort()).toEqual(['e4', 'e4 c5', 'e4 c5 Nf3', 'e4 e5', 'e4 e5 Nf3']);
  });

  it('follows a transposition into a line the repertoire holds', () => {
    const repertoire = createRepertoire([...games(10, 'w', 'd4 d5 Nf3 Nf6 c4'), ...games(10, 'w', 'd4 Nf6 Nf3 d5')], 'w', TODAY);
    const tree = buildOpeningTree(games(1, 'w', 'd4 Nf6 Nf3 d5 c4'), 'w', 16);

    expect(repertoireLines(repertoire, tree).has('d4 Nf6 Nf3 d5 c4')).toBe(true);
  });

  it('leaves out a line that left the repertoire, even if it transposes back', () => {
    const repertoire = createRepertoire(games(10, 'w', 'd4 d5 Nf3'), 'w', TODAY);
    const tree = buildOpeningTree(games(1, 'w', 'Nf3 d5 d4'), 'w', 16);

    expect(repertoireLines(repertoire, tree).size).toBe(0);
  });
});
