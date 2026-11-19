import { useEffect, useMemo, useState } from 'react';
import type { PlayedGame, Side } from '../domain/playedGame';
import { withRemovals } from '../domain/removal';
import type { Repertoire } from '../domain/repertoire';
import { stoppedMoves, type KeptMove, type StoppedMove } from '../domain/stopped';
import { readStored, writeStored } from '../workshop/storage';

/** Les coups que le joueur ne joue plus, proposés au retrait ; en attendant sa réponse, ils sortent de la révision. */
export function useStoppedMoves(repertoires: Record<Side, Repertoire>, known: readonly PlayedGame[], createdAt: string) {
  const [kept, setKept] = useState<readonly KeptMove[]>(() => JSON.parse(readStored('kept-moves') ?? '[]') as KeptMove[]);
  useEffect(() => writeStored('kept-moves', JSON.stringify(kept)), [kept]);

  const stopped = useMemo(
    () => [...stoppedMoves(repertoires.w, known, createdAt, kept), ...stoppedMoves(repertoires.b, known, createdAt, kept)],
    [repertoires, known, createdAt, kept],
  );
  const reviewed = useMemo(() => {
    const out = (side: Side) => stopped.filter((move) => move.side === side).map((move) => ({ ...move, removedAt: '' }));
    return { w: withRemovals(repertoires.w, out('w')), b: withRemovals(repertoires.b, out('b')) };
  }, [repertoires, stopped]);

  return {
    stopped,
    /** Le répertoire que la révision parcourt. */
    reviewed,
    keep: (move: StoppedMove, day: string) => {
      const kept: KeptMove = { side: move.side, position: move.position, san: move.san, keptAt: day };
      setKept((current) => [...current.filter((known) => !(known.side === kept.side && known.position === kept.position && known.san === kept.san)), kept]);
      return kept;
    },
    unkeep: (move: KeptMove) => setKept((current) => current.filter((known) => JSON.stringify(known) !== JSON.stringify(move))),
    clear: () => setKept([]),
  };
}
