// PROTOTYPE — préparation prolongée depuis la position clé, tirée des parties du joueur. À jeter avec le dossier.
import { Chess } from 'chess.js';
import type { PlayedGame, Side } from '../domain/playedGame';
import { sanOf, winChance } from './diagnosis';
import type { Evaluation } from './engine';

export interface PrepMove {
  san: string;
  /** Rang du demi-coup dans la partie, à partir de 1. */
  ply: number;
  games: number;
  byPlayer: boolean;
  /** Coup du moteur qui remplace l'habitude du joueur, quand elle coûte trop. */
  replacement: { best: string; loss: number } | null;
  /** Rangée de coups adverses qui suivent (ou la réponse du joueur, unique). */
  next: PrepMove[];
}

// Une suite vue une seule fois n'est pas une habitude de l'adversaire : la préparer, c'est réviser pour rien.
const MIN_GAMES = 2;
// Même seuil que « remplacée seulement là où le moteur la juge mauvaise » (CONTEXT.md, préparation proposée).
const REPLACE_LOSS = 0.05;
const MAX_PLIES = 16;

export function extendPreparation(
  games: readonly PlayedGame[],
  keyPath: readonly string[],
  side: Side,
  evaluations: Map<string, Evaluation>,
): PrepMove[] {
  const pov = (cp: number) => winChance(side === 'w' ? cp : -cp);

  const grow = (path: readonly string[], reaching: readonly PlayedGame[]): PrepMove[] => {
    const ply = path.length;
    if (ply - keyPath.length >= MAX_PLIES || reaching.length < MIN_GAMES) return [];
    const byMove = new Map<string, PlayedGame[]>();
    for (const game of reaching) {
      const san = game.moves[ply];
      if (san) byMove.set(san, [...(byMove.get(san) ?? []), game]);
    }
    const ranked = [...byMove.entries()].sort((a, b) => b[1].length - a[1].length);
    const byPlayer = (ply % 2 === 0) === (side === 'w');

    if (!byPlayer) {
      return ranked
        .filter(([, followed]) => followed.length >= MIN_GAMES)
        .map(([san, followed]) => ({ san, ply: ply + 1, games: followed.length, byPlayer, replacement: null, next: grow([...path, san], followed) }));
    }

    const [habit] = ranked;
    if (!habit) return [];
    const [san, followed] = habit;
    const chess = new Chess();
    path.forEach((move) => chess.move(move));
    const before = chess.fen();
    chess.move(san);
    const atBefore = evaluations.get(before);
    const atAfter = evaluations.get(chess.fen());
    const loss = atBefore && atAfter ? pov(atBefore.cp) - pov(atAfter.cp) : 0;
    const best = loss >= REPLACE_LOSS ? sanOf(before, atBefore?.best) : null;
    return [
      {
        san,
        ply: ply + 1,
        games: followed.length,
        byPlayer,
        replacement: best ? { best, loss } : null,
        next: best ? [] : grow([...path, san], followed),
      },
    ];
  };

  return grow(keyPath, games);
}

/** Dernier coup préparé, toutes branches confondues : jusqu'où les parties du joueur se recoupent. */
export function preparedUntil(moves: readonly PrepMove[]): number {
  return moves.reduce((deepest, move) => Math.max(deepest, move.ply, preparedUntil(move.next)), 0);
}
