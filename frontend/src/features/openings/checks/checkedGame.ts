import type { GameCheck } from '../domain/gameCheck';
import type { PlayedGame } from '../domain/playedGame';

/** Une partie du rejeu et son contrôle ; `id` est son rang dans l'historique, stable d'un chargement à l'autre. */
export interface CheckedGame {
  id: number;
  game: PlayedGame;
  check: GameCheck;
  /** Les positions où le joueur a joué un coup de son répertoire, avant que la partie n'en sorte. */
  answered: readonly string[];
  /** Voir `asksDecision` : un coup adverse hors répertoire ne compte qu'à sa deuxième rencontre. */
  asks: boolean;
}

