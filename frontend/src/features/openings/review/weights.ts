import type { CheckedGame } from '../checks/checkedGame';
import type { Side } from '../domain/playedGame';
import type { Repertoire } from '../domain/repertoire';

// Une position manquée en partie passe devant ; un ajout récent devant le reste.
const LAPSE_WEIGHT = 10;
const ADDITION_WEIGHT = 3;

/** Les positions où le joueur a quitté son répertoire en partie, avec le jour du dernier oubli. */
export function lapsesOf(lived: readonly CheckedGame[]): Record<Side, Map<string, string>> {
  const found: Record<Side, Map<string, string>> = { w: new Map(), b: new Map() };
  for (const { game, check } of lived) if (check.kind === 'left') found[game.side].set(check.position, game.playedAt);
  return found;
}

/** Le poids d'une position dans le choix de la prochaine ligne à réviser ; `since` : début des ajouts récents. */
export const reviewWeight = (lapses: ReadonlyMap<string, string>, repertoire: Repertoire, since: string) => (key: string): number => {
  if (lapses.has(key)) return LAPSE_WEIGHT;
  return repertoire.moves.get(key)?.some((move) => move.addedAt > since) ? ADDITION_WEIGHT : 1;
};
