import { useEffect, useState } from 'react';
import { storageKey } from '../workshop/storage';

/** Les contrôles de partie écartés par le joueur, par identifiant de partie. */
export function useIgnoredChecks() {
  const [ignored, setIgnored] = useState<ReadonlySet<number>>(() => {
    const stored = localStorage.getItem(storageKey('ignored-checks'));
    return new Set(stored ? (JSON.parse(stored) as number[]) : []);
  });

  useEffect(() => localStorage.setItem(storageKey('ignored-checks'), JSON.stringify([...ignored])), [ignored]);

  return {
    ignored,
    ignore: (id: number) => setIgnored((current) => new Set(current).add(id)),
    unignore: (ids: readonly number[]) => setIgnored((current) => new Set([...current].filter((id) => !ids.includes(id)))),
    clear: () => setIgnored(new Set()),
  };
}
