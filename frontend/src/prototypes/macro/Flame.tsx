// PROTOTYPE — flame graph (icicle) des ouvertures réelles. Jetable.
import type { Color, Tree, TreeNode } from './tree';
import { baseline, deficit, evalForUser } from './tree';

export interface Seg {
  node: TreeNode;
  x: number;
  w: number;
  lossCp: number | null;
  /** Points perdus par partie face à la moyenne du joueur, lissé. */
  deficit: number;
}

const ROW_H = 26;

function layout(tree: Tree, color: Color, maxPly: number, minWidth: number): Seg[] {
  const root = tree.nodes[tree.roots[color]];
  if (!root || root.games === 0) return [];
  const base = baseline(tree, color);

  const segs: Seg[] = [];
  const walk = (node: TreeNode, x: number, w: number) => {
    const parent = node.parent ? tree.nodes[node.parent] : null;
    let lossCp: number | null = null;
    if (parent?.userToMove) {
      const before = evalForUser(parent);
      const after = evalForUser(node);
      if (before !== undefined && after !== undefined) lossCp = before - after;
    }
    segs.push({ node, x, w, lossCp, deficit: deficit(node, base) });

    if (node.ply >= maxPly) return;
    const children = node.children
      .map((id) => tree.nodes[id])
      .sort((a, b) => b.games - a.games);

    let cursor = x;
    for (const child of children) {
      const cw = (child.games / node.games) * w;
      if (cw >= minWidth) walk(child, cursor, cw);
      cursor += cw;
    }
  };

  walk(root, 0, 100);
  return segs;
}

/** La couleur dit où partent les points, pas ce que pense le moteur. */
function tone(seg: Seg): string {
  if (seg.node.ply === 0) return '#334155';
  const d = seg.deficit;
  if (d >= 0.1) return '#dc2626';
  if (d >= 0.05) return '#b45309';
  if (d <= -0.05) return '#166534';
  return '#334155';
}

interface Props {
  tree: Tree;
  color: Color;
  maxPly: number;
  minWidth: number;
  selected: string | null;
  onSelect: (node: TreeNode) => void;
}

export function Flame({ tree, color, maxPly, minWidth, selected, onSelect }: Props) {
  // Pas de mémo : les évaluations sont posées en place sur les nœuds, l'identité de l'arbre ne bouge pas.
  const segs = layout(tree, color, maxPly, minWidth);
  const rows = Math.max(0, ...segs.map((s) => s.node.ply)) + 1;

  return (
    <div className="relative w-full" style={{ height: rows * ROW_H }}>
      {segs.map((seg) => {
        const winRate = Math.round((seg.node.score / seg.node.games) * 100);
        const evalUser = evalForUser(seg.node);
        return (
          <button
            key={seg.node.id}
            onClick={() => onSelect(seg.node)}
            title={`${seg.node.san ?? 'départ'} — ${seg.node.games} parties, ${winRate}% de points (moyenne ${Math.round(
              (seg.node.score / seg.node.games - seg.deficit) * 100,
            )}%)${evalUser !== undefined ? `, éval ${(evalUser / 100).toFixed(2)}` : ''}${
              seg.lossCp !== null && seg.lossCp > 0 ? `, −${seg.lossCp} cp sur ce coup` : ''
            }`}
            className="absolute overflow-hidden rounded-[2px] px-1.5 text-left text-[11px] text-white/90 transition hover:brightness-125"
            style={{
              left: `${seg.x}%`,
              width: `calc(${seg.w}% - 1px)`,
              top: seg.node.ply * ROW_H,
              height: ROW_H - 2,
              background: tone(seg),
              outline: selected === seg.node.id ? '2px solid #fff' : undefined,
            }}
          >
            <span className="whitespace-nowrap leading-[24px]">
              {seg.w > 4 ? (seg.node.san ?? `${seg.node.games} parties`) : ''}
            </span>
          </button>
        );
      })}
    </div>
  );
}
