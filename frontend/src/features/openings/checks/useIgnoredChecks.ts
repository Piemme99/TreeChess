import { useEffect, useState } from 'react';

const STORAGE = 'kumquat.v2.ignored-checks';

/** Les contrôles de partie écartés par le joueur, par identifiant de partie. */
export function useIgnoredChecks() {
  const [ignored, setIgnored] = useState<ReadonlySet<number>>(() => {
    const stored = localStorage.getItem(STORAGE);
    return new Set(stored ? (JSON.parse(stored) as number[]) : []);
  });

  useEffect(() => localStorage.setItem(STORAGE, JSON.stringify([...ignored])), [ignored]);

  return {
    ignored,
    ignore: (id: number) => setIgnored((current) => new Set(current).add(id)),
    clear: () => setIgnored(new Set()),
  };
}
