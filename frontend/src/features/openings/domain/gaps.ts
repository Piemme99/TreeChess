import { Chess } from 'chess.js';
import type { Side } from './playedGame';
import type { ExplorerStats } from './preparation';
import { positionKey, repertoireMovesAt, type Repertoire } from './repertoire';

/** Une position où l'adversaire amène souvent le joueur sans que son répertoire y ait de coup. */
export interface Gap {
  side: Side;
  /** La position, quel que soit l'ordre de coups qui y mène. */
  key: string;
  /** La ligne jusqu'au coup adverse qui l'amène, celui-ci compris : celle des parties les plus nombreuses. */
  path: readonly string[];
  /** La part des parties du niveau du joueur qui y arrivent, s'il joue toujours son répertoire. */
  reach: number;
}

// Chessbook propose « 1 partie sur 200 » : en deçà, préparer une réponse coûte plus qu'elle ne rapporte.
export const COVERAGE_GOAL = 1 / 200;
const MAX_PLIES = 30;
// Sous l'objectif, un ordre de coups ne compte que s'il pèse assez pour qu'un autre le complète.
const TRANSPOSED_FLOOR = 0.2;
const START = new Chess().fen();

const after = (fen: string, san: string) => {
  const chess = new Chess(fen);
  chess.move(san);
  return chess.fen();
};

const gamesOf = (tally: { white: number; draws: number; black: number }) => tally.white + tally.draws + tally.black;

/** Les coups choisis par le joueur pour y arriver, par position. */
type Choices = ReadonlyMap<string, string>;

interface Arrival {
  path: string[];
  reach: number;
  choices: Choices;
}

/** Une position et les ordres de coups qui y mènent ; son chemin est celui qui pèse le plus. */
interface Reached extends Arrival {
  fen: string;
  arrivals: Arrival[];
}

/**
 * Les trous du répertoire, le plus fréquent d'abord. `statsAt` donne ce que jouent les adversaires du niveau du joueur ;
 * une position qu'il ne connaît pas encore arrête la recherche à cet endroit et figure dans `missing`, à demander avant
 * de recommencer ; `pending` dit quelle part des parties y attend encore. Deux ordres de coups qui transposent
 * additionnent leurs parties, sauf s'ils se séparent sur un coup du joueur : ce sont alors deux choix, pas deux parts.
 */
export function findGaps(
  repertoire: Repertoire,
  statsAt: (fen: string) => ExplorerStats | undefined,
  goal = COVERAGE_GOAL,
): { gaps: Gap[]; missing: string[]; pending: number } {
  const { side } = repertoire;
  const missing: string[] = [];
  let pending = 0;
  const contradicts = (a: Choices, b: Choices) => [...a].some(([key, san]) => b.has(key) && b.get(key) !== san);
  // Les arrivées les plus lourdes d'abord, chacune gardée si elle ne contredit aucun choix du joueur déjà retenu.
  const settle = (reached: Reached) => {
    const kept: Arrival[] = [];
    for (const arrival of [...reached.arrivals].sort((a, b) => b.reach - a.reach)) {
      if (!kept.some((other) => contradicts(other.choices, arrival.choices))) kept.push(arrival);
    }
    reached.reach = kept.reduce((sum, arrival) => sum + arrival.reach, 0);
    reached.path = kept[0].path;
    reached.choices = new Map(kept.flatMap((arrival) => [...arrival.choices]));
  };
  const arrive = (into: Map<string, Reached>, fen: string, arrival: Arrival) => {
    const key = positionKey(fen);
    const known = into.get(key);
    if (known) known.arrivals.push(arrival);
    else into.set(key, { fen, arrivals: [arrival], ...arrival });
  };
  const gaps = new Map<string, Reached>();
  // Par demi-coup : une transposition arrive presque toujours au même, ses parts s'y additionnent avant d'aller plus loin.
  let level = new Map<string, Reached>();
  arrive(level, START, { path: [], reach: 1, choices: new Map() });
  for (let ply = 0; level.size && ply < MAX_PLIES; ply++) {
    const next = new Map<string, Reached>();
    for (const reached of level.values()) settle(reached);
    for (const { fen, path, reach, choices } of level.values()) {
      if (fen.split(' ')[1] === side) {
        const planned = repertoireMovesAt(repertoire, fen);
        if (!planned.length && path.length) arrive(gaps, fen, { path, reach, choices });
        for (const move of planned) {
          arrive(next, after(fen, move.san), { path: [...path, move.san], reach, choices: new Map([...choices, [positionKey(fen), move.san]]) });
        }
        continue;
      }
      // Gardée jusqu'ici au cas où un autre ordre de coups la ferait passer l'objectif.
      if (reach < goal) continue;
      const stats = statsAt(fen);
      if (!stats) {
        missing.push(fen);
        pending += reach;
        continue;
      }
      const total = gamesOf(stats);
      for (const move of stats.moves) {
        const share = total ? (reach * gamesOf(move)) / total : 0;
        if (share >= goal * TRANSPOSED_FLOOR) arrive(next, after(fen, move.san), { path: [...path, move.san], reach: share, choices });
      }
    }
    level = next;
  }
  for (const reached of gaps.values()) settle(reached);
  return {
    gaps: [...gaps.entries()]
      .filter(([, reached]) => reached.reach >= goal)
      .map(([key, { path, reach }]) => ({ side, key, path, reach }))
      .sort((a, b) => b.reach - a.reach),
    missing,
    pending,
  };
}
