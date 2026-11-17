import { Chess } from 'chess.js';
import type { Tone } from '../flame/tone';
import { ARROW, COLOURS } from '../workshop/theme';

export const INK: Record<Tone, string> = {
  losing: COLOURS.terracotta,
  slipping: COLOURS.kumquatDeep,
  even: ARROW.neutral.colour,
  winning: 'oklch(0.50 0.12 148)',
};

export function arrowSquares(path: readonly string[], sans: readonly string[]): { from: string; to: string }[] {
  const chess = new Chess();
  for (const san of path) chess.move(san);
  return sans.map((san) => {
    const { from, to } = chess.move(san);
    chess.undo();
    return { from, to };
  });
}
