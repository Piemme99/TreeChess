import { useMemo } from 'react';
import { buildOpeningTree, type OpeningTree } from '../domain/openingTree';
import { gamesOfLastMonths } from '../domain/period';
import type { PlayedGame, Side } from '../domain/playedGame';
import { findPriorities } from '../domain/priorities';
import { splitWorked } from '../domain/worked';
import type { WorkedLine } from '../replay/useWorkedLines';
import type { SessionStep } from '../session/steps';
import type { useReplayedSession } from '../session/useReplayedSession';
import { buildRepertoireMap, type MapNode } from './repertoireMap';

const MAX_PLIES = 24;
export const RECENT_MONTHS = 12;
const MAX_PRIORITIES = 5;
// Un ajout reste déplié sur la carte pendant deux semaines de jeu.
const FRESH_DAYS = 14;
const daysBefore = (day: string, days: number) => new Date(Date.parse(`${day}T00:00:00Z`) - days * 86_400_000).toISOString().slice(0, 10);

/** Les deux cartes du répertoire, les arbres récents qu'elles dessinent, et les ouvertures faibles dans l'ordre de Home. */
export function useRepertoireMaps(
  known: readonly PlayedGame[],
  day: string,
  repertoires: ReturnType<typeof useReplayedSession>['repertoires'],
  steps: readonly SessionStep[],
  createdAt: string,
  worked: readonly WorkedLine[],
) {
  return useMemo(() => {
    const trees = (games: readonly PlayedGame[]): Record<Side, OpeningTree> => ({ w: buildOpeningTree(games, 'w', MAX_PLIES), b: buildOpeningTree(games, 'b', MAX_PLIES) });
    const recent = trees(gamesOfLastMonths(known, RECENT_MONTHS, new Date(day)));
    // Les mêmes rangs que sur Home : les cinq à faire d'abord, puis les travaillées, qu'« Open » y amène encore.
    const { toWork, treated } = splitWorked(findPriorities(trees(known), recent, Infinity), worked, known, MAX_PRIORITIES);
    const priorities = [...toWork, ...treated];
    const toSettle: Record<Side, Map<string, number>> = { w: new Map(), b: new Map() };
    for (const step of steps) {
      const position = step.games[0].check.position;
      // Des décisions, pas des parties : la même unité que « N to settle ».
      toSettle[step.side].set(position, (toSettle[step.side].get(position) ?? 0) + 1);
    }
    const maps: Record<Side, MapNode> = {
      w: buildRepertoireMap(repertoires.w, recent.w, { toSettle: toSettle.w, priorities, createdAt, freshSince: daysBefore(day, FRESH_DAYS) }),
      b: buildRepertoireMap(repertoires.b, recent.b, { toSettle: toSettle.b, priorities, createdAt, freshSince: daysBefore(day, FRESH_DAYS) }),
    };
    return { maps, recent, priorities };
  }, [known, day, repertoires, steps, createdAt, worked]);
}
