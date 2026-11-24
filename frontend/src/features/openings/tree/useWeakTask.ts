import { useEffect, useEffectEvent, useMemo, useState } from 'react';
import type { SetURLSearchParams } from 'react-router';
import type { Side } from '../domain/playedGame';
import { shownLine, type Priority } from '../domain/priorities';
import { worksOn } from '../domain/worked';
import type { TreeWalk } from './useTreeWalk';
import { showsOn, weakIndexOf, weakRedirect, type AskedLine } from './weakTask';

/** La tâche Weak opening (`?task=weak&side=…&line=…`) : la faiblesse à son rang, les suivantes, et le bilan d'une préparation. */
export function useWeakTask({
  active,
  priorities,
  asked,
  walk,
  setParams,
  toTop,
}: {
  active: boolean;
  priorities: readonly Priority[];
  asked: AskedLine;
  walk: TreeWalk;
  setParams: SetURLSearchParams;
  toTop: () => void;
}) {
  // Le rang de la tâche vient de l'adresse, pas de la position regardée : on peut s'écarter de la ligne sans le perdre.
  const askedIndex = useMemo(() => weakIndexOf(priorities, asked), [priorities, asked]);
  const rank = askedIndex + 1 || 1;
  const priority = active ? priorities[rank - 1] : undefined;
  // Dans la tâche, la faiblesse se montre sur sa ligne même hors du répertoire : on y joue un coup qu'il n'a pas.
  const onLine = priority !== undefined && priority.side === walk.side && showsOn(priority, walk.path);
  // Le bilan d'une ouverture faible préparée, avant de passer à la suivante.
  const [prepared, setPrepared] = useState<{ moves: number; line: readonly string[] } | null>(null);

  // Toutes les faiblesses à la suite, celles hors du répertoire comprises : on va à leur ligne, pas à leur épingle.
  const goTo = (target: number) => {
    const weak = priorities[target - 1];
    if (!weak) return;
    const line = shownLine(weak);
    // L'adresse suit la faiblesse montrée : recharger la page y ramène.
    setParams({ task: 'weak', side: weak.side, line: line.join(' ') }, { replace: true });
    setPrepared(null);
    walk.open(weak.side, line);
    walk.setLead('priority');
    toTop();
  };
  const redirect = useEffectEvent((target: number) => goTo(target));
  useEffect(() => {
    if (!active) return;
    const target = weakRedirect(priorities, asked);
    if (target !== null) redirect(target);
  }, [active, priorities, asked]);
  const next = active && priorities.length > 1 ? () => goTo((rank % priorities.length) + 1) : undefined;

  /** La faiblesse de la tâche qu'une ligne ajoutée travaille, quel que soit le bouton qui a lancé la construction. */
  const workedBy = (side: Side, lines: readonly (readonly string[])[]) =>
    active && priority && worksOn(priority, side, lines) ? { side: priority.side, path: priority.path } : undefined;

  return { rank, priority, onLine, prepared, setPrepared, goTo, next, workedBy };
}
