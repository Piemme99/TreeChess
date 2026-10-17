import { describe, expect, it } from 'vitest';
import type { OpeningNode } from '../domain/openingTree';
import { lineTone } from './tone';

const line = (games: number, rate: number): OpeningNode => ({
  san: 'e4', games, score: games * rate, children: [],
});

describe('lineTone', () => {
  it.each([
    [0.35, 'losing'],
    [0.43, 'slipping'],
    [0.49, 'even'],
    [0.57, 'winning'],
  ])('colours a line scoring %s against a 50%% average as %s', (rate, tone) => {
    expect(lineTone(line(1000, rate), 0.5)).toBe(tone);
  });

  it('leaves a line with too few games uncoloured, however it scores', () => {
    expect(lineTone(line(19, 0), 0.5)).toBe('even');
  });
});
