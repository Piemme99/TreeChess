import type { OpeningNode } from '../domain/openingTree';

export interface PlacedTile {
  key: string;
  path: readonly string[];
  node: OpeningNode;
  depth: number;
  start: number;
  width: number;
  /** Lignes fondues dans cette tuile ; 0 pour une vraie ligne. */
  rest: number;
}

export interface PruneOptions {
  widthPx: number;
  /** Sous cette largeur une tuile ne se lit ni ne se clique : elle rejoint le « reste ». */
  minPx: number;
  /** Part de la largeur qu'une rangée doit couvrir pour être dessinée, passé `minRows`. */
  coverageFloor: number;
  minRows: number;
  maxRows: number;
}

export const keyOf = (path: readonly string[]) => path.join(' ');
export const restKeyOf = (parentKey: string) => `${parentKey} …`;

const restNode = (members: readonly OpeningNode[]): OpeningNode => ({
  san: null,
  games: members.reduce((sum, node) => sum + node.games, 0),
  score: members.reduce((sum, node) => sum + node.score, 0),
  children: [],
});

function packChildren(parent: PlacedTile, depth: number, minFraction: number): PlacedTile[] {
  const perGame = parent.width / parent.node.games;
  const kept: PlacedTile[] = [];
  const dropped: OpeningNode[] = [];
  let cursor = parent.start;

  for (const child of parent.node.children) {
    const width = child.games * perGame;
    if (width < minFraction) {
      dropped.push(child);
      continue;
    }
    const path = [...parent.path, child.san!];
    kept.push({ key: keyOf(path), path, node: child, depth, start: cursor, width, rest: 0 });
    cursor += width;
  }

  if (dropped.length > 0) {
    const node = restNode(dropped);
    kept.push({ key: restKeyOf(parent.key), path: parent.path, node, depth, start: cursor, width: node.games * perGame, rest: dropped.length });
  }
  return kept;
}

/**
 * Le focus occupe toute la largeur ; chaque rangée est construite depuis les vraies lignes de
 * la précédente. Les seuils sont en pixels : ce qui est fondu à la racine se redéploie au zoom.
 */
export function layoutPruned(focus: OpeningNode, focusPath: readonly string[], options: PruneOptions): PlacedTile[] {
  if (focus.games === 0) return [];
  const minFraction = options.minPx / Math.max(options.widthPx, 1);
  const root: PlacedTile = { key: keyOf(focusPath), path: focusPath, node: focus, depth: 0, start: 0, width: 1, rest: 0 };

  const tiles = [root];
  let row = [root];
  for (let depth = 1; depth < options.maxRows; depth++) {
    const next = row.flatMap((parent) => (parent.rest ? [] : packChildren(parent, depth, minFraction)));
    const coverage = next.reduce((sum, tile) => sum + (tile.rest ? 0 : tile.width), 0);
    if (next.length === 0 || (depth > options.minRows && coverage < options.coverageFloor)) break;
    tiles.push(...next);
    row = next;
  }
  return tiles;
}

export interface Mark {
  rank: number;
  /** La priorité est cette tuile même, et non quelque part dessous. */
  exact: boolean;
}

/**
 * Chaque priorité est posée sur la tuile visible la plus profonde qui la contient : elle-même
 * quand elle est dessinée, sinon la tuile « reste » qui l'a absorbée, sinon son dernier ancêtre.
 */
export function marksFor(tiles: readonly PlacedTile[], priorities: readonly { path: readonly string[] }[]): Map<string, Mark> {
  const marks = new Map<string, Mark>();
  priorities.forEach((priority, index) => {
    const target = keyOf(priority.path);
    let best: PlacedTile | undefined;
    for (const tile of tiles) {
      if (tile.rest) continue;
      const key = tile.key;
      const contains = key === '' || target === key || target.startsWith(`${key} `);
      if (contains && (!best || tile.depth > best.depth)) best = tile;
    }
    if (!best) return;
    const exact = best.key === target;
    const carrier = (exact ? undefined : tiles.find((tile) => tile.key === restKeyOf(best.key))) ?? best;
    if (carrier.depth === 0) return;
    const existing = marks.get(carrier.key);
    if (existing && existing.rank < index + 1) return;
    marks.set(carrier.key, { rank: index + 1, exact });
  });
  return marks;
}
