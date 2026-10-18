import { Chess } from 'chess.js';
import type { Tone } from '../flame/tone';
import { ARROW, COLOURS } from '../workshop/theme';

const SMOOTHING_GAMES = 12;
// Le seuil de 20 parties du flame graph éteindrait presque toute une ligne étudiée : le lissage suffit ici.
const MIN_TONED_GAMES = 5;
// Au-delà de trois flèches, le plateau devient illisible : la ligne, puis les coups les plus joués.
const MAX_ARROWS = 3;

export function moveTone(rate: number, games: number, average: number): Tone {
  if (games < MIN_TONED_GAMES) return 'even';
  const gap = (average - rate) * (games / (games + SMOOTHING_GAMES));
  if (gap >= 0.1) return 'losing';
  if (gap >= 0.05) return 'slipping';
  if (gap <= -0.05) return 'winning';
  return 'even';
}

export const INK: Record<Tone, string> = {
  losing: COLOURS.terracotta,
  slipping: COLOURS.kumquatDeep,
  even: ARROW.neutral.colour,
  winning: 'oklch(0.50 0.12 148)',
};


export function arrowMoves<T extends { onLine: boolean }>(moves: readonly T[]): T[] {
  return [...moves.filter((move) => move.onLine), ...moves.filter((move) => !move.onLine)].slice(0, MAX_ARROWS);
}

export function arrowSquares(path: readonly string[], sans: readonly string[]): { from: string; to: string }[] {
  const chess = new Chess();
  for (const san of path) chess.move(san);
  return sans.map((san) => {
    const { from, to } = chess.move(san);
    chess.undo();
    return { from, to };
  });
}
