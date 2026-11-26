import { useEffect, useState } from 'react';
import type { PlayedGame } from '../domain/playedGame';
import { readStored, writeStored } from '../workshop/storage';
import { ignoredKeys } from './decisions';

/** Les contrôles de partie écartés par le joueur, par identité de partie. */
export function useIgnoredChecks(games: readonly PlayedGame[]) {
  const [ignored, setIgnored] = useState<ReadonlySet<string>>(() => {
    const stored = readStored('ignored-checks');
    return ignoredKeys(stored ? (JSON.parse(stored) as (number | string)[]) : [], games);
  });

  useEffect(() => writeStored('ignored-checks', JSON.stringify([...ignored])), [ignored]);

  return {
    ignored,
    ignore: (key: string) => setIgnored((current) => new Set(current).add(key)),
    unignore: (keys: readonly string[]) => setIgnored((current) => new Set([...current].filter((key) => !keys.includes(key)))),
    clear: () => setIgnored(new Set()),
  };
}
