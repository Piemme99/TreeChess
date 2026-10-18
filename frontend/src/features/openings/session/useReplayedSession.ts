import { useMemo } from 'react';
import { gamesToDecide, liveGames } from '../checks/decisions';
import { useIgnoredChecks } from '../checks/useIgnoredChecks';
import { gamesUntil } from '../domain/replay';
import { playedGamesFixture } from '../fixtures/playedGames';
import { REPLAY_FIRST_DAY } from '../replay/replaySetup';
import { useRepertoires } from '../replay/useRepertoires';
import { useReplayDay } from '../replay/useReplayDay';
import { sessionSteps } from './steps';

/** L'état du rejeu vu par le parcours : le jour, le répertoire, et les positions à trancher ce jour-là. */
export function useReplayedSession() {
  const replay = useReplayDay(playedGamesFixture, REPLAY_FIRST_DAY);
  const { ignored, ignore, clear: forgetIgnored } = useIgnoredChecks();
  const { repertoires, add, clear: forgetAdditions } = useRepertoires(playedGamesFixture);
  const known = useMemo(() => gamesUntil(playedGamesFixture, replay.day), [replay.day]);
  const lived = useMemo(() => liveGames(playedGamesFixture, repertoires, REPLAY_FIRST_DAY, replay.day), [repertoires, replay.day]);
  const steps = useMemo(() => sessionSteps(gamesToDecide(lived, ignored, replay.day)), [lived, ignored, replay.day]);

  return { replay, known, repertoires, steps, add, ignore, forgetIgnored, forgetAdditions };
}
