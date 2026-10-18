import { asksDecision, checkGame } from '../domain/gameCheck';
import type { PlayedGame, Side } from '../domain/playedGame';
import type { Repertoire } from '../domain/repertoire';
import type { CheckedGame } from './checkedGame';

/** Les parties rejouées jusqu'à `day` inclus, dans l'ordre où elles ont été jouées, chacune contrôlée. */
export function liveGames(
  games: readonly PlayedGame[],
  repertoires: Record<Side, Repertoire>,
  firstDay: string,
  day: string,
): CheckedGame[] {
  const lived = games
    .map((game, id) => ({ id, game }))
    .filter(({ game }) => game.playedAt > firstDay && game.playedAt <= day)
    .sort((a, b) => a.game.playedAt.localeCompare(b.game.playedAt))
    .map(({ id, game }) => ({ id, game, check: checkGame(repertoires[game.side], game) }));
  const asks = asksDecision(lived);
  return lived.map((checked, index) => ({ ...checked, asks: asks[index] }));
}

export const isOpen = (checked: CheckedGame, ignored: ReadonlySet<number>) =>
  checked.check.kind !== 'followed' && !ignored.has(checked.id);

/** Ce qui attend le joueur : les parties du jour sorties du répertoire, puis les décisions des jours passés. */
export function gamesToDecide(lived: readonly CheckedGame[], ignored: ReadonlySet<number>, day: string): CheckedGame[] {
  // Toute partie sortie du répertoire se tranche le jour même ; seules celles qui demandent une décision attendent ensuite.
  const today = lived.filter((checked) => checked.game.playedAt === day && isOpen(checked, ignored));
  const earlier = lived.filter((checked) => checked.game.playedAt < day && checked.asks && isOpen(checked, ignored));
  return [...today, ...earlier.reverse()];
}
