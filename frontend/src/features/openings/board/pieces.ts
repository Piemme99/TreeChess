// Donne une identité stable à chaque pièce le long d'une ligne, pour que
// passer d'une position à une autre fasse glisser les pièces au lieu de les redessiner.
import { Chess, type Square } from 'chess.js';

export interface PlacedPiece {
  id: string;
  code: string;
  file: number;
  rank: number;
}

export interface PlacedLine {
  pieces: PlacedPiece[];
  lastMove: { from: Square; to: Square } | null;
}

const ROOK_HOPS: Record<string, [Square, Square]> = {
  wk: ['h1', 'f1'],
  wq: ['a1', 'd1'],
  bk: ['h8', 'f8'],
  bq: ['a8', 'd8'],
};

export function placeLine(path: readonly string[]): PlacedLine {
  const chess = new Chess();
  const ids = new Map<string, string>();
  for (const row of chess.board()) {
    for (const cell of row) if (cell) ids.set(cell.square, `${cell.color}${cell.type}-${cell.square}`);
  }

  let lastMove: PlacedLine['lastMove'] = null;
  for (const san of path) {
    const move = chess.move(san);
    if (move.flags.includes('e')) ids.delete(`${move.to[0]}${move.from[1]}`);
    ids.delete(move.to);
    ids.set(move.to, ids.get(move.from)!);
    ids.delete(move.from);
    for (const flag of ['k', 'q']) {
      if (!move.flags.includes(flag)) continue;
      const [rookFrom, rookTo] = ROOK_HOPS[`${move.color}${flag}`];
      ids.set(rookTo, ids.get(rookFrom)!);
      ids.delete(rookFrom);
    }
    lastMove = { from: move.from, to: move.to };
  }

  const pieces: PlacedPiece[] = [];
  for (const row of chess.board()) {
    for (const cell of row) {
      if (!cell) continue;
      pieces.push({
        id: ids.get(cell.square)!,
        code: `${cell.color}${cell.type.toUpperCase()}`,
        file: cell.square.charCodeAt(0) - 97,
        rank: Number(cell.square[1]) - 1,
      });
    }
  }
  return { pieces, lastMove };
}

export const squareCoords = (square: string) => ({
  file: square.charCodeAt(0) - 97,
  rank: Number(square[1]) - 1,
});
