import { uciToSan, type Evaluation } from './diagnosis';
import { judgeMove, lostChances, type Judgement } from './judgement';
import type { Side } from './playedGame';

/** La note d'un coup, du meilleur à la gaffe : celle du moteur, ou une imprécision et pire (`Judgement`). */
export type Grade = 'best' | 'good' | 'correct' | Judgement;

// En chances de gain perdues, sur 0–1 : sous 2 points le coup est bon, sous 5 (le seuil d'imprécision) correct.
const GOOD_LOSS = 0.02;

/** Ce que le moteur dit d'un coup du joueur. */
export interface MoveVerdict {
  grade: Grade;
  judgement: Judgement | null;
  /** Le coup du moteur, quand celui du joueur est fautif. */
  better: string | null;
}

/**
 * Les coups du joueur jugés comme sur Lichess : ce qu'ils perdent face au meilleur coup, d'après l'évaluation avant et
 * après. `fens` : la position de départ puis celle qu'atteint chaque coup. Un coup absent de la carte est un coup de
 * l'adversaire, ou un coup que le moteur n'a pas encore jugé. `from` : le premier demi-coup que le joueur a joué
 * lui-même ; les coups d'avant ne sont pas les siens.
 */
export function judgeGame(
  path: readonly string[],
  fens: readonly string[],
  side: Side,
  evaluations: ReadonlyMap<string, Evaluation>,
  from = 0,
): Map<number, MoveVerdict> {
  const verdicts = new Map<number, MoveVerdict>();
  for (let ply = side === 'w' ? 0 : 1; ply < path.length; ply += 2) {
    if (ply < from) continue;
    const before = evaluations.get(fens[ply]);
    const after = evaluations.get(fens[ply + 1]);
    if (!before || !after) continue;
    const best = uciToSan(fens[ply], before.best);
    // Deux évaluations de profondeurs différentes divergent : le coup du moteur ne se reproche pas à lui-même.
    if (best === path[ply]) {
      verdicts.set(ply, { grade: 'best', judgement: null, better: null });
      continue;
    }
    const judgement = judgeMove(before.cp, after.cp, side);
    const grade = judgement ?? (lostChances(before.cp, after.cp, side) < GOOD_LOSS ? 'good' : 'correct');
    verdicts.set(ply, { grade, judgement, better: judgement ? best : null });
  }
  return verdicts;
}
