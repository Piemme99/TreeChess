import { Chess } from 'chess.js';
import { isPlayerMove } from './openingTree';
import type { PlayedGame } from './playedGame';
import { positionKey, repertoireMovesAt, type Repertoire } from './repertoire';

/** `ply` compte depuis 0 : c'est l'index du coup dans la partie. */
export type GameCheck =
  | { kind: 'followed'; plies: number }
  | { kind: 'left'; ply: number; played: string; planned: string[]; position: string }
  | { kind: 'uncovered'; ply: number; played: string; planned: string[]; position: string };

export function checkGame(repertoire: Repertoire, game: PlayedGame): GameCheck {
  const chess = new Chess();
  for (const [ply, played] of game.moves.entries()) {
    const planned = repertoireMovesAt(repertoire, chess.fen()).map((move) => move.san);
    if (planned.length === 0) return { kind: 'followed', plies: ply };
    if (!planned.includes(played)) {
      const position = positionKey(chess.fen());
      return { kind: isPlayerMove(game.side, ply + 1) ? 'left' : 'uncovered', ply, played, planned, position };
    }
    chess.move(played);
  }
  return { kind: 'followed', plies: game.moves.length };
}

/**
 * Pour des parties dans l'ordre où elles ont été jouées, lesquelles demandent une décision au joueur.
 * Un coup adverse hors répertoire n'en demande qu'à sa deuxième rencontre : une seule peut être un hasard.
 */
export function asksDecision(checked: readonly { game: PlayedGame; check: GameCheck }[]): boolean[] {
  const met = new Map<string, number>();
  return checked.map(({ game, check }) => {
    if (check.kind === 'followed') return false;
    if (check.kind === 'left') return true;
    const key = `${game.side} ${check.position} ${check.played}`;
    const times = (met.get(key) ?? 0) + 1;
    met.set(key, times);
    return times >= 2;
  });
}
