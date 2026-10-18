import { useEffect, useMemo, useState } from 'react';
import type { PlayedGame } from '../domain/playedGame';
import { gameDaysAfter } from '../domain/replay';

const STORAGE = 'kumquat.v2.replay-day';

export interface ReplayDay {
  day: string;
  /** Rang du jour parmi les jours de parties du rejeu, 0 avant le premier. */
  index: number;
  total: number;
  gamesThatDay: number;
  next: (() => void) | undefined;
  reset: (() => void) | undefined;
}

/** Le jour vécu du rejeu : `start` est la veille du premier jour rejoué, le jour où naît le répertoire. */
export function useReplayDay(games: readonly PlayedGame[], start: string): ReplayDay {
  const days = useMemo(() => gameDaysAfter(games, start), [games, start]);
  const [day, setDay] = useState(() => {
    const stored = localStorage.getItem(STORAGE);
    return stored && days.includes(stored) ? stored : start;
  });

  useEffect(() => localStorage.setItem(STORAGE, day), [day]);

  const index = days.indexOf(day) + 1;
  const following = days[index];
  return {
    day,
    index,
    total: days.length,
    gamesThatDay: index ? games.filter((game) => game.playedAt === day).length : 0,
    next: following ? () => setDay(following) : undefined,
    reset: index ? () => setDay(start) : undefined,
  };
}
