import type { OpeningNode } from '../domain/openingTree';

interface BarPlacement {
  depth: number;
  start: number;
  width: number;
}

export interface LineBar extends BarPlacement {
  kind: 'line';
  path: readonly string[];
  node: OpeningNode;
}

export interface OthersBar extends BarPlacement {
  kind: 'others';
  parentPath: readonly string[];
  lines: number;
  games: number;
}

export type FlameBar = LineBar | OthersBar;

/**
 * Places `focus` on a full-width row, then each descendant under its parent with
 * a width proportional to its games. `start` and `width` are fractions of the
 * full width. Children narrower than `minWidth` are merged into one "others" bar.
 */
export function layoutFlame(
  focus: OpeningNode,
  focusPath: readonly string[],
  minWidth: number,
): FlameBar[] {
  const bars: FlameBar[] = [];
  if (focus.games === 0) return bars;

  const place = (node: OpeningNode, path: readonly string[], depth: number, start: number, width: number) => {
    bars.push({ kind: 'line', path, node, depth, start, width });

    let cursor = start;
    let othersGames = 0;
    let othersLines = 0;
    for (const child of node.children) {
      const childWidth = (child.games / node.games) * width;
      if (childWidth >= minWidth) {
        place(child, [...path, child.san!], depth + 1, cursor, childWidth);
        cursor += childWidth;
      } else {
        othersGames += child.games;
        othersLines++;
      }
    }

    const othersWidth = (othersGames / node.games) * width;
    if (othersLines > 0 && othersWidth >= minWidth) {
      bars.push({
        kind: 'others', parentPath: path, lines: othersLines, games: othersGames,
        depth: depth + 1, start: cursor, width: othersWidth,
      });
    }
  };

  place(focus, focusPath, 0, 0, 1);
  return bars;
}
