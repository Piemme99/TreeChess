import type { CheckedGame } from '../checks/checkedGame';
import type { Side } from '../domain/playedGame';
import type { Deviation } from '../checks/useBuilder';

/** Une étape de la séance : une position que des parties ont quittée de la même façon. */
export interface SessionStep {
  key: string;
  side: Side;
  kind: Deviation['kind'];
  /** Les coups jusqu'à la position, pris dans la partie la plus récente. */
  path: readonly string[];
  played: string;
  planned: readonly string[];
  /** La plus récente d'abord. */
  games: readonly (CheckedGame & { check: Deviation })[];
}

const isDeviation = (checked: CheckedGame): checked is CheckedGame & { check: Deviation } => checked.check.kind !== 'followed';

/** Les parties à trancher, regroupées par position et par coup ; la plus fréquente d'abord, puis la plus récente. */
export function sessionSteps(toDecide: readonly CheckedGame[]): SessionStep[] {
  const steps = new Map<string, SessionStep>();
  const recentFirst = [...toDecide].filter(isDeviation).sort((a, b) => b.game.playedAt.localeCompare(a.game.playedAt) || b.id - a.id);
  for (const checked of recentFirst) {
    const { game, check } = checked;
    const key = `${game.side} ${check.position} ${check.played}`;
    const known = steps.get(key);
    if (known) {
      steps.set(key, { ...known, games: [...known.games, checked] });
      continue;
    }
    steps.set(key, {
      key,
      side: game.side,
      kind: check.kind,
      path: game.moves.slice(0, check.ply),
      played: check.played,
      planned: check.planned,
      games: [checked],
    });
  }
  return [...steps.values()].sort(
    (a, b) => b.games.length - a.games.length || b.games[0].game.playedAt.localeCompare(a.games[0].game.playedAt),
  );
}
