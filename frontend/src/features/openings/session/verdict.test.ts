import { describe, expect, it } from 'vitest';
import type { Evaluation } from '../domain/diagnosis';
import type { SessionStep } from './steps';
import { isQuiet, judgeStep, verdictFens } from './verdict';

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

  it('calls two moves equal when the gap stays below an inaccuracy', () => {
    const target = step('w', ['e4', 'e5'], 'Bc4', ['Nf3']);

    expect(judgeStep(target, evaluated(target, { Bc4: 25, Nf3: 40 }))).toMatchObject({ kind: 'equal', best: 'Nf3' });
  });

  it('names the mistake from the player side, against the best repertoire move', () => {
    const target = step('b', ['e4'], 'f6', ['e5', 'c5']);
    const verdict = judgeStep(target, evaluated(target, { f6: 150, e5: 30, c5: 40 }));

    expect(verdict).toMatchObject({ kind: 'worse', judgement: 'mistake', best: 'e5' });
    expect(verdict?.cp.get('f6')).toBe(-150);
  });

  it('says when the played move beats the repertoire', () => {
    const target = step('w', ['e4', 'e5'], 'Nf3', ['Qh5']);

    expect(judgeStep(target, evaluated(target, { Nf3: 40, Qh5: -60 }))).toMatchObject({ kind: 'better' });
  });
});

describe('isQuiet', () => {
  it('keeps a sound move played once out of the way, until it comes back', () => {
    const once = step('w', ['e4', 'e5'], 'Bc4', ['Nf3']);
    const twice = step('w', ['e4', 'e5'], 'Bc4', ['Nf3'], 2);
    const equal = judgeStep(once, evaluated(once, { Bc4: 25, Nf3: 40 }));

    expect(isQuiet({ ...once, verdict: equal })).toBe(true);
    expect(isQuiet({ ...twice, verdict: equal })).toBe(false);
    expect(isQuiet(once)).toBe(false);
  });
});
