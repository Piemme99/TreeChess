import { useEffect, useMemo, useState } from 'react';
import { withAdditions, type Addition } from '../domain/addition';
import type { PlayedGame } from '../domain/playedGame';
import { REPLAY_START, repertoiresOf } from './replaySetup';

const STORAGE = 'kumquat.v2.additions';

/**
 * Le répertoire du rejeu : celui créé au départ, plus les ajouts acceptés depuis. On garde les ajouts
 * plutôt que le répertoire : une règle de création qui change n'oblige pas à tout refaire.
 */
export function useRepertoires(games: readonly PlayedGame[]) {
  const [additions, setAdditions] = useState<readonly Addition[]>(() => JSON.parse(localStorage.getItem(STORAGE) ?? '[]') as Addition[]);

  useEffect(() => localStorage.setItem(STORAGE, JSON.stringify(additions)), [additions]);

  const created = useMemo(() => repertoiresOf(games, REPLAY_START), [games]);
  const repertoires = useMemo(
    () => ({ w: withAdditions(created.w, additions), b: withAdditions(created.b, additions) }),
    [created, additions],
  );

  return {
    repertoires,
    add: (addition: Addition) => setAdditions((current) => [...current, addition]),
    clear: () => setAdditions([]),
  };
}
