import type { GameCheck } from '../domain/gameCheck';
import type { PlayedGame } from '../domain/playedGame';

/** Une partie du rejeu et son contrôle ; `id` est son rang dans l'historique, stable d'un chargement à l'autre. */
export interface CheckedGame {
  id: number;
  game: PlayedGame;
  check: GameCheck;
  /** Voir `asksDecision` : un coup adverse hors répertoire ne compte qu'à sa deuxième rencontre. */
  asks: boolean;
}

/** Le chemin jusqu'à la position que le contrôle désigne : l'écart, ou la fin du répertoire. */
export const checkedPath = ({ game, check }: CheckedGame) =>
  game.moves.slice(0, check.kind === 'followed' ? check.plies : check.ply);
