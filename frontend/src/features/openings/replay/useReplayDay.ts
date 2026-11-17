import { useEffect, useMemo, useState } from 'react';
import type { PlayedGame } from '../domain/playedGame';
import { gameDaysAfter } from '../domain/replay';
import { storageKey } from '../workshop/storage';

export interface ReplayDay {
  day: string;
  /** Rang du jour parmi les jours de parties du rejeu, 0 avant le premier. */
  index: number;
  total: number;
  gamesThatDay: number;
  next: (() => void) | undefined;
  reset: (() => void) | undefined;
}

/**
 * Le jour vécu du rejeu : `start` est la veille du premier jour rejoué, le jour où naît le répertoire. Sans rejeu
 * (parties importées), c'est aujourd'hui.
 */
export function useReplayDay(games: readonly PlayedGame[], start: string, replayed = true): ReplayDay {
  const days = useMemo(() => gameDaysAfter(games, start), [games, start]);
  const [day, setDay] = useState(() => {
    const stored = localStorage.getItem(storageKey('replay-day'));
    return stored && days.includes(stored) ? stored : start;
  });

  useEffect(() => localStorage.setItem(storageKey('replay-day'), day), [day]);

  if (!replayed) return { day: new Date().toISOString().slice(0, 10), index: 0, total: 0, gamesThatDay: 0, next: undefined, reset: undefined };
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
