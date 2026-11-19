import { useEffect, useMemo, useRef, useState } from 'react';
import { withAdditions, type Addition } from '../domain/addition';
import type { PlayedGame } from '../domain/playedGame';
import { repertoiresOn, withoutReadded, withRemovals, type Removal } from '../domain/removal';
import { repertoiresOf } from './replaySetup';
import { readStored, writeStored } from '../workshop/storage';

/**
 * Le répertoire du rejeu : celui créé au départ, plus les ajouts acceptés depuis, moins les coups retirés. On garde les
 * ajouts et les retraits plutôt que le répertoire : une règle de création qui change n'oblige pas à tout refaire.
 */
export function useRepertoires(games: readonly PlayedGame[], start: string) {
  const [additions, setAdditions] = useState<readonly Addition[]>(() => JSON.parse(readStored('additions') ?? '[]') as Addition[]);
  const [removals, setRemovals] = useState<readonly Removal[]>(() => JSON.parse(readStored('removals') ?? '[]') as Removal[]);

  // Les retraits qu'un ajout a annulés, pour que son Undo les remette.
  const cancelled = useRef(new Map<string, readonly Removal[]>());

  useEffect(() => writeStored('additions', JSON.stringify(additions)), [additions]);
  useEffect(() => writeStored('removals', JSON.stringify(removals)), [removals]);

  const created = useMemo(() => repertoiresOf(games, start), [games, start]);
  const grown = useMemo(
    () => ({ w: withAdditions(created.w, additions), b: withAdditions(created.b, additions) }),
    [created, additions],
  );
  const repertoires = useMemo(() => ({ w: withRemovals(grown.w, removals), b: withRemovals(grown.b, removals) }), [grown, removals]);
  const repertoireOn = useMemo(() => repertoiresOn(grown, removals), [grown, removals]);

  return {
    repertoires,
    /** Le répertoire contre lequel se contrôle une partie jouée tel jour. */
    repertoireOn,
    add: (addition: Addition) => {
      setAdditions((current) => [...current, addition]);
      setRemovals((current) => {
        const kept = withoutReadded(current, addition);
        if (kept.length < current.length) cancelled.current.set(JSON.stringify(addition), current.filter((removal) => !kept.includes(removal)));
        return kept;
      });
    },
    // Par contenu : un ajout relu du stockage ou recréé au rendu suivant n'est plus le même objet.
    remove: (addition: Addition) => {
      const key = JSON.stringify(addition);
      setAdditions((current) => current.filter((known) => JSON.stringify(known) !== key));
      const back = cancelled.current.get(key);
      if (!back) return;
      cancelled.current.delete(key);
      setRemovals((current) => [...current, ...back]);
    },
    removeMove: (removal: Removal) => setRemovals((current) => [...current, removal]),
    restoreMove: (removal: Removal) => setRemovals((current) => current.filter((known) => JSON.stringify(known) !== JSON.stringify(removal))),
    clear: () => {
      setAdditions([]);
      setRemovals([]);
    },
  };
}
