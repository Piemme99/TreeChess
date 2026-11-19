import { describe, expect, it } from 'vitest';
import { Chess } from 'chess.js';
import { gamesToDecide, liveGames } from '../checks/decisions';
import { draftMoves } from './addition';
import type { PlayedGame } from './playedGame';
import { createRepertoire, positionKey } from './repertoire';
import { repertoiresOn, withoutReadded, withRemovals, type Removal } from './removal';
import { playerPositions } from './review';

const positionAfter = (moves: string) => {
  const chess = new Chess();
  for (const san of moves.split(' ').filter(Boolean)) chess.move(san);
  return positionKey(chess.fen());
};

const games = (moves: string, count: number, playedAt = '2025-06-01'): PlayedGame[] =>
  Array.from({ length: count }, () => ({ side: 'w', moves: moves.split(' '), score: 1, playedAt }));

// Le joueur a longtemps joué le gambit Morra contre la Sicilienne, et l'a abandonné.
const repertoire = createRepertoire([...games('e4 e5 Nf3 Nc6 Bc4', 10), ...games('e4 c5 d4 cxd4 c3', 10)], 'w', '2026-01-01');
const morra: Removal = { side: 'w', position: positionAfter('e4 c5'), san: 'd4', removedAt: '2026-03-01' };

describe('withRemovals', () => {
  it('takes a removed move out of the review, and the whole line it opened with it', () => {
    const reviewed = (from: typeof repertoire) => playerPositions(from).map(({ path }) => path.join(' '));

    expect(reviewed(repertoire)).toEqual(expect.arrayContaining(['e4 c5', 'e4 c5 d4 cxd4']));
    expect(reviewed(withRemovals(repertoire, [morra]))).toEqual(['', 'e4 e5', 'e4 e5 Nf3 Nc6']);
  });

  it('puts a removed move back in the repertoire when the player adds it again', () => {
    const readded = { side: 'w' as const, addedAt: '2026-04-01', moves: draftMoves([{ path: ['e4', 'c5', 'd4'], source: 'habit' }]) };

    expect(withoutReadded([morra], readded)).toEqual([]);
    expect(withRemovals(repertoire, withoutReadded([morra], readded)).moves.get(morra.position)?.map((move) => move.san)).toEqual(['d4']);
  });
});

describe('repertoiresOn', () => {
  it('leaves the games played with a move before its removal settled, and asks about the ones played with it after', () => {
    // Contre l'Italienne et l'Espagnole à la fois : retirer l'une laisse l'autre, la partie quitte le répertoire.
    const both = createRepertoire([...games('e4 e5 Nf3 Nc6 Bc4', 10), ...games('e4 e5 Nf3 Nc6 Bb5', 10)], 'w', '2026-01-01');
    const italian: Removal = { side: 'w', position: positionAfter('e4 e5 Nf3 Nc6'), san: 'Bc4', removedAt: '2026-03-01' };
    const played = [...games('e4 e5 Nf3 Nc6 Bc4', 1, '2026-02-01'), ...games('e4 e5 Nf3 Nc6 Bc4', 1, '2026-04-01')];
    const lived = liveGames(played, repertoiresOn({ w: both, b: createRepertoire([], 'b', '2026-01-01') }, [italian]), '2025-12-31', '2026-04-01');

    expect(gamesToDecide(lived, new Set(), '2026-04-01').map(({ game }) => game.playedAt)).toEqual(['2026-04-01']);
  });
});
