import { useMemo } from 'react';
import { ENGINE_DEPTH } from '../checks/useCandidates';
import { useEngineFailed, useEvaluations } from '../services/engine';
import type { SessionStep } from './steps';
import { settleSteps, verdictFens } from './verdict';

export function useJudgedSteps(steps: readonly SessionStep[]): { steps: SessionStep[]; adopted: SessionStep[]; judging: boolean } {
  const fens = useMemo(() => steps.filter((step) => step.kind === 'left').flatMap((step) => [...verdictFens(step).values()]), [steps]);
  const evaluations = useEvaluations(fens, ENGINE_DEPTH);
  const blind = useEngineBlind();
  return useMemo(() => settleSteps(steps, evaluations, blind), [steps, evaluations, blind]);
}

/** Ni Stockfish ni le nuage Lichess ne répondront : aucun verdict n'arrivera. */
export const useEngineBlind = () => useEngineFailed() || typeof Worker === 'undefined';
