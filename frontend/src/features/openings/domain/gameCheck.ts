import { Chess } from 'chess.js';
import { isPlayerMove } from './openingTree';
import type { PlayedGame } from './playedGame';
import { repertoireMovesAt, type Repertoire } from './repertoire';

/** `ply` compte depuis 0 : c'est l'index du coup dans la partie. */
export type GameCheck =
  | { kind: 'followed'; plies: number }
  | { kind: 'left'; ply: number; played: string; planned: string[] }
  | { kind: 'uncovered'; ply: number; played: string; planned: string[] };

export function checkGame(repertoire: Repertoire, game: PlayedGame): GameCheck {
  const chess = new Chess();
  for (const [ply, played] of game.moves.entries()) {
    const planned = repertoireMovesAt(repertoire, chess.fen()).map((move) => move.san);
    if (planned.length === 0) return { kind: 'followed', plies: ply };
    if (!planned.includes(played)) {
      return { kind: isPlayerMove(game.side, ply + 1) ? 'left' : 'uncovered', ply, played, planned };
    }
    chess.move(played);
  }
  return { kind: 'followed', plies: game.moves.length };
}
