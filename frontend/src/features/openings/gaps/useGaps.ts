import { useEffect, useMemo, useState } from 'react';
import { findGaps, type Gap } from '../domain/gaps';
import type { Side } from '../domain/playedGame';
import type { Repertoire } from '../domain/repertoire';
import { explore, explored, explorerSignInNeeded } from '../services/explorer';
import { useExplorerLevel } from '../source/useExplorerLevel';

export interface GapScan {
  /** Les deux camps ensemble, le plus fréquent d'abord. */
  gaps: Gap[];
  /** La recherche est finie. */
  done: boolean;
  /** Le plus gros trou ne peut plus changer : ce qui reste à lire ne ferait pas passer le deuxième devant. */
  settled: boolean;
  /** Positions lues sur l'explorateur depuis l'arrivée sur la page. */
  read: number;
  /** L'explorateur ne répond pas (joueur non connecté à Lichess, réseau) : on n'en saura pas plus. */
  unavailable: boolean;
}

// Le relais limite chaque adresse IP à 100 requêtes par minute : la recherche en laisse pour le reste de l'application.
const SPACING = 1_000;
// Une erreur passagère (réseau, relais) ne doit pas faire disparaître les trous : on réessaie avant de renoncer.
const ATTEMPTS = 3;
const RETRY = 5_000;
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const NONE = { gaps: [], missing: [], pending: 0 };

/** Les trous des deux répertoires, lus sur l'explorateur position par position ; ce qu'il a déjà répondu est gardé. */
export function useGaps(repertoires: Record<Side, Repertoire>, enabled = true): GapScan {
  const { opponents } = useExplorerLevel();
  const [answers, setAnswers] = useState(0);
  const [read, setRead] = useState(0);
  const [unavailable, setUnavailable] = useState(false);
  const found = useMemo(() => {
    if (!enabled) return NONE;
    const statsAt = (fen: string) => explored('lichess', fen, opponents);
    const [white, black] = [findGaps(repertoires.w, statsAt), findGaps(repertoires.b, statsAt)];
    return {
      gaps: [...white.gaps, ...black.gaps].sort((a, b) => b.reach - a.reach),
      missing: [...white.missing, ...black.missing],
      pending: white.pending + black.pending,
    };
    // `answers` change quand l'explorateur a répondu : le cache local a alors de quoi aller plus loin.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, repertoires, opponents, answers]);
  const missing = found.missing.join('\n');

  useEffect(() => {
    if (!missing || unavailable) return;
    let live = true;
    void (async () => {
      for (const fen of missing.split('\n')) {
        for (let attempt = 1; !explored('lichess', fen, opponents); attempt++) {
          const result = await explore('lichess', fen, opponents).catch(() => null);
          if (!live) return;
          if (result) {
            setRead((count) => count + 1);
            await pause(SPACING);
          } else if (explorerSignInNeeded() || attempt >= ATTEMPTS) {
            setUnavailable(true);
            return;
          } else {
            await pause(RETRY);
          }
          if (!live) return;
        }
      }
      setAnswers((count) => count + 1);
    })();
    return () => {
      live = false;
    };
  }, [missing, opponents, unavailable]);

  const done = !found.missing.length;
  return { gaps: found.gaps, done, settled: done || (found.gaps.length > 0 && found.gaps[0].reach >= (found.gaps[1]?.reach ?? 0) + found.pending), read, unavailable };
}
