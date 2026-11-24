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

