import { useEffect, useEffectEvent, useMemo, useState } from 'react';
import type { SetURLSearchParams } from 'react-router';
import type { Gap } from '../domain/gaps';
import type { Side } from '../domain/playedGame';
import type { GapScan } from '../gaps/useGaps';
import type { TreeWalk } from './useTreeWalk';
import type { AskedLine } from './weakTask';

const sameLine = (a: readonly string[], b: readonly string[]) => a.join(' ') === b.join(' ');

/** La tâche Gaps (`?task=gap&side=…&line=…`) : le trou à son rang, les suivants, et le bilan d'une réponse préparée. */
export function useGapTask({ active, scan, asked, walk, setParams, toTop }: { active: boolean; scan: GapScan; asked: AskedLine; walk: TreeWalk; setParams: SetURLSearchParams; toTop: () => void }) {
  const { gaps, settled } = scan;
  const askedIndex = useMemo(() => gaps.findIndex((gap) => gap.side === asked.side && sameLine(gap.path, asked.line)), [gaps, asked]);
  const rank = askedIndex + 1 || 1;
  const gap: Gap | undefined = active && askedIndex >= 0 ? gaps[askedIndex] : undefined;
  const onLine = gap !== undefined && gap.side === walk.side && sameLine(gap.path, walk.path);
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
    if (active && settled && gaps.length && askedIndex < 0 && !prepared) redirect(1);
  }, [active, settled, gaps, askedIndex, prepared]);
  const next = active && gaps.length > 1 ? () => goTo((rank % gaps.length) + 1) : undefined;
  // Après le trou comblé, le premier plus petit : ceux que la réponse ouvre se placent n'importe où dans la liste.
  const afterPrepared = prepared && gaps.length ? () => goTo((gaps.findIndex((other) => other.reach < prepared.reach) + 1) || 1) : undefined;

  /** Une ligne ajoutée comble le trou de la tâche si elle passe par lui, quel que soit le bouton qui l'a lancée. */
  const fills = (side: Side, lines: readonly (readonly string[])[]) =>
    gap !== undefined && gap.side === side && lines.some((line) => line.length > gap.path.length && sameLine(line.slice(0, gap.path.length), gap.path));
  /** Le bilan remplace la carte. */
  const prepare = (moves: number, line: readonly string[]) => {
    if (gap) setPrepared({ moves, line, reach: gap.reach });
  };

  return { rank, gap, onLine, prepared, goTo, next, afterPrepared, fills, prepare };
}
