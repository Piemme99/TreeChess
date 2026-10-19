import type { BoardArrow } from '../line/ArrowBoard';

export const MAX_ARROWS = 3;

export interface ArrowCandidate {
  san: string;
  /** Parties passées par le coup sur la période récente. */
  games: number;
}

/**
 * Trois flèches au plus sur un échiquier de position : le coup qui a fait quitter le répertoire
 * (gris, s'il y en a un), puis les coups du répertoire les plus joués sur 12 mois (vert), épais
 * selon leur part. Les autres coups du répertoire restent lisibles ailleurs (arbre, ligne « Repertoire »).
 */
export function relevantArrows(planned: readonly ArrowCandidate[], total: number, deviation?: string): BoardArrow[] {
  const arrows: BoardArrow[] = [];
  if (deviation) arrows.push({ san: deviation, kind: 'neutral', share: 0.5, emphasis: true });
  const byGames = [...planned].sort((a, b) => b.games - a.games);
  for (const move of byGames.slice(0, MAX_ARROWS - arrows.length)) {
    arrows.push({ san: move.san, kind: 'repertoire', share: total ? Math.max(0.2, move.games / total) : 0.5 });
  }
  return arrows;
}
