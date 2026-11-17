import { describe, expect, it } from 'vitest';
import type { GameCheck } from './gameCheck';
import type { GameScore, PlayedGame } from './playedGame';
import { adherence, splitWorked } from './worked';

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

describe('splitWorked', () => {
  const caroKann = { side: 'w' as const, path: ['e4', 'c6', 'd4'], average: 0.58 };
  const worked = [{ side: 'w' as const, path: ['e4', 'c6', 'd4'], since: '2026-11-17' }];
  const played = (count: number, playedAt: string, score: GameScore): PlayedGame[] =>
    Array.from({ length: count }, () => ({ side: 'w', moves: ['e4', 'c6', 'd4', 'd5'], score, playedAt }));

  it('takes a weak opening the player has worked off the things to do, however badly it went before', () => {
    expect(splitWorked([caroKann], worked, played(27, '2026-10-01', 0))).toEqual({ toWork: [], treated: [caroKann] });
  });

  it('brings a worked weak opening back once the games played since the work prove it weak again', () => {
    expect(splitWorked([caroKann], worked, played(20, '2026-12-01', 0))).toEqual({ toWork: [caroKann], treated: [] });
  });

  it('leaves the weak openings nobody worked on to do', () => {
    const other = { side: 'b' as const, path: ['e4', 'c5', 'd4', 'cxd4'], average: 0.48 };
    expect(splitWorked([other], worked, [])).toEqual({ toWork: [other], treated: [] });
  });
});
