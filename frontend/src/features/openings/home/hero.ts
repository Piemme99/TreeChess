export type HomeHero = 'first' | 'games' | 'review' | 'work';

/** La carte mise en avant sur Home : la plus urgente des tâches non vides (README « Screen 2 — Home »). */
export function homeHero({ firstDay, gamesToSettle, linesDue }: { firstDay: boolean; gamesToSettle: number; linesDue: number }): HomeHero {
  if (firstDay) return 'first';
  if (gamesToSettle) return 'games';
  if (linesDue) return 'review';
  return 'work';
}
