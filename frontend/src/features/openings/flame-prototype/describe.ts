// PROTOTYPE — textes d'une tuile, partagés par la carte au survol (K, L) et le bandeau (M).
import { figurineLine } from '../design-prototype/figurines';
import type { OpeningNode } from '../domain/openingTree';
import { scoreRate } from '../domain/performance';
import { formatPercent } from '../flame/format';
import type { PlacedTile } from './prune';

export function headline(placed: PlacedTile): string {
  if (placed.rest) return `${placed.rest} other lines`;
  if (placed.path.length === 0) return 'All games';
  return figurineLine(placed.path);
}

export function summary(node: OpeningNode, average: number): string {
  const rate = scoreRate(node);
  const gap = Math.round((rate - average) * 100);
  const sign = gap > 0 ? '+' : '';
  return `${node.games} games · ${formatPercent(rate)} · ${sign}${gap} vs your ${formatPercent(average)}`;
}
