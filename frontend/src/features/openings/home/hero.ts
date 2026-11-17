export type HomeHero = 'first' | 'games' | 'review' | 'work' | 'done';

/**
 * La carte mise en avant sur Home : la plus urgente des tâches non vides (README « Screen 2 — Home »). Une
 * ouverture faible déjà travaillée ne compte pas : elle ne prend jamais la carte à une tâche qui reste.
 */
export function homeHero({ firstDay, gamesToSettle, linesDue, weakToWork }: { firstDay: boolean; gamesToSettle: number; linesDue: number; weakToWork: number }): HomeHero {
  if (firstDay && weakToWork) return 'first';
  if (gamesToSettle) return 'games';
  if (linesDue) return 'review';
  if (weakToWork) return 'work';
  return 'done';
}
