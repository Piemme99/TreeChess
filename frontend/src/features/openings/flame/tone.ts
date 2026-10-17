import type { OpeningNode } from '../domain/openingTree';
import { deficit } from '../domain/performance';

export type Tone = 'losing' | 'slipping' | 'even' | 'winning';

export const MIN_COLOURED_GAMES = 20;

export function lineTone(node: OpeningNode, average: number): Tone {
  if (node.games < MIN_COLOURED_GAMES) return 'even';
  const gap = deficit(node, average);
  if (gap >= 0.1) return 'losing';
  if (gap >= 0.05) return 'slipping';
  if (gap <= -0.05) return 'winning';
  return 'even';
}
