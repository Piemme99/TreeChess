import type { PlayedGame, Side } from '../domain/playedGame';
import { createRepertoire, type Repertoire } from '../domain/repertoire';
import { dayBefore } from '../domain/replay';

// Début du rejeu de l'historique : le répertoire naît des parties d'avant (README, « the repertoire loop »).
export const REPLAY_START = '2026-01-01';
export const REPLAY_FIRST_DAY = dayBefore(REPLAY_START);

export function repertoiresOf(games: readonly PlayedGame[], today: string): Record<Side, Repertoire> {
  return { w: createRepertoire(games, 'w', today), b: createRepertoire(games, 'b', today) };
}
