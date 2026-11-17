import { dayAfter } from '../domain/replay';
import type { PlayedGame, Side } from '../domain/playedGame';
import { playedGamesFixture } from '../fixtures/playedGames';
import { REPLAY_FIRST_DAY, REPLAY_START } from '../replay/replaySetup';

/** Les parties que lisent les pages : celles du joueur importées de Lichess, ou la démo rejouée jour par jour. */
export interface GameSource {
  id: string;
  games: readonly PlayedGame[];
  /** Le jour où naît le répertoire : les parties d'avant le font. */
  start: string;
  /** La veille de `start` : le rejeu part de là, un import s'y arrête. */
  firstDay: string;
  replay: boolean;
}

export const DEMO_SOURCE: GameSource = { id: 'demo', games: playedGamesFixture, start: REPLAY_START, firstDay: REPLAY_FIRST_DAY, replay: true };

/** Une partie telle que l'envoie GET /api/v2/games. */
export interface ImportedGame {
  color: 'white' | 'black';
  moves: string;
  score: number;
  playedAt: string;
}

/** Le répertoire naît le jour de l'import, de toutes les parties jouées jusque-là, ce jour compris. */
export function importedSource(username: string, games: readonly ImportedGame[], importedOn: string): GameSource {
  return {
    id: `lichess:${username.toLowerCase()}`,
    games: games.map((game) => ({
      side: (game.color === 'white' ? 'w' : 'b') as Side,
      moves: game.moves.split(' ').filter(Boolean),
      score: game.score === 1 ? 1 : game.score === 0 ? 0 : 0.5,
      playedAt: game.playedAt,
    })),
    start: dayAfter(importedOn),
    firstDay: importedOn,
    replay: false,
  };
}
