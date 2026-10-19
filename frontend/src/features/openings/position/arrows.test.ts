import { describe, expect, it } from 'vitest';
import { relevantArrows } from './arrows';

const planned = [
  { san: 'e4', games: 60 },
  { san: 'd4', games: 30 },
  { san: 'c4', games: 8 },
  { san: 'Nf3', games: 2 },
];

describe('relevantArrows', () => {
  it('keeps the three most played repertoire moves, thick by share', () => {
    const arrows = relevantArrows(planned, 100);
    expect(arrows.map((arrow) => arrow.san)).toEqual(['e4', 'd4', 'c4']);
    expect(arrows.map((arrow) => arrow.share)).toEqual([0.6, 0.3, 0.2]);
  });

  it('gives the first slot to the deviation', () => {
    const arrows = relevantArrows(planned, 100, 'g3');
    expect(arrows.map((arrow) => arrow.san)).toEqual(['g3', 'e4', 'd4']);
    expect(arrows[0]).toMatchObject({ kind: 'neutral', emphasis: true });
  });

  it('draws a move of medium weight when nothing was played', () => {
    expect(relevantArrows([{ san: 'e4', games: 0 }], 0)).toEqual([{ san: 'e4', kind: 'repertoire', share: 0.5 }]);
  });
});
