import { useEffect, useMemo, useRef } from 'react';
import { gamesToDecide, liveGames } from '../checks/decisions';
import { useIgnoredChecks } from '../checks/useIgnoredChecks';
import type { Addition } from '../domain/addition';
import { gamesUntil } from '../domain/replay';
import { useRepertoires } from '../replay/useRepertoires';
import { useStoppedMoves } from '../replay/useStoppedMoves';
import { useReplayDay } from '../replay/useReplayDay';
import { sessionSteps } from './steps';
import { useJudgedSteps } from './useJudgedSteps';
import { useSource } from '../source/useSource';

/** L'état du rejeu vu par le parcours : le jour, le répertoire, et les positions à trancher ce jour-là. */
export function useReplayedSession() {
  const source = useSource();
  const replay = useReplayDay(source.games, source.firstDay, source.replay);
  const { ignored, ignore, unignore, clear: forgetIgnored } = useIgnoredChecks(source.games);
  const { repertoires, repertoireOn, add, remove, removeMove, restoreMove, clear: forgetRepertoire } = useRepertoires(source.games, source.start);
  const known = useMemo(() => gamesUntil(source.games, replay.day), [source.games, replay.day]);
  const { stopped, reviewed, keep, unkeep, clear: forgetKept } = useStoppedMoves(repertoires, known, source.start);
  const lived = useMemo(() => liveGames(source.games, repertoireOn, source.firstDay, replay.day), [source, repertoireOn, replay.day]);
  const open = useMemo(() => sessionSteps(gamesToDecide(lived, ignored, replay.day)), [lived, ignored, replay.day]);
  const { steps, adopted, judging } = useJudgedSteps(open);
  const adoptions = useMemo(
    () =>
      adopted.map((step) => ({
        step,
        key: `${step.key} ${step.games.map((checked) => checked.id).join(',')}`,
        addition: { side: step.side, addedAt: replay.day, moves: [{ position: step.games[0].check.position, san: step.played, source: 'habit' }] } satisfies Addition,
      })),
    [adopted, replay.day],
  );
  // Une même adoption ne s'écrit qu'une fois, même si l'effet repasse avant que le répertoire ait changé.
  const written = useRef(new Set<string>());
  useEffect(() => {
    for (const { key, addition } of adoptions) {
      if (written.current.has(key)) continue;
      written.current.add(key);
      add(addition);
    }
    // `add` change à chaque rendu ; seules de nouvelles adoptions comptent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adoptions]);

  const forgetAdditions = () => {
    forgetRepertoire();
    forgetKept();
  };

  return {
    source,
    replay,
    known,
    lived,
    repertoires,
    /** Le répertoire que la révision parcourt : sans les coups que le joueur ne joue plus. */
    reviewed,
    stopped,
    keep,
    unkeep,
    steps,
    adoptions,
    judging,
    add,
    remove,
    removeMove,
    restoreMove,
    ignore,
    unignore,
    forgetIgnored,
    forgetAdditions,
  };
}
