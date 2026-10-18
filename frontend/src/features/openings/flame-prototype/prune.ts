// PROTOTYPE — mise en page du flame graph avec élagage : les lignes trop étroites pour être
// lues sont fondues dans une tuile « reste » par parent, et les rangées presque vides ne sont
// pas dessinées. Les seuils sont en pixels, donc dépendent du zoom.
import { isPlayerMove, type OpeningNode } from '../domain/openingTree';
import type { Side } from '../domain/playedGame';

export interface PlacedTile {
  key: string;
  path: readonly string[];
  node: OpeningNode;
  depth: number;
  start: number;
  width: number;
  /** Nombre de lignes fondues dans cette tuile ; 0 pour une vraie ligne. */
  rest: number;
  /** Coup adverse qui précède, quand une tuile résume une paire (coup adverse, réponse). */
  via: string | null;
  /** Dernière tuile de son groupe adverse : on la sépare un peu plus de la suivante. */
  groupEnd: boolean;
}

export interface PruneOptions {
  widthPx: number;
  minPx: number;
  coverageFloor: number;
  minRows: number;
  maxRows: number;
}

interface Candidate {
  node: OpeningNode;
  path: readonly string[];
  via: string | null;
}

export const keyOf = (path: readonly string[]) => path.join(' ');

const restNode = (members: readonly OpeningNode[]): OpeningNode => ({
  san: null,
  games: members.reduce((sum, node) => sum + node.games, 0),
  score: members.reduce((sum, node) => sum + node.score, 0),
  children: [],
});

/**
 * Range les candidats sous leur parent, dans l'ordre donné ; ceux qui tomberaient sous
 * `minFraction` de la largeur totale forment une seule tuile « reste », en fin de rangée.
 */
export function packRow(
  candidates: readonly Candidate[],
  parent: PlacedTile,
  depth: number,
  minFraction: number,
): PlacedTile[] {
  const perGame = parent.width / parent.node.games;
  const kept: PlacedTile[] = [];
  const dropped: OpeningNode[] = [];
  let cursor = parent.start;

  candidates.forEach((candidate, index) => {
    const width = candidate.node.games * perGame;
    if (width < minFraction) {
      dropped.push(candidate.node);
      return;
    }
    const next = candidates[index + 1];
    kept.push({
      key: keyOf(candidate.path),
      path: candidate.path,
      node: candidate.node,
      depth,
      start: cursor,
      width,
      rest: 0,
      via: candidate.via,
      groupEnd: next === undefined || next.via !== candidate.via,
    });
    cursor += width;
  });

  if (dropped.length > 0) {
    const node = restNode(dropped);
    kept.push({
      key: `${parent.key} …`,
      path: parent.path,
      node,
      depth,
      start: cursor,
      width: node.games * perGame,
      rest: dropped.length,
      via: null,
      groupEnd: true,
    });
  }
  return kept;
}

/** Une rangée par demi-coup, comme le flame graph actuel. */
export const halfMoveStep = (node: OpeningNode, path: readonly string[]): Candidate[] =>
  node.children.map((child) => ({ node: child, path: [...path, child.san!], via: null }));

/**
 * Une rangée par coup du joueur : une tuile = (coup adverse, réponse du joueur). Quand le
 * prochain demi-coup est au joueur, la tuile ne porte que sa réponse.
 */
export const playerMoveStep =
  (side: Side) =>
  (node: OpeningNode, path: readonly string[]): Candidate[] => {
    if (isPlayerMove(side, path.length + 1)) return halfMoveStep(node, path);
    return node.children.flatMap((opponent) =>
      opponent.children.map((reply) => ({
        node: reply,
        path: [...path, opponent.san!, reply.san!],
        via: opponent.san,
      })),
    );
  };

/**
 * Le focus occupe toute la largeur ; chaque rangée suivante est construite depuis les vraies
 * lignes de la précédente. On s'arrête quand la rangée couvre moins de `coverageFloor` de la
 * largeur (après `minRows`), ou à `maxRows`.
 */
export function layoutPruned(
  focus: OpeningNode,
  focusPath: readonly string[],
  step: (node: OpeningNode, path: readonly string[]) => Candidate[],
  options: PruneOptions,
): PlacedTile[] {
  if (focus.games === 0) return [];
  const minFraction = options.minPx / Math.max(options.widthPx, 1);
  const root: PlacedTile = {
    key: keyOf(focusPath),
    path: focusPath,
    node: focus,
    depth: 0,
    start: 0,
    width: 1,
    rest: 0,
    via: null,
    groupEnd: true,
  };

  const tiles = [root];
  let row = [root];
  for (let depth = 1; depth < options.maxRows; depth++) {
    const next = row.flatMap((parent) => (parent.rest ? [] : packRow(step(parent.node, parent.path), parent, depth, minFraction)));
    const coverage = next.reduce((sum, tile) => sum + (tile.rest ? 0 : tile.width), 0);
    if (next.length === 0 || (depth > options.minRows && coverage < options.coverageFloor)) break;
    tiles.push(...next);
    row = next;
  }
  return tiles;
}

export interface Mark {
  rank: number;
  /** La priorité est exactement cette tuile, et non quelque part dessous. */
  exact: boolean;
}

/**
 * Chaque priorité est posée sur la tuile visible la plus profonde qui la contient : la
 * tuile elle-même quand elle est dessinée, sinon l'ancêtre sous lequel elle se cache.
 */
export function marksFor(
  tiles: readonly PlacedTile[],
  priorities: readonly { path: readonly string[] }[],
): Map<string, Mark> {
  const marks = new Map<string, Mark>();
  priorities.forEach((priority, index) => {
    const target = priority.path.join(' ');
    let best: PlacedTile | undefined;
    for (const tile of tiles) {
      if (tile.rest) continue;
      const key = keyOf(tile.path);
      const contains = target === key || target.startsWith(`${key} `) || key === '';
      if (contains && (!best || tile.depth > best.depth)) best = tile;
    }
    if (!best) return;
    const exact = keyOf(best.path) === target;
    // Cachée dans une tuile « reste » : le point va sur cette tuile, pas sur le parent.
    const rest = exact ? undefined : tiles.find((tile) => tile.rest && tile.key === `${best.key} …`);
    const carrier = rest ?? best;
    if (carrier.depth === 0) return;
    const existing = marks.get(carrier.key);
    if (existing && existing.rank < index + 1) return;
    marks.set(carrier.key, { rank: index + 1, exact });
  });
  return marks;
}
