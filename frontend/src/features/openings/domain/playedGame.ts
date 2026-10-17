export type Side = 'w' | 'b';

export type GameScore = 0 | 0.5 | 1;

export interface PlayedGame {
  side: Side;
  // SAN canonique, validé par chess.js à l'import : l'arbre ne rejoue pas les
  // coups, chess.js coûte ~0,1 ms par coup, soit des secondes sur un historique.
  moves: string[];
  score: GameScore;
  /** Date ISO (AAAA-MM-JJ) à laquelle la partie s'est terminée. */
  playedAt: string;
}
