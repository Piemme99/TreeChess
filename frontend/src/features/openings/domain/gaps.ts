import { Chess } from 'chess.js';
import type { Side } from './playedGame';
import type { ExplorerStats } from './preparation';
import { positionKey, repertoireMovesAt, type Repertoire } from './repertoire';

/** Une position où l'adversaire amène souvent le joueur sans que son répertoire y ait de coup. */
export interface Gap {
  side: Side;
  /** La ligne jusqu'au coup adverse qui l'amène, celui-ci compris. */
  path: readonly string[];
  /** La part des parties du niveau du joueur qui y arrivent, s'il joue toujours son répertoire. */
  reach: number;
}

// Chessbook propose « 1 partie sur 200 » : en deçà, préparer une réponse coûte plus qu'elle ne rapporte.
export const COVERAGE_GOAL = 1 / 200;
const MAX_PLIES = 30;
const START = new Chess().fen();

const after = (fen: string, san: string) => {
  const chess = new Chess(fen);
  chess.move(san);
  return chess.fen();
};

const gamesOf = (tally: { white: number; draws: number; black: number }) => tally.white + tally.draws + tally.black;

/**
 * Les trous du répertoire, le plus fréquent d'abord. `statsAt` donne ce que jouent les adversaires du niveau du joueur ;
 * une position qu'il ne connaît pas encore arrête la recherche à cet endroit et figure dans `missing`, à demander avant
 * de recommencer. Deux ordres de coups qui transposent additionnent leurs parties.
 */
export function findGaps(
  repertoire: Repertoire,
  statsAt: (fen: string) => ExplorerStats | undefined,
  goal = COVERAGE_GOAL,
): { gaps: Gap[]; missing: string[] } {
  const { side } = repertoire;
  const gaps = new Map<string, Gap>();
  const missing: string[] = [];
  // Par demi-coup : une transposition arrive presque toujours au même, ses parts s'y additionnent avant d'aller plus loin.
  let level = new Map([[positionKey(START), { fen: START, path: [] as string[], reach: 1 }]]);
  for (let ply = 0; level.size && ply < MAX_PLIES; ply++) {
    const next = new Map<string, { fen: string; path: string[]; reach: number }>();
    const reach = (fen: string, path: string[], share: number) => {
      const key = positionKey(fen);
      const known = next.get(key);
      if (known) known.reach += share;
      else next.set(key, { fen, path, reach: share });
    };
    for (const [key, { fen, path, reach: share }] of level) {
      if (fen.split(' ')[1] === side) {
        const planned = repertoireMovesAt(repertoire, fen);
        if (!planned.length && path.length) {
          const known = gaps.get(key);
          if (known) known.reach += share;
          else gaps.set(key, { side, path, reach: share });
        }
        for (const move of planned) reach(after(fen, move.san), [...path, move.san], share);
        continue;
      }
      const stats = statsAt(fen);
      if (!stats) {
        missing.push(fen);
        continue;
      }
      const total = gamesOf(stats);
      for (const move of stats.moves) {
        const moveShare = total ? (share * gamesOf(move)) / total : 0;
        if (moveShare >= goal) reach(after(fen, move.san), [...path, move.san], moveShare);
      }
    }
    level = next;
  }
  return { gaps: [...gaps.values()].sort((a, b) => b.reach - a.reach), missing };
}
