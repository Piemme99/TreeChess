import { useMemo } from 'react';
import { ENGINE_DEPTH } from '../checks/useCandidates';
import { useEngineFailed, useEvaluations } from '../line/engine';
import type { SessionStep } from './steps';
import { isQuiet, judgeStep, verdictFens } from './verdict';

/**
 * Les étapes avec l'avis du moteur, sans celles qui n'ont rien à trancher. Un écart joué une seule fois attend
 * son verdict avant d'apparaître : montré puis retiré, il ferait bouger les compteurs sous les yeux du joueur.
 */
export function useJudgedSteps(steps: readonly SessionStep[]): { steps: SessionStep[]; judging: boolean } {
  const fens = useMemo(() => steps.filter((step) => step.kind === 'left').flatMap((step) => [...verdictFens(step).values()]), [steps]);
  const evaluations = useEvaluations(fens, ENGINE_DEPTH);
  // Sans moteur, on ne saurait jamais : mieux vaut tout montrer que taire un oubli.
  const blind = useEngineBlind();
  return useMemo(() => {
    const judged = steps.map((step) => (step.kind === 'left' ? { ...step, verdict: judgeStep(step, evaluations) } : step));
    const waiting = (step: SessionStep) => !blind && step.kind === 'left' && !step.verdict && step.games.length < 2;
    return { steps: judged.filter((step) => !isQuiet(step) && !waiting(step)), judging: judged.some(waiting) };
  }, [steps, evaluations, blind]);
}

/** Ni Stockfish ni le nuage Lichess ne répondront : aucun verdict n'arrivera. */
export const useEngineBlind = () => useEngineFailed() || typeof Worker === 'undefined';
