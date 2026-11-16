import { describe, expect, it } from 'vitest';
import type { GameCheck } from './gameCheck';
import type { PlayedGame } from './playedGame';
import { adherence } from './worked';

const game = (moves: string, playedAt: string, check: GameCheck) => ({ game: { side: 'b', moves: moves.split(' '), score: 1, playedAt } satisfies PlayedGame, check });
const left: GameCheck = { kind: 'left', ply: 3, played: 'Nf6', planned: ['d5'], position: '' };
const uncovered: GameCheck = { kind: 'uncovered', ply: 4, played: 'h4', planned: ['Nf3'], position: '' };

describe('adherence', () => {
  it('counts the games through the line since it was worked, followed or left by the opponent', () => {
    const checked = [
      game('d4 d5 c4 e6', '2026-01-02', left),
      game('d4 d5 c4 e6', '2026-01-10', { kind: 'followed', plies: 8 }),
      game('d4 d5 Nf3 Nf6', '2026-01-11', uncovered),
      game('d4 d5 c4 Nf6', '2026-01-12', left),
      game('e4 c6', '2026-01-12', left),
    ];

    expect(adherence(checked, { side: 'b', path: ['d4', 'd5'], since: '2026-01-05' })).toEqual({ games: 3, followed: 2 });
  });
});
