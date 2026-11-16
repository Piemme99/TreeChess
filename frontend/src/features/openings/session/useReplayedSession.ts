import { useEffect, useMemo, useRef } from 'react';
import { gamesToDecide, liveGames } from '../checks/decisions';
import { useIgnoredChecks } from '../checks/useIgnoredChecks';
import type { Addition } from '../domain/addition';
import { gamesUntil } from '../domain/replay';
import { playedGamesFixture } from '../fixtures/playedGames';
import { REPLAY_FIRST_DAY } from '../replay/replaySetup';
import { useRepertoires } from '../replay/useRepertoires';
import { useReplayDay } from '../replay/useReplayDay';
import { sessionSteps } from './steps';
import { useJudgedSteps } from './useJudgedSteps';

/** L'état du rejeu vu par le parcours : le jour, le répertoire, et les positions à trancher ce jour-là. */
export function useReplayedSession() {
  const replay = useReplayDay(playedGamesFixture, REPLAY_FIRST_DAY);
  const { ignored, ignore, unignore, clear: forgetIgnored } = useIgnoredChecks();
  const { repertoires, add, remove, clear: forgetAdditions } = useRepertoires(playedGamesFixture);
  const known = useMemo(() => gamesUntil(playedGamesFixture, replay.day), [replay.day]);
  const lived = useMemo(() => liveGames(playedGamesFixture, repertoires, REPLAY_FIRST_DAY, replay.day), [repertoires, replay.day]);
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

  return { replay, known, repertoires, steps, adoptions, judging, add, remove, ignore, unignore, forgetIgnored, forgetAdditions };
}
