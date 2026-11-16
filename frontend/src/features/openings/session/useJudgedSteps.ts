import { useMemo } from 'react';
import { ENGINE_DEPTH } from '../checks/useCandidates';
import { useEngineFailed, useEvaluations } from '../line/engine';
import type { SessionStep } from './steps';
import { isAdopted, isSound, judgeStep, verdictFens } from './verdict';

/**
 * Les étapes avec l'avis du moteur. Seules restent les erreurs : un coup sain joué une fois n'a rien à trancher,
 * rejoué il est `adopted`. Un écart attend son verdict avant d'apparaître : montré puis retiré, il ferait bouger
 * les compteurs sous les yeux du joueur.
 */
export function useJudgedSteps(steps: readonly SessionStep[]): { steps: SessionStep[]; adopted: SessionStep[]; judging: boolean } {
  const fens = useMemo(() => steps.filter((step) => step.kind === 'left').flatMap((step) => [...verdictFens(step).values()]), [steps]);
  const evaluations = useEvaluations(fens, ENGINE_DEPTH);
  // Sans moteur, on ne saurait jamais : mieux vaut tout montrer que taire un oubli.
  const blind = useEngineBlind();
  return useMemo(() => {
    const judged = steps.map((step) => (step.kind === 'left' ? { ...step, verdict: judgeStep(step, evaluations) } : step));
    const waiting = (step: SessionStep) => !blind && step.kind === 'left' && !step.verdict;
    const judging = judged.some(waiting);
    return {
      steps: judged.filter((step) => !waiting(step) && !isSound(step)),
      // Tout le lot d'un coup : le jour qui commence l'annonce en une fois.
      adopted: judging ? [] : judged.filter(isAdopted),
      judging,
    };
  }, [steps, evaluations, blind]);
}

/** Ni Stockfish ni le nuage Lichess ne répondront : aucun verdict n'arrivera. */
export const useEngineBlind = () => useEngineFailed() || typeof Worker === 'undefined';
