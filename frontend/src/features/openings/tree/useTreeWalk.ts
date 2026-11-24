import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Side } from '../domain/playedGame';
import { storeSide } from '../workshop/storedSide';
import { findNode, mostPlayed, nodeAlong, startsWith, type MapNode } from './repertoireMap';

export interface MapFocus {
  key: string;
  stamp: number;
  centre: boolean;
}

export type Lead = 'settle' | 'priority';

/** La position regardée dans chaque camp, et les gestes qui y mènent : la carte, l'échiquier, les flèches. */
export function useTreeWalk(maps: Record<Side, MapNode>, asked: { side: Side; line: readonly string[] }) {
  const [side, setSide] = useState<Side>(asked.side);
  useEffect(() => storeSide(side), [side]);
  const [paths, setPaths] = useState<Record<Side, readonly string[]>>(() => ({ w: [], b: [], [asked.side]: asked.line }));
  const [focus, setFocus] = useState<MapFocus | null>(() => (asked.line.length ? { key: asked.line.join(' '), stamp: Date.now(), centre: true } : null));
  // Ce que « coup suivant » rejoue au téléphone : la ligne d'où l'on vient de reculer, comme sur Lichess.
  const [trails, setTrails] = useState<Record<Side, readonly string[]>>(() => ({ w: [], b: [], [asked.side]: asked.line }));
  // Ce que le volet met en avant quand une position porte une décision et une priorité : ce qui y a mené.
  const [lead, setLead] = useState<Lead>(asked.line.length ? 'priority' : 'settle');
  const focusOn = useCallback((key: string, centre: boolean) => setFocus({ key, stamp: Date.now(), centre }), []);

  const root = maps[side];
  const path = paths[side];
  const node = useMemo(() => nodeAlong(root, path), [root, path]);
  const trail = trails[side];

  const goTo = (target: Side, key: string, centre: boolean) => {
    const found = findNode(maps[target], key);
    if (!found) return;
    setLead('settle');
    setSide(target);
    setPaths((current) => ({ ...current, [target]: found.path }));
    setTrails((current) => ({ ...current, [target]: startsWith(current[target], found.path) ? current[target] : found.path }));
    focusOn(key, centre);
  };
  const walk = (next: readonly string[]) => {
    setPaths((current) => ({ ...current, [side]: next }));
    setTrails((current) => ({ ...current, [side]: startsWith(current[side], next) ? current[side] : next }));
    const reached = nodeAlong(root, next);
    if (reached.path.length === next.length) focusOn(reached.key, false);
  };
  const play = (san: string) => walk([...path, san]);
  const back = () => walk(path.slice(0, -1));
  const mainMove = path.length === node.path.length ? mostPlayed(node)?.san : undefined;
  const forward = trail.length > path.length && startsWith(trail, path) ? () => walk(trail.slice(0, path.length + 1)) : mainMove ? () => play(mainMove) : undefined;
  // ▶| : le bout de la ligne gardée, sinon le bout de la ligne principale du répertoire.
  const toEnd = forward
    ? () => {
        if (trail.length > path.length && startsWith(trail, path)) return walk(trail);
        let reached = node;
        const line = [...path];
        while (reached.children.length) {
          reached = mostPlayed(reached)!;
          if (reached.stub) break;
          line.push(reached.san!);
        }
        walk(line);
      }
    : undefined;
  /** Ouvre une ligne dans son camp, centrée, comme si on venait d'y arriver. */
  const open = (target: Side, line: readonly string[]) => {
    setSide(target);
    setPaths((current) => ({ ...current, [target]: line }));
    setTrails((current) => ({ ...current, [target]: line }));
    focusOn(line.join(' '), true);
  };
  /** Sélectionne une ligne et la centre, sans changer de camp ni de ligne gardée. */
  const reveal = (target: Side, line: readonly string[]) => {
    setPaths((current) => ({ ...current, [target]: line }));
    focusOn(line.join(' '), true);
  };

  return { side, setSide, root, path, node, trail, focus, focusOn, lead, setLead, goTo, walk, play, back, forward, toEnd, open, reveal };
}

export type TreeWalk = ReturnType<typeof useTreeWalk>;
