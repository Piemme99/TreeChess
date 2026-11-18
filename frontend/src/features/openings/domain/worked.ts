import type { GameCheck } from './gameCheck';
import type { PlayedGame, Side } from './playedGame';
import { isProvenWeak } from './priorities';

export interface Adherence {
  followed: number;
  games: number;
}

interface WorkedOn {
  side: Side;
  path: readonly string[];
  since: string;
}

export const isThrough = (game: PlayedGame, path: readonly string[]) => path.every((san, index) => game.moves[index] === san);

/**
 * L'adhérence d'une ligne travaillée (CONTEXT.md) : parmi les parties passées par la ligne depuis le
 * travail, celles qui ont suivi le répertoire jusqu'au bout, ou jusqu'à ce que l'adversaire en sorte.
 */
export function adherence(checked: readonly { game: PlayedGame; check: GameCheck }[], line: WorkedOn): Adherence {
  const games = checked.filter(({ game }) => game.side === line.side && game.playedAt > line.since && isThrough(game, line.path));
  return { games: games.length, followed: games.filter(({ check }) => check.kind !== 'left').length };
}

/**
 * Une ouverture faible déjà travaillée n'est plus à faire : le score sur 12 mois mettrait des mois à le
 * dire. Elle ne revient que si les parties jouées depuis le travail la prouvent encore faible, et cède
 * d'ici là sa place parmi les `limit` à faire à la suivante.
 */
export function splitWorked<P extends { side: Side; path: readonly string[]; average: number }>(
  priorities: readonly P[],
  worked: readonly WorkedOn[],
  games: readonly PlayedGame[],
  limit = Infinity,
): { toWork: P[]; treated: P[] } {
  const toWork: P[] = [];
  const treated: P[] = [];
  for (const priority of priorities) {
    const line = worked.find((known) => known.side === priority.side && known.path.join(' ') === priority.path.join(' '));
    if (line && !isWeakSince(line, games, priority.average)) treated.push(priority);
    else toWork.push(priority);
  }
  return { toWork: toWork.slice(0, limit), treated };
}

function isWeakSince(line: WorkedOn, games: readonly PlayedGame[], average: number): boolean {
  const since = games.filter((game) => game.side === line.side && game.playedAt > line.since && isThrough(game, line.path));
  return isProvenWeak({ games: since.length, score: since.reduce((sum, game) => sum + game.score, 0) }, average);
}
