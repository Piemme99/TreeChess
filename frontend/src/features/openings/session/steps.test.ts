import { describe, expect, it } from 'vitest';
import type { CheckedGame } from '../checks/checkedGame';
import { sessionSteps } from './steps';

const deviation = (id: number, moves: string[], playedAt: string, kind: 'left' | 'uncovered' = 'left'): CheckedGame => ({
  id,
  game: { side: 'b', moves, score: 0, playedAt },
  check: { kind, ply: moves.length - 1, played: moves.at(-1)!, planned: ['d5'], position: moves.slice(0, -1).join(' ') },
  asks: true,
});

describe('sessionSteps', () => {
  it('makes one step of the games that left a position the same way, the most frequent first', () => {
    const steps = sessionSteps([
      deviation(1, ['e4', 'c5', 'Bb5'], '2026-04-10', 'uncovered'),
      deviation(2, ['d4', 'Nf6'], '2026-04-09'),
      deviation(3, ['d4', 'Nf6'], '2026-04-10'),
    ]);

    expect(steps.map((step) => [step.path.join(' '), step.played, step.games.map((checked) => checked.id)])).toEqual([
      ['d4', 'Nf6', [3, 2]],
      ['e4 c5', 'Bb5', [1]],
    ]);
  });

  it('keeps apart two moves played at the same position', () => {
    const steps = sessionSteps([deviation(1, ['d4', 'Nf6'], '2026-04-10'), deviation(2, ['d4', 'e6'], '2026-04-09')]);

    expect(steps.map((step) => step.played)).toEqual(['Nf6', 'e6']);
  });

  it('leaves out the games that followed the repertoire', () => {
    const followed: CheckedGame = { ...deviation(1, ['d4', 'd5'], '2026-04-10'), check: { kind: 'followed', plies: 2 } };

    expect(sessionSteps([followed])).toEqual([]);
  });
});
