interface Tally {
  white: number;
  draws: number;
  black: number;
}

/** Ce que l'explorateur Lichess renvoie d'une position : ses parties et les coups joués. */
export interface ExplorerStats extends Tally {
  moves: (Tally & { san: string })[];
}

export type MoveSource = 'habit' | 'level' | 'engine';
