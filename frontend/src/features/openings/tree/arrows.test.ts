import { describe, expect, it } from 'vitest';
import type { SessionStep } from '../session/steps';
import { relevantArrows } from './arrows';
import type { MapNode } from './repertoireMap';

const child = (san: string, games: number): MapNode => ({ key: san, path: [san], san, ply: 1, position: san, games, children: [], stub: false, toSettle: 0 });
const node = (children: MapNode[], games = 100): MapNode => ({ key: '', path: [], san: null, ply: 0, position: 'start', games, children, stub: false, toSettle: 0 });
const step = (played: string, games: number): SessionStep =>
  ({ key: played, side: 'w', kind: 'left', path: [], played, planned: [], games: Array.from({ length: games }, () => ({})) }) as unknown as SessionStep;

describe('relevantArrows', () => {
  it('keeps the three most played repertoire moves, thick by share', () => {
    const arrows = relevantArrows(node([child('e4', 60), child('d4', 30), child('c4', 8), child('Nf3', 2)]), []);
    expect(arrows.map((arrow) => arrow.san)).toEqual(['e4', 'd4', 'c4']);
    expect(arrows.map((arrow) => arrow.share)).toEqual([0.6, 0.3, 0.2]);
  });

  it('gives the first slot to the most frequent deviation', () => {
    const arrows = relevantArrows(node([child('e4', 60), child('d4', 30), child('c4', 8)]), [step('b3', 2), step('g3', 5)]);
    expect(arrows.map((arrow) => arrow.san)).toEqual(['g3', 'e4', 'd4']);
    expect(arrows[0]).toMatchObject({ kind: 'neutral', emphasis: true });
  });
});
