import { Chess } from 'chess.js';
import type { MoveSource, PreparedMove } from './preparation';
import { positionKey, type Repertoire, type RepertoireMove } from './repertoire';

export interface AddedMove {
  position: string;
  san: string;
  source: MoveSource;
}

/** Un ajout accepté par le joueur, daté du jour où il l'a accepté. */
export interface Addition {
  side: Repertoire['side'];
  addedAt: string;
  moves: AddedMove[];
}

/**
 * Les coups d'une proposition d'ajout : le coup qui l'ouvre (joué à la fin de `path`), puis la
 * préparation qui le suit, sans les branches coupées par le joueur (`cut`, chemins joints par des espaces).
 */
export function additionMoves(
  path: readonly string[],
  opening: { san: string; source: MoveSource },
  prepared: readonly PreparedMove[],
  cut: ReadonlySet<string>,
): AddedMove[] {
  const chess = new Chess();
  for (const san of path) chess.move(san);
  const moves: AddedMove[] = [{ position: positionKey(chess.fen()), san: opening.san, source: opening.source }];
  chess.move(opening.san);

  const walk = (branch: readonly PreparedMove[], line: readonly string[]) => {
    const fen = chess.fen();
    for (const move of branch) {
      const next = [...line, move.san];
      if (cut.has(next.join(' '))) continue;
      // Un coup adverse n'a pas de source propre : rencontré par le joueur, c'est une habitude, sinon son niveau.
      const source: MoveSource = move.source ?? (move.mine > 0 ? 'habit' : 'level');
      moves.push({ position: positionKey(fen), san: move.san, source });
      chess.load(fen);
      chess.move(move.san);
      walk(move.next, next);
      chess.load(fen);
    }
  };
  walk(prepared, [...path, opening.san]);
  return moves;
}

export function withAdditions(repertoire: Repertoire, additions: readonly Addition[]): Repertoire {
  const moves = new Map<string, readonly RepertoireMove[]>(repertoire.moves);
  for (const addition of additions) {
    if (addition.side !== repertoire.side) continue;
    for (const { position, san, source } of addition.moves) {
      const known = moves.get(position) ?? [];
      if (!known.some((move) => move.san === san)) moves.set(position, [...known, { san, source, addedAt: addition.addedAt }]);
    }
  }
  return { side: repertoire.side, moves };
}
