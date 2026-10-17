import type { OpeningNode } from '../domain/openingTree';

export interface FlameBar {
  path: readonly string[];
  node: OpeningNode;
  depth: number;
  start: number;
  width: number;
}

/**
 * Places `focus` on a full-width row, then each descendant under its parent with
 * a width proportional to its games. `start` and `width` are fractions of the
 * full width. Lines played fewer than `minGames` times are left out, with their
 * descendants: there is nothing to learn from them.
 */
export function layoutFlame(
  focus: OpeningNode,
  focusPath: readonly string[],
  minGames: number,
): FlameBar[] {
  const bars: FlameBar[] = [];
  if (focus.games === 0) return bars;

  const place = (node: OpeningNode, path: readonly string[], depth: number, start: number, width: number) => {
    bars.push({ path, node, depth, start, width });

    let cursor = start;
    for (const child of node.children) {
      const childWidth = (child.games / node.games) * width;
      if (child.games >= minGames) place(child, [...path, child.san!], depth + 1, cursor, childWidth);
      cursor += childWidth;
    }
  };

  place(focus, focusPath, 0, 0, 1);
  return bars;
}
