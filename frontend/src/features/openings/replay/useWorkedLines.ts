import { useEffect, useState } from 'react';
import type { Side } from '../domain/playedGame';
import { readStored, writeStored } from '../workshop/storage';

/** Une priorité sur laquelle le joueur a accepté un ajout : la ligne est travaillée à partir de ce jour. */
export interface WorkedLine {
  side: Side;
  path: readonly string[];
  since: string;
}

export function useWorkedLines() {
  const [worked, setWorked] = useState<readonly WorkedLine[]>(() => JSON.parse(readStored('worked') ?? '[]') as WorkedLine[]);

  useEffect(() => writeStored('worked', JSON.stringify(worked)), [worked]);

  return {
    worked,
    // Une ligne déjà travaillée garde sa première date : l'adhérence se compte depuis le premier travail.
    work: (line: WorkedLine) =>
      setWorked((current) => (current.some((known) => known.side === line.side && known.path.join(' ') === line.path.join(' ')) ? current : [...current, line])),
    // Annuler un ajout ne défait que le travail daté du même jour : un travail plus ancien garde sa date.
    unwork: (line: WorkedLine) =>
      setWorked((current) => current.filter((known) => !(known.side === line.side && known.path.join(' ') === line.path.join(' ') && known.since === line.since))),
    clear: () => setWorked([]),
  };
}
