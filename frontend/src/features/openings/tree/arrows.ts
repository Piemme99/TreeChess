import type { BoardArrow } from '../line/ArrowBoard';
import type { SessionStep } from '../session/steps';
import type { MapNode } from './repertoireMap';

export const MAX_ARROWS = 3;

/**
 * Trois flèches au plus : le coup qui a fait quitter le répertoire le plus souvent (gris), puis les
 * coups du répertoire les plus joués sur 12 mois (vert), épais selon leur part. Les autres coups
 * du répertoire sont déjà dans l'arbre et sur la ligne « Repertoire » du volet.
 */
export function relevantArrows(node: MapNode, steps: readonly SessionStep[]): BoardArrow[] {
  const arrows: BoardArrow[] = [];
  const deviation = [...steps].sort((a, b) => b.games.length - a.games.length)[0];
  if (deviation) arrows.push({ san: deviation.played, kind: 'neutral', share: 0.5, emphasis: true });
  const planned = [...node.children].sort((a, b) => b.games - a.games);
  for (const child of planned.slice(0, MAX_ARROWS - arrows.length)) {
    arrows.push({ san: child.san!, kind: 'repertoire', share: node.games ? Math.max(0.2, child.games / node.games) : 0.5 });
  }
  return arrows;
}
