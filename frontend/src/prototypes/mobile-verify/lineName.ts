// PROTOTYPE JETABLE
import { useMemo } from 'react';
import { replayLine } from '../../features/openings/position/replay';
import { useOpeningName } from '../../shared/hooks/useOpeningName';
import { formatMove } from '../../features/openings/domain/notation';

export function useLineName(path: readonly string[]): string {
  const fens = useMemo(() => replayLine(path).fens, [path]);
  return useOpeningName(fens)?.name ?? 'Opening';
}

export const SIDE_LABEL = { w: 'White', b: 'Black' } as const;
export const RESULT_LABEL = { 0: 'Lost', 0.5: 'Draw', 1: 'Won' } as const;

export function formatFrom(path: readonly string[], from: number): string {
  return path
    .slice(from)
    .map((san, index) => {
      const ply = from + index + 1;
      return ply % 2 === 1 || index === 0 ? formatMove(san, ply) : san;
    })
    .join(' ');
}

export function moveNumber(ply: number) {
  return Math.floor(ply / 2) + 1;
}
