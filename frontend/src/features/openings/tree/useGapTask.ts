import { useEffect, useEffectEvent, useMemo, useState } from 'react';
import type { SetURLSearchParams } from 'react-router';
import type { Gap } from '../domain/gaps';
import type { Side } from '../domain/playedGame';
import { positionKey } from '../domain/repertoire';
import { replayLine } from '../position/replay';
import type { GapScan } from '../gaps/useGaps';
import type { TreeWalk } from './useTreeWalk';
import type { AskedLine } from './weakTask';

/** Les positions d'une ligne, de la première à la dernière ; une ligne illégale (adresse abîmée) n'en a aucune. */
const positionsOf = (line: readonly string[]) => {
  try {
    return replayLine(line).fens.map(positionKey);
  } catch {
    return [];
  }
};

/** La tâche Gaps (`?task=gap&side=…&line=…`) : le trou à son rang, les suivants, et le bilan d'une réponse préparée. */
export function useGapTask({ active, scan, asked, walk, setParams, toTop }: { active: boolean; scan: GapScan; asked: AskedLine; walk: TreeWalk; setParams: SetURLSearchParams; toTop: () => void }) {
  const { gaps, settled, unavailable } = scan;
  // Par la position, pas par le chemin : un autre ordre de coups peut devenir le plus joué pendant la recherche.
  const askedKey = useMemo(() => (asked.line.length ? positionsOf(asked.line).at(-1) : undefined), [asked]);
  const askedIndex = useMemo(() => gaps.findIndex((gap) => gap.side === asked.side && gap.key === askedKey), [gaps, asked, askedKey]);
  const rank = askedIndex + 1 || 1;
  const gap: Gap | undefined = active && askedIndex >= 0 ? gaps[askedIndex] : undefined;
  const walkKey = useMemo(() => positionsOf(walk.path).at(-1), [walk.path]);
  const onLine = gap !== undefined && gap.side === walk.side && gap.key === walkKey;
  const [prepared, setPrepared] = useState<{ moves: number; line: readonly string[]; reach: number } | null>(null);

  const goTo = (target: number) => {
    const next = gaps[target - 1];
    if (!next) return;
    setParams({ task: 'gap', side: next.side, line: next.path.join(' ') }, { replace: true });
    setPrepared(null);
    walk.open(next.side, next.path);
    toTop();
  };
  // Une adresse sans trou (première visite, trou comblé depuis) mène au plus gros, dès qu'il ne peut plus changer.
  const redirect = useEffectEvent((target: number) => goTo(target));
  useEffect(() => {
    if (active && (settled || unavailable) && gaps.length && askedIndex < 0 && !prepared) redirect(1);
  }, [active, settled, unavailable, gaps, askedIndex, prepared]);
  const next = active && gaps.length > 1 ? () => goTo((rank % gaps.length) + 1) : undefined;
  // Après le trou comblé, le premier plus petit : ceux que la réponse ouvre se placent n'importe où dans la liste.
  const afterPrepared = prepared && gaps.length ? () => goTo((gaps.findIndex((other) => other.reach < prepared.reach) + 1) || 1) : undefined;

  /** Une ligne ajoutée comble le trou de la tâche si elle passe par lui, quel que soit le bouton qui l'a lancée. */
  const fills = (side: Side, lines: readonly (readonly string[])[]) =>
    gap !== undefined && gap.side === side && lines.some((line) => positionsOf(line).slice(0, -1).includes(gap.key));
  /** Le bilan remplace la carte. */
  const prepare = (moves: number, line: readonly string[]) => {
    if (gap) setPrepared({ moves, line, reach: gap.reach });
  };

  return { rank, gap, onLine, prepared, goTo, next, afterPrepared, fills, prepare };
}
