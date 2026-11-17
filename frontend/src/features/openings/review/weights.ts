import { Chess } from 'chess.js';
import type { CheckedGame } from '../checks/checkedGame';
import { buildOpeningTree, type OpeningNode } from '../domain/openingTree';
import type { PlayedGame, Side } from '../domain/playedGame';
import { positionKey, type Repertoire } from '../domain/repertoire';

// Une position manquée en partie passe devant ; un ajout récent devant le reste. La part de parties, au plus 1,
// ne départage qu'à rang égal : les rangs sont écartés d'au moins 2.
const LAPSE_WEIGHT = 10;
const ADDITION_WEIGHT = 3;
const MAX_PLIES = 40;
// Comme pour le répertoire : en dessous, la part ne départage presque rien et l'arbre, fait surtout de ces branches, coûte cher à rejouer.
const MIN_GAMES = 5;

/** Les positions où le joueur a quitté son répertoire en partie, avec le jour du dernier oubli. */
export function lapsesOf(lived: readonly CheckedGame[]): Record<Side, Map<string, string>> {
  const found: Record<Side, Map<string, string>> = { w: new Map(), b: new Map() };
  for (const { game, check } of lived) if (check.kind === 'left') found[game.side].set(check.position, game.playedAt);
  return found;
}

/** Pour chaque position où le joueur a le trait, la part de ses parties de ce côté qui y passent. */
export function encountersOf(games: readonly PlayedGame[], side: Side): Map<string, number> {
  const tree = buildOpeningTree(games, side, MAX_PLIES);
  if (!tree.root.games) return new Map();
  const counts = new Map<string, number>();
  const chess = new Chess();
  const walk = (node: OpeningNode) => {
    if (chess.turn() === side) {
      const key = positionKey(chess.fen());
      counts.set(key, (counts.get(key) ?? 0) + node.games);
    }
    for (const child of node.children) {
      if (child.games < MIN_GAMES) continue;
      chess.move(child.san!);
      walk(child);
      chess.undo();
    }
  };
  walk(tree.root);
  // Une répétition dans une même partie la ferait compter deux fois.
  return new Map([...counts].map(([key, count]) => [key, Math.min(1, count / tree.root.games)]));
}

/** Le poids d'une position dans le choix de la prochaine ligne à réviser ; `since` : début des ajouts récents. */
export const reviewWeight =
  (lapses: ReadonlyMap<string, string>, encounters: ReadonlyMap<string, number>, repertoire: Repertoire, since: string) =>
  (key: string): number => {
    const rank = lapses.has(key) ? LAPSE_WEIGHT : repertoire.moves.get(key)?.some((move) => move.addedAt > since) ? ADDITION_WEIGHT : 1;
    return rank + (encounters.get(key) ?? 0);
  };
