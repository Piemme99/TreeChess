import { isMarked, type MapNode } from './repertoireMap';

export interface Folding {
  /** Nœuds dépliés à la main, au-delà de la profondeur d'arrivée. */
  opened: ReadonlySet<string>;
  /** Nœuds repliés à la main. */
  closed: ReadonlySet<string>;
  /** Nœuds à garder sous les yeux, comme une pastille : leur chemin seul se déplie, pas leurs frères. */
  revealed: ReadonlySet<string>;
}

export interface VisibleNode {
  node: MapNode;
  /** Descendants cachés derrière ce nœud. */
  hidden: number;
}

/**
 * Ce qui se voit : jusqu'à `depth` demi-coups les lignes qui pèsent au moins `minGames` parties, les
 * chemins vers une pastille ou une épingle quelle que soit la profondeur, et ce que le joueur a
 * déplié. Un nœud replié à la main cache tout. Mesuré sur Piemme78 (depth 6, 2 % des parties) :
 * 135 nœuds deviennent 49 pour les Blancs, 124 deviennent 40 pour les Noirs, lisibles sans zoom.
 */
export function visibleNodes(root: MapNode, depth: number, minGames: number, folding: Folding): VisibleNode[] {
  const carries = carriesMark(root, folding.revealed);
  const visible: VisibleNode[] = [];
  const walk = (node: MapNode) => {
    const shown = folding.closed.has(node.key)
      ? []
      : node.children.filter(
          (child) => (node.ply < depth && child.games >= minGames) || folding.opened.has(node.key) || carries.get(child.key),
        );
    const hidden = node.children.reduce((sum, child) => sum + (shown.includes(child) ? 0 : 1 + descendants(child)), 0);
    visible.push({ node, hidden });
    shown.forEach(walk);
  };
  walk(root);
  return visible;
}

function carriesMark(root: MapNode, revealed: ReadonlySet<string>): Map<string, boolean> {
  const carries = new Map<string, boolean>();
  const walk = (node: MapNode): boolean => {
    const below = node.children.map(walk).some(Boolean);
    const result = (!node.stub && (isMarked(node) || revealed.has(node.key))) || below;
    carries.set(node.key, result);
    return result;
  };
  walk(root);
  return carries;
}

function descendants(node: MapNode): number {
  return node.children.reduce((sum, child) => sum + 1 + descendants(child), 0);
}
