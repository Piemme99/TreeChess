import { describe, expect, it } from 'vitest';
import type { CheckedGame } from '../checks/checkedGame';
import { checkQueue, sessionSteps } from './steps';

const deviation = (id: number, moves: string[], playedAt: string, kind: 'left' | 'uncovered' = 'left'): CheckedGame => ({
  id,
  game: { side: 'b', moves, score: 0, playedAt },
  check: { kind, ply: moves.length - 1, played: moves.at(-1)!, planned: ['d5'], position: moves.slice(0, -1).join(' ') },
  answered: [],
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

describe('checkQueue', () => {
  const at = (side: 'w' | 'b', moves: string[], id: number): CheckedGame => {
    const base = deviation(id, moves, '2026-04-10');
    return { ...base, game: { ...base.game, side } };
  };
  const steps = sessionSteps([
    at('b', ['d4', 'Nf6'], 1), at('b', ['d4', 'Nf6'], 2), at('b', ['d4', 'Nf6'], 3),
    at('b', ['e4', 'c6'], 4), at('b', ['e4', 'c6'], 5),
    at('b', ['d4', 'e6'], 6),
    at('w', ['e4', 'c5', 'Bb5'], 7),
  ]);
  const queue = (side: 'w' | 'b') => checkQueue(steps, side).map((step) => `${step.side} ${step.path.join(' ')} ${step.played}`);

  it('keeps the moves played at one position next to each other, so the board stays put', () => {
    expect(queue('b').slice(0, 3)).toEqual(['b d4 Nf6', 'b d4 e6', 'b e4 c6']);
  });

  it('starts with the side being looked at, then the other', () => {
    expect(queue('b').at(-1)).toBe('w e4 c5 Bb5');
    expect(queue('w')[0]).toBe('w e4 c5 Bb5');
  });
});
