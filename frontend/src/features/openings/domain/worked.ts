import type { GameCheck } from './gameCheck';
import type { PlayedGame } from './playedGame';

export interface Adherence {
  followed: number;
  games: number;
}

export const isThrough = (game: PlayedGame, path: readonly string[]) => path.every((san, index) => game.moves[index] === san);

/**
 * L'adhérence d'une ligne travaillée (CONTEXT.md) : parmi les parties passées par la ligne depuis le
 * travail, celles qui ont suivi le répertoire jusqu'au bout, ou jusqu'à ce que l'adversaire en sorte.
 */
export function adherence(checked: readonly { game: PlayedGame; check: GameCheck }[], line: { side: PlayedGame['side']; path: readonly string[]; since: string }): Adherence {
  const games = checked.filter(({ game }) => game.side === line.side && game.playedAt > line.since && isThrough(game, line.path));
  return { games: games.length, followed: games.filter(({ check }) => check.kind !== 'left').length };
}
