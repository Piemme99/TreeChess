import { Chess } from 'chess.js';
import type { PlayedGame, Side } from './playedGame';
import { positionKey, repertoireMovesAt, type Repertoire } from './repertoire';

/** Un coup du répertoire que le joueur ne joue plus, et ce qu'il a joué à la place les dernières fois. */
export interface StoppedMove {
  side: Side;
  position: string;
  san: string;
  /** Le chemin d'une des dernières parties jusqu'à la position. */
  path: string[];
  playedInstead: string[];
}

/** Un coup que le joueur garde alors qu'on lui proposait de le retirer. */
export interface KeptMove {
  side: Side;
  position: string;
  san: string;
  keptAt: string;
}

// Compté en parties, jamais en mois : un joueur qui s'arrête de jouer ne perd rien de son répertoire.
export const STOPPED_ARRIVALS = 5;
const MAX_PLIES = 40;

interface Trie {
  /** Les parties passées par ce nœud, par rang chronologique croissant. */
  games: number[];
  children: Map<string, Trie>;
}

interface Arrival {
  rank: number;
  played: string;
  path: string[];
}

// Les parties fusionnées coup par coup, sans chess.js : le rejouer sur des milliers de parties coûterait des secondes.
const tries = new WeakMap<readonly PlayedGame[], { ordered: PlayedGame[]; roots: Record<Side, Trie> }>();

function trieOf(games: readonly PlayedGame[]) {
  const known = tries.get(games);
  if (known) return known;
  const ordered = [...games].sort((a, b) => a.playedAt.localeCompare(b.playedAt));
  const roots: Record<Side, Trie> = { w: { games: [], children: new Map() }, b: { games: [], children: new Map() } };
  for (const [rank, game] of ordered.entries()) {
    let node = roots[game.side];
    node.games.push(rank);
    for (const san of game.moves.slice(0, MAX_PLIES)) {
      let child = node.children.get(san);
      if (!child) node.children.set(san, (child = { games: [], children: new Map() }));
      child.games.push(rank);
      node = child;
    }
  }
  const built = { ordered, roots };
  tries.set(games, built);
  return built;
}

/**
 * Les coups du joueur qu'il n'a plus joués les `STOPPED_ARRIVALS` dernières fois qu'il est arrivé à leur position en
 * suivant son répertoire. Un coup ajouté après la création (`createdAt`) ne compte que les parties d'après son ajout.
 * Un coup gardé ne revient qu'une fois rejoué puis délaissé à nouveau : le joueur qui alterne deux ouvertures par
 * séries ne se le voit pas reproposer à chaque série.
 */
export function stoppedMoves(repertoire: Repertoire, games: readonly PlayedGame[], createdAt: string, kept: readonly KeptMove[] = []): StoppedMove[] {
  const { ordered, roots } = trieOf(games);
  const arrivals = new Map<string, Arrival[]>();
  const walk = (node: Trie, chess: Chess, path: string[]) => {
    const fen = chess.fen();
    const planned = repertoireMovesAt(repertoire, fen);
    if (!planned.length || path.length >= MAX_PLIES) return;
    const key = positionKey(fen);
    if (chess.turn() === repertoire.side) {
      // Une position atteinte par deux ordres de coups compte les parties des deux.
      const known = arrivals.get(key) ?? [];
      for (const [played, child] of node.children) for (const rank of child.games) known.push({ rank, played, path });
      arrivals.set(key, known);
    }
    for (const move of planned) {
      const child = node.children.get(move.san);
      if (!child) continue;
      chess.move(move.san);
      walk(child, chess, [...path, move.san]);
      chess.undo();
    }
  };
  walk(roots[repertoire.side], new Chess(), []);

  const stopped: StoppedMove[] = [];
  for (const [position, found] of arrivals) {
    const all = found.sort((a, b) => a.rank - b.rank);
    for (const { san, addedAt } of repertoire.moves.get(position) ?? []) {
      const keptAt = kept.find((move) => move.side === repertoire.side && move.position === position && move.san === san)?.keptAt;
      const since = [keptAt ?? '', addedAt > createdAt ? addedAt : ''].sort().at(-1)!;
      const counted = since ? all.filter((arrival) => ordered[arrival.rank].playedAt > since) : all;
      if (keptAt && !counted.some((arrival) => arrival.played === san)) continue;
      const last = counted.slice(-STOPPED_ARRIVALS);
      if (last.length < STOPPED_ARRIVALS || last.some((arrival) => arrival.played === san)) continue;
      stopped.push({ side: repertoire.side, position, san, path: last[last.length - 1].path, playedInstead: last.map((arrival) => arrival.played) });
    }
  }
  return stopped;
}
