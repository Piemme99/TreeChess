import { winChance } from './diagnosis';
import type { Side } from './playedGame';

export type Judgement = 'inaccuracy' | 'mistake' | 'blunder';

export const JUDGEMENT_MARK: Record<Judgement, string> = { inaccuracy: '?!', mistake: '?', blunder: '??' };

// Seuils de Lichess (0,1 / 0,2 / 0,3 sur des chances comptées de −1 à 1), ramenés à nos chances de 0 à 1.
const THRESHOLDS: [Judgement, number][] = [
  ['blunder', 0.15],
  ['mistake', 0.1],
  ['inaccuracy', 0.05],
];

/** Ce que vaut un coup pour celui qui le joue, d'après l'évaluation avant et après (centipions des Blancs). */
export function judgeMove(before: number, after: number, mover: Side): Judgement | null {
  const lost = mover === 'w' ? winChance(before) - winChance(after) : winChance(after) - winChance(before);
  return THRESHOLDS.find(([, threshold]) => lost >= threshold)?.[0] ?? null;
}
