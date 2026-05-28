import { useEffect, useState } from 'react';
import { resolveOpening, type OpeningTable, type ResolvedOpening } from '../utils/openings';

// The opening dataset is ~60KB gzipped, so it is loaded lazily as its own chunk
// the first time any board needs an opening name, then cached for the session.
let tablePromise: Promise<OpeningTable> | null = null;

function loadOpeningTable(): Promise<OpeningTable> {
  if (!tablePromise) {
    tablePromise = import('../data/openings.json').then((m) => m.default as OpeningTable);
  }
  return tablePromise;
}

/**
 * Returns the opening for the current position, given the path of FENs from the
 * starting position to the current one. Returns null until the dataset has
 * loaded or when no position on the path is a named opening.
 */
export function useOpeningName(fenPath: string[]): ResolvedOpening | null {
  const [table, setTable] = useState<OpeningTable | null>(null);

  useEffect(() => {
    let active = true;
    loadOpeningTable().then((t) => {
      if (active) setTable(t);
    });
    return () => {
      active = false;
    };
  }, []);

  if (!table) return null;
  return resolveOpening(fenPath, table);
}
