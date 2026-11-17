import { Chess } from 'chess.js';

export interface Evaluation {
  /** Centipions du point de vue des Blancs ; un mat vaut ±MATE_CP. */
  cp: number;
  /** Meilleur coup en UCI, absent en fin de partie. */
  best?: string;
}

export const MATE_CP = 3000;

// Formule de Lichess : chances de gain à partir des centipions, calibrée sur ses parties tous niveaux.
export const winChance = (cp: number) => 1 / (1 + Math.exp(-0.00368208 * cp));

export function uciToSan(fen: string, uci: string | undefined): string | null {
  if (!uci || uci === '(none)') return null;
  try {
    return new Chess(fen).move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] }).san;
  } catch {
    return null;
  }
}
