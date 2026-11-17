import { Chess } from 'chess.js';
import type { Evaluation } from '../domain/diagnosis';
import { judgeMove, type Judgement } from '../domain/judgement';
import type { SessionStep } from './steps';

/** Ce que le moteur dit du coup joué face au meilleur coup du répertoire ; `cp` du point de vue du joueur. */
export interface StepVerdict {
  /** Absent quand le coup joué ne perd pas assez pour être une imprécision. */
  judgement: Judgement | null;
  best: string;
  cp: ReadonlyMap<string, number>;
}

// Rejoué, un coup sain n'est plus un écart : c'est un choix, qui entre au répertoire sans question.
const ADOPTED_AFTER = 2;

/** Les positions à évaluer : celle qu'atteint chaque coup en jeu, le joué et ceux du répertoire. */
export function verdictFens(step: SessionStep): Map<string, string> {
  const chess = new Chess();
  for (const san of step.path) chess.move(san);
  const before = chess.fen();
  const fens = new Map<string, string>();
  for (const san of [step.played, ...step.planned]) {
    const after = new Chess(before);
    after.move(san);
    fens.set(san, after.fen());
  }
  return fens;
}

/** Le verdict, une fois toutes les positions évaluées. */
export function judgeStep(step: SessionStep, evaluations: ReadonlyMap<string, Evaluation>): StepVerdict | undefined {
  const white = new Map<string, number>();
  for (const [san, fen] of verdictFens(step)) {
    const evaluation = evaluations.get(fen);
    if (!evaluation) return undefined;
    white.set(san, evaluation.cp);
  }
  const forPlayer = (value: number) => (step.side === 'w' ? value : -value);
  const best = [...step.planned].sort((a, b) => forPlayer(white.get(b)!) - forPlayer(white.get(a)!))[0];
  const cp = new Map([...white].map(([san, value]) => [san, forPlayer(value)]));
  return { judgement: judgeMove(white.get(best)!, white.get(step.played)!, step.side), best, cp };
}

/** Un écart du joueur que le moteur ne reproche pas : rien à trancher. */
export const isSound = (step: SessionStep) => step.kind === 'left' && step.verdict !== undefined && step.verdict.judgement === null;

export const isAdopted = (step: SessionStep) => isSound(step) && step.games.length >= ADOPTED_AFTER;

/**
 * Les étapes avec l'avis du moteur. Seules restent les erreurs : un coup sain joué une fois n'a rien à trancher,
 * rejoué il est `adopted`. Un écart attend son verdict avant d'apparaître : montré puis retiré, il ferait bouger
 * les compteurs sous les yeux du joueur. `blind` : aucun moteur ne répondra.
 */
export function settleSteps(
  steps: readonly SessionStep[],
  evaluations: ReadonlyMap<string, Evaluation>,
  blind: boolean,
): { steps: SessionStep[]; adopted: SessionStep[]; judging: boolean } {
  const judged = steps.map((step) => (step.kind === 'left' ? { ...step, verdict: judgeStep(step, evaluations) } : step));
  // Sans moteur, on ne saurait jamais : mieux vaut tout montrer que taire un oubli.
  const waiting = (step: SessionStep) => !blind && step.kind === 'left' && !step.verdict;
  const judging = judged.some(waiting);
  return {
    steps: judged.filter((step) => !waiting(step) && !isSound(step)),
    // Tout le lot d'un coup : le jour qui commence l'annonce en une fois.
    adopted: judging ? [] : judged.filter(isAdopted),
    judging,
  };
}
