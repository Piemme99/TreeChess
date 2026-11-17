import { useEffect, useMemo, useState } from 'react';
import type { PlayedGame } from '../domain/playedGame';
import { gameDaysAfter, lastDayPlayed } from '../domain/replay';
import { storageKey } from '../workshop/storage';

export interface ReplayDay {
  day: string;
  /** Rang du jour parmi les jours de parties du rejeu, 0 avant le premier. */
  index: number;
  total: number;
  gamesThatDay: number;
  /** Le jour réel des révisions : celui du rejeu dans la démo, la date du jour pour des parties importées. */
  today: string;
  next: (() => void) | undefined;
  reset: (() => void) | undefined;
}

/**
 * Le jour vécu du rejeu : `start` est la veille du premier jour rejoué, le jour où naît le répertoire. Sans rejeu
 * (parties importées), c'est le dernier jour joué depuis l'import : ses parties sont les nouvelles.
 */
export function useReplayDay(games: readonly PlayedGame[], start: string, replayed = true): ReplayDay {
  const days = useMemo(() => gameDaysAfter(games, start), [games, start]);
  const [day, setDay] = useState(() => {
    const stored = localStorage.getItem(storageKey('replay-day'));
    return stored && days.includes(stored) ? stored : start;
  });

  // Le rejeu n'existe que dans la démo : rien à garder pour des parties importées.
  useEffect(() => {
    if (replayed) localStorage.setItem(storageKey('replay-day'), day);
  }, [day, replayed]);

  if (!replayed) {
    const last = lastDayPlayed(games, start);
    return {
      day: last,
      index: days.length,
      total: days.length,
      gamesThatDay: days.length ? games.filter((game) => game.playedAt === last).length : 0,
      today: new Date().toISOString().slice(0, 10),
      next: undefined,
      reset: undefined,
    };
  }
  const index = days.indexOf(day) + 1;
  const following = days[index];
  return {
    day,
    index,
    total: days.length,
    gamesThatDay: index ? games.filter((game) => game.playedAt === day).length : 0,
    today: day,
    next: following ? () => setDay(following) : undefined,
    reset: index ? () => setDay(start) : undefined,
  };
}
