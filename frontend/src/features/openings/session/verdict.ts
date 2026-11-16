import { Chess } from 'chess.js';
import type { Evaluation } from '../domain/diagnosis';
import { judgeMove, type Judgement } from '../domain/judgement';
import type { SessionStep } from './steps';

/** Ce que le moteur dit du coup joué face aux coups du répertoire ; `cp` du point de vue du joueur. */
export type StepVerdict =
  | { kind: 'worse'; judgement: Judgement; best: string; cp: ReadonlyMap<string, number> }
  | { kind: 'equal' | 'better'; best: string; cp: ReadonlyMap<string, number> };

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

/** Le verdict, une fois toutes les positions évaluées ; seul un écart sortant de l'imprécision départage. */
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
  const worse = judgeMove(white.get(best)!, white.get(step.played)!, step.side);
  if (worse) return { kind: 'worse', judgement: worse, best, cp };
  const better = judgeMove(white.get(step.played)!, white.get(best)!, step.side);
  return { kind: better ? 'better' : 'equal', best, cp };
}

/** Un coup aussi bon que le répertoire, joué une seule fois : rien à trancher tant qu'il ne revient pas. */
export const isQuiet = (step: SessionStep) => step.kind === 'left' && step.verdict?.kind === 'equal' && step.games.length < 2;
