import { Chess } from 'chess.js';

export interface ReplayedLine {
  fens: string[];
  lastMove: { from: string; to: string } | null;
}

export function replayLine(path: readonly string[]): ReplayedLine {
  const chess = new Chess();
  const fens = [chess.fen()];
  let lastMove: ReplayedLine['lastMove'] = null;
  for (const san of path) {
    const { from, to } = chess.move(san);
    fens.push(chess.fen());
    lastMove = { from, to };
  }
  return { fens, lastMove };
}
