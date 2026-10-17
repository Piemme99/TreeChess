// PROTOTYPE — le flame graph vu comme une caméra sur un plan fixe.
// Chaque barre a des coordonnées absolues (fraction de la racine, profondeur = demi-coup).
// Zoomer, c'est déplacer la fenêtre : les barres hors champ glissent hors du cadre au lieu
// de disparaître, ce qui garde le fil spatial.
import { useMemo, useState } from 'react';
import type { OpeningTree } from '../domain/openingTree';
import { layoutFlame, type FlameBar } from '../flame/flameLayout';

export interface Viewport {
  start: number;
  width: number;
  depth: number;
}

export interface Placement {
  left: number;
  width: number;
  top: number;
}

const MIN_DRAWN_GAMES = 10;

export const pathKey = (path: readonly string[]) => path.join(' ');

const isPrefix = (prefix: readonly string[], path: readonly string[]) =>
  prefix.length <= path.length && prefix.every((san, index) => path[index] === san);

export function useFlameCamera(
  tree: OpeningTree,
  focusPath: readonly string[],
  rowHeight: (ply: number) => number,
) {
  const all = useMemo(() => layoutFlame(tree.root, [], MIN_DRAWN_GAMES), [tree]);
  const byKey = useMemo(() => new Map(all.map((bar) => [pathKey(bar.path), bar])), [all]);

  const focus = byKey.get(pathKey(focusPath)) ?? all[0];
  const viewport: Viewport = { start: focus.start, width: focus.width, depth: focus.depth };

  const focusKey = pathKey(focus.path);
  const [camera, setCamera] = useState({ key: focusKey, from: viewport, to: viewport });
  if (camera.key !== focusKey) setCamera({ key: focusKey, from: camera.to, to: viewport });
  const from = camera.from;

  const visible = all.filter((bar) => isPrefix(focus.path, bar.path));
  const deepest = Math.max(...visible.map((bar) => bar.depth));

  const topOf = (ply: number, vp: Viewport) => {
    let top = 0;
    for (let d = vp.depth; d < ply; d++) top += rowHeight(d);
    for (let d = ply; d < vp.depth; d++) top -= rowHeight(d);
    return top;
  };

  const place = (bar: FlameBar, vp: Viewport): Placement => ({
    left: (bar.start - vp.start) / vp.width,
    width: bar.width / vp.width,
    top: topOf(bar.depth, vp),
  });

  return {
    bars: visible,
    focus,
    viewport,
    from,
    place,
    height: topOf(deepest + 1, viewport),
    ancestorsOf: (path: readonly string[]) => (bar: FlameBar) => isPrefix(bar.path, path),
  };
}

export type { FlameBar };
