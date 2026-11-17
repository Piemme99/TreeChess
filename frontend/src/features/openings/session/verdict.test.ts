import { describe, expect, it } from 'vitest';
import type { Evaluation } from '../domain/diagnosis';
import type { SessionStep } from './steps';
import { isAdopted, isSound, judgeStep, settleSteps, verdictFens } from './verdict';

const step = (side: 'w' | 'b', path: string[], played: string, planned: string[], games = 1): SessionStep => ({
  key: `${side} ${path.join(' ')} ${played}`,
  side,
  kind: 'left',
  path,
  played,
  planned,
  games: Array.from({ length: games }, () => ({}) as SessionStep['games'][number]),
});

const evaluated = (target: SessionStep, cp: Record<string, number>) => {
  const fens = verdictFens(target);
  return new Map<string, Evaluation>([...fens].map(([san, fen]) => [fen, { cp: cp[san] }]));
};

describe('judgeStep', () => {
  it('waits until every move is evaluated', () => {
    const target = step('w', ['e4', 'e5'], 'Bc4', ['Nf3']);
    const partial = new Map([...evaluated(target, { Bc4: 30, Nf3: 40 })].slice(0, 1));

    expect(judgeStep(target, partial)).toBeUndefined();
  });

  it('finds nothing to blame below an inaccuracy', () => {
    const target = step('w', ['e4', 'e5'], 'Bc4', ['Nf3']);

    expect(judgeStep(target, evaluated(target, { Bc4: 25, Nf3: 40 }))).toMatchObject({ judgement: null, best: 'Nf3' });
  });

  it('names the mistake from the player side, against the best repertoire move', () => {
    const target = step('b', ['e4'], 'f6', ['e5', 'c5']);
    const verdict = judgeStep(target, evaluated(target, { f6: 150, e5: 30, c5: 40 }));

    expect(verdict).toMatchObject({ judgement: 'mistake', best: 'e5' });
    expect(verdict?.cp.get('f6')).toBe(-150);
  });

  it('does not blame a move better than the repertoire', () => {
    const target = step('w', ['e4', 'e5'], 'Nf3', ['Qh5']);

    expect(judgeStep(target, evaluated(target, { Nf3: 40, Qh5: -60 }))?.judgement).toBeNull();
  });
});

describe('isSound and isAdopted', () => {
  it('leaves a sound move played once alone, and adopts it once played again', () => {
    const once = step('b', ['d4'], 'Nf6', ['d5']);
    const twice = step('b', ['d4'], 'Nf6', ['d5'], 2);
    const sound = judgeStep(once, evaluated(once, { Nf6: 10, d5: 30 }));

    expect(isSound({ ...once, verdict: sound })).toBe(true);
    expect(isAdopted({ ...once, verdict: sound })).toBe(false);
    expect(isAdopted({ ...twice, verdict: sound })).toBe(true);
  });

  it('keeps a mistake to settle, however often it was played', () => {
    const target = step('b', ['e4'], 'f6', ['e5'], 3);
    const verdict = judgeStep(target, evaluated(target, { f6: 150, e5: 30 }));

    expect(isSound({ ...target, verdict })).toBe(false);
    expect(isAdopted({ ...target, verdict })).toBe(false);
  });

  it('judges nothing before the engine answers', () => {
    expect(isSound(step('w', ['e4', 'e5'], 'Bc4', ['Nf3'], 2))).toBe(false);
  });
});

describe('settleSteps', () => {
  const blunder = step('b', ['e4'], 'f6', ['e5']);
  const soundOnce = step('b', ['d4'], 'Nf6', ['d5']);
  const soundTwice = step('w', ['e4', 'e5'], 'Bc4', ['Nf3'], 2);
  const surprise: SessionStep = { ...step('w', ['e4'], 'b6', ['e5']), kind: 'uncovered', key: 'surprise' };
  const all = new Map([
    ...evaluated(blunder, { f6: 150, e5: 30 }),
    ...evaluated(soundOnce, { Nf6: 10, d5: 30 }),
    ...evaluated(soundTwice, { Bc4: 30, Nf3: 40 }),
  ]);
  const keys = (steps: readonly SessionStep[]) => steps.map((settled) => settled.played);

  it('keeps the moves the engine blames and the opponent surprises, not the sound moves', () => {
    expect(keys(settleSteps([blunder, soundOnce, soundTwice, surprise], all, false).steps)).toEqual(['f6', 'b6']);
  });

  it('adds to the repertoire a sound move played twice', () => {
    expect(keys(settleSteps([blunder, soundOnce, soundTwice], all, false).adopted)).toEqual(['Bc4']);
  });

  it('holds back a move until its verdict arrives, and adopts nothing meanwhile', () => {
    const settled = settleSteps([blunder, soundTwice], evaluated(soundTwice, { Bc4: 30, Nf3: 40 }), false);

    expect(settled).toMatchObject({ judging: true, adopted: [] });
    expect(keys(settled.steps)).not.toContain('f6');
  });

  it('shows every move of the player when no engine will answer', () => {
    expect(keys(settleSteps([blunder, soundOnce], new Map(), true).steps)).toEqual(['f6', 'Nf6']);
  });
});
