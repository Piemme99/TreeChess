import { Chess } from 'chess.js';
import { buildOpeningTree, isPlayerMove, type OpeningNode, type OpeningTree } from './openingTree';
import { gamesOfLastMonths } from './period';
import type { PlayedGame, Side } from './playedGame';
import type { MoveSource } from './preparation';

export interface RepertoireMove {
  san: string;
  source: MoveSource;
  /** Date ISO de l'ajout au répertoire. */
  addedAt: string;
}

/** Les coups prévus, rangés par position : deux ordres de coups qui transposent partagent leurs coups. */
export interface Repertoire {
  side: Side;
  moves: ReadonlyMap<string, readonly RepertoireMove[]>;
}

const HABIT_MONTHS = 12;
// Un coup du joueur est un choix : il faut qu'il pèse. Un coup adverse se subit : il suffit qu'il revienne.
const MIN_SHARE = 0.2;
const MIN_GAMES = 5;
const MAX_PLIES = 40;

const START = new Chess().fen();

// Les compteurs de coups changent d'un ordre de coups à l'autre : ils ne font pas partie de la position.
export const positionKey = (fen: string) => fen.split(' ').slice(0, 4).join(' ');

const fenAfter = (fen: string, san: string) => {
  const chess = new Chess(fen);
  chess.move(san);
  return chess.fen();
};

export function createRepertoire(games: readonly PlayedGame[], side: Side, today: string): Repertoire {
  const habits = gamesOfLastMonths(games, HABIT_MONTHS, new Date(today)).filter((game) => game.playedAt < today);
  const moves = new Map<string, RepertoireMove[]>();

  const walk = (node: OpeningNode, fen: string, ply: number) => {
    const chosen = isPlayerMove(side, ply + 1);
    for (const child of node.children) {
      if (child.games < MIN_GAMES || (chosen && child.games / node.games < MIN_SHARE)) continue;
      const key = positionKey(fen);
      const known = moves.get(key) ?? [];
      if (!known.some((move) => move.san === child.san)) moves.set(key, [...known, { san: child.san!, source: 'habit', addedAt: today }]);
      walk(child, fenAfter(fen, child.san!), ply + 1);
    }
  };
  walk(buildOpeningTree(habits, side, MAX_PLIES).root, START, 0);

  return { side, moves };
}

export function repertoireMovesAt(repertoire: Repertoire, fen: string): readonly RepertoireMove[] {
  return repertoire.moves.get(positionKey(fen)) ?? [];
}

/** Les lignes de l'arbre restées dans le répertoire de bout en bout, chemins joints par des espaces. */
export function repertoireLines(repertoire: Repertoire, tree: OpeningTree): ReadonlySet<string> {
  const lines = new Set<string>();
  const walk = (node: OpeningNode, fen: string, path: readonly string[]) => {
    const planned = repertoireMovesAt(repertoire, fen);
    for (const child of node.children) {
      if (!planned.some((move) => move.san === child.san)) continue;
      const next = [...path, child.san!];
      lines.add(next.join(' '));
      walk(child, fenAfter(fen, child.san!), next);
    }
  };
  walk(tree.root, START, []);
  return lines;
}
