import type { CheckedGame } from '../checks/checkedGame';
import type { Side } from '../domain/playedGame';
import type { Deviation } from '../checks/useBuilder';
import type { StepVerdict } from './verdict';

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
  /** L'avis du moteur sur un écart du joueur, quand il est arrivé. */
  verdict?: StepVerdict;
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

/** Ce que vaut le coup que le joueur retrouve sur une position qu'il a quittée : n'importe quel coup du répertoire est juste. */
export type RecallVerdict = 'right' | 'again' | 'other';

export const recallOf = (step: Pick<SessionStep, 'played' | 'planned'>, san: string): RecallVerdict =>
  step.planned.includes(san) ? 'right' : san === step.played ? 'again' : 'other';

/** La file de Check : le camp regardé d'abord, puis l'autre ; les coups joués sur une même position l'un après l'autre. */
export function checkQueue(steps: readonly SessionStep[], side: Side): SessionStep[] {
  // Changer de camp à chaque étape ferait tout redessiner ; changer de position, rejouer l'échiquier.
  const bySide = [...steps.filter((step) => step.side === side), ...steps.filter((step) => step.side !== side)];
  const at = (step: SessionStep) => `${step.side} ${step.games[0].check.position}`;
  return bySide.filter((step, index) => bySide.findIndex((other) => at(other) === at(step)) === index).flatMap((first) => bySide.filter((step) => at(step) === at(first)));
}
