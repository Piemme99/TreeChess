import { useEffect, useMemo, useState } from 'react';
import { withAdditions, type Addition } from '../domain/addition';
import type { PlayedGame } from '../domain/playedGame';
import { repertoiresOf } from './replaySetup';
import { storageKey } from '../workshop/storage';

/**
 * Le répertoire du rejeu : celui créé au départ, plus les ajouts acceptés depuis. On garde les ajouts
 * plutôt que le répertoire : une règle de création qui change n'oblige pas à tout refaire.
 */
export function useRepertoires(games: readonly PlayedGame[], start: string) {
  const [additions, setAdditions] = useState<readonly Addition[]>(() => JSON.parse(localStorage.getItem(storageKey('additions')) ?? '[]') as Addition[]);

  useEffect(() => localStorage.setItem(storageKey('additions'), JSON.stringify(additions)), [additions]);

  const created = useMemo(() => repertoiresOf(games, start), [games, start]);
  const repertoires = useMemo(
    () => ({ w: withAdditions(created.w, additions), b: withAdditions(created.b, additions) }),
    [created, additions],
  );

  return {
    repertoires,
    add: (addition: Addition) => setAdditions((current) => [...current, addition]),
    // Par contenu : un ajout relu du stockage ou recréé au rendu suivant n'est plus le même objet.
    remove: (addition: Addition) => setAdditions((current) => current.filter((known) => JSON.stringify(known) !== JSON.stringify(addition))),
    clear: () => setAdditions([]),
  };
}
