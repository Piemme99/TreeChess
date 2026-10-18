import type { CheckedGame } from '../checks/checkedGame';
import type { OpeningNode } from '../domain/openingTree';
import { scoreRate } from '../domain/performance';

export interface MoveHere {
  san: string;
  inRepertoire: boolean;
  games: number;
  score: number | null;
  toDecide: number;
}

const MIN_GAMES = 3;
const MAX_MOVES = 6;

/**
 * Ce que la position rassemble : les coups du répertoire, ceux réellement joués et les décisions qui
 * attendent sur chacun. `decisions` ne doit garder que les parties sorties du répertoire à cette position.
 */
export function movesHere(
  node: OpeningNode | undefined,
  planned: readonly string[],
  decisions: readonly CheckedGame[],
): MoveHere[] {
  const waiting = new Map<string, number>();
  for (const { check } of decisions) {
    if (check.kind !== 'followed') waiting.set(check.played, (waiting.get(check.played) ?? 0) + 1);
  }
  const played = new Map((node?.children ?? []).map((child) => [child.san!, child]));
  const sans = new Set([...planned, ...waiting.keys(), ...played.keys()]);

  return [...sans]
    .map((san): MoveHere => {
      const child = played.get(san);
      return {
        san,
        inRepertoire: planned.includes(san),
        games: child?.games ?? 0,
        score: child ? scoreRate(child) : null,
        toDecide: waiting.get(san) ?? 0,
      };
    })
    .filter((move) => move.inRepertoire || move.toDecide > 0 || move.games >= MIN_GAMES)
    .sort((a, b) => b.games - a.games || Number(b.inRepertoire) - Number(a.inRepertoire))
    .slice(0, MAX_MOVES);
}
