import type { GameAnalysis, MoveAnalysis } from '../../../types';

export function getFirstActionableMove(game: GameAnalysis): MoveAnalysis | null {
  return game.moves.find(
    (m) => m.status === 'opponent-new' || m.status === 'out-of-repertoire'
  ) || null;
}

export interface GameStats {
  totalGames: number;
  gamesWithErrors: number;
  gamesWithNewLines: number;
  gamesAllOk: number;
}

export function calculateStats(results: GameAnalysis[]): GameStats {
  let gamesWithErrors = 0;
  let gamesWithNewLines = 0;
  let gamesAllOk = 0;

  for (const game of results) {
    const firstActionable = getFirstActionableMove(game);

    if (!firstActionable) {
      gamesAllOk++;
    } else if (firstActionable.status === 'out-of-repertoire') {
      gamesWithErrors++;
    } else if (firstActionable.status === 'opponent-new') {
      gamesWithNewLines++;
    }
  }

  return {
    totalGames: results.length,
    gamesWithErrors,
    gamesWithNewLines,
    gamesAllOk
  };
}