// PROTOTYPE JETABLE
import { useMemo } from 'react';
import { Chess } from 'chess.js';
import { replayLine } from '../../features/openings/position/replay';
import { useOpeningName } from '../../shared/hooks/useOpeningName';

export function useLineName(path: readonly string[]): string {
  const fens = useMemo(() => replayLine(path).fens, [path]);
  return useOpeningName(fens)?.name ?? 'Opening';
}

export const SIDE_LABEL = { w: 'White', b: 'Black' } as const;
export const RESULT_LABEL = { 0: 'Lost', 0.5: 'Draw', 1: 'Won' } as const;

export function moveNumber(ply: number) {
  return Math.floor(ply / 2) + 1;
}

export const ARROW = {
  played: '#DC2626',
  prep: '#6B8E23',
  opponent: '#6B7280',
  noPrep: '#E67E22',
} as const;

export type Arrow = [string, string, string];

export function arrowFor(path: readonly string[], san: string, color: string): Arrow {
  const chess = new Chess(replayLine(path).fens.at(-1));
  const { from, to } = chess.move(san);
  return [from, to, color];
}
