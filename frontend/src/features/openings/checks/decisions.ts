import { asksDecision, followGame } from '../domain/gameCheck';
import type { PlayedGame, Side } from '../domain/playedGame';
import type { Repertoire } from '../domain/repertoire';
import type { CheckedGame } from './checkedGame';

/** Les parties rejouées jusqu'à `day` inclus, dans l'ordre où elles ont été jouées, chacune contrôlée contre le répertoire de son jour. */
export function liveGames(
  games: readonly PlayedGame[],
  repertoireOn: (side: Side, day: string) => Repertoire,
  firstDay: string,
  day: string,
): CheckedGame[] {
  const lived = games
    .map((game, id) => ({ id, game }))
    .filter(({ game }) => game.playedAt > firstDay && game.playedAt <= day)
    .sort((a, b) => a.game.playedAt.localeCompare(b.game.playedAt))
    .map(({ id, game }) => ({ id, key: game.key ?? String(id), game, ...followGame(repertoireOn(game.side, game.playedAt), game) }));
  const asks = asksDecision(lived);
  return lived.map((checked, index) => ({ ...checked, asks: asks[index] }));
}

const isOpen = (checked: CheckedGame, ignored: ReadonlySet<string>) =>
  checked.check.kind !== 'followed' && !ignored.has(checked.key);

/** Ce qui attend le joueur : les parties du jour sorties du répertoire, puis les décisions des jours passés. */
export function gamesToDecide(lived: readonly CheckedGame[], ignored: ReadonlySet<string>, day: string): CheckedGame[] {
  // Toute partie sortie du répertoire se tranche le jour même ; seules celles qui demandent une décision attendent ensuite.
  const today = lived.filter((checked) => checked.game.playedAt === day && isOpen(checked, ignored));
  const earlier = lived.filter((checked) => checked.game.playedAt < day && checked.asks && isOpen(checked, ignored));
  return [...today, ...earlier.reverse()];
}

/**
 * Les parties écartées, par leur identité. Avant Chess.com, elles l'étaient par leur rang dans la liste ; des parties
 * Chess.com plus anciennes décaleraient ce rang, pas celui parmi les parties Lichess, seules importées jusque-là.
 */
export function ignoredKeys(stored: readonly (number | string)[], games: readonly PlayedGame[]): Set<string> {
  const lichess = games.filter((game) => game.key?.startsWith('lichess:'));
  return new Set(stored.map((entry) => (typeof entry === 'string' ? entry : (lichess[entry]?.key ?? String(entry)))));
}
