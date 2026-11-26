import { Chess } from 'chess.js';
import { isPlayerMove } from './openingTree';
import type { PlayedGame } from './playedGame';
import { positionKey, repertoireMovesAt, type Repertoire } from './repertoire';

/** `ply` compte depuis 0 : c'est l'index du coup dans la partie. */
export type GameCheck =
  | { kind: 'followed'; plies: number }
  | { kind: 'left'; ply: number; played: string; planned: string[]; position: string }
  | { kind: 'uncovered'; ply: number; played: string; planned: string[]; position: string };

/** Le contrôle d'une partie, et les positions où le joueur y a joué un coup de son répertoire. */
export function followGame(repertoire: Repertoire, game: PlayedGame): { check: GameCheck; answered: string[] } {
  const chess = new Chess();
  const answered: string[] = [];
  for (const [ply, played] of game.moves.entries()) {
    const fen = chess.fen();
    const planned = repertoireMovesAt(repertoire, fen).map((move) => move.san);
    if (planned.length === 0) return { check: { kind: 'followed', plies: ply }, answered };
    const byPlayer = isPlayerMove(game.side, ply + 1);
    if (!planned.includes(played)) {
      const position = positionKey(fen);
      return { check: { kind: byPlayer ? 'left' : 'uncovered', ply, played, planned, position }, answered };
    }
    if (byPlayer) answered.push(positionKey(fen));
    chess.move(played);
  }
  return { check: { kind: 'followed', plies: game.moves.length }, answered };
}

export const checkGame = (repertoire: Repertoire, game: PlayedGame): GameCheck => followGame(repertoire, game).check;

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
