import { Chess } from 'chess.js';
import type { LinePosition, LineStep } from './line';
import type { Side } from './playedGame';

export interface Evaluation {
  /** Centipions du point de vue des Blancs ; un mat vaut ±MATE_CP. */
  cp: number;
  /** Meilleur coup en UCI, absent en fin de partie. */
  best?: string;
}

export const MATE_CP = 3000;

// Formule de Lichess : chances de gain à partir des centipions, calibrée sur ses parties tous niveaux.
export const winChance = (cp: number) => 1 / (1 + Math.exp(-0.00368208 * cp));

/** Écart, en chances, à partir duquel une cause de la perte mérite d'être travaillée. */
export const WORTH_WORKING = 0.03;

const SMOOTHING_GAMES = 12;
const MIN_KEY_GAMES = 5;
// En deçà, la perte d'un coup est du bruit de moteur.
const MOVE_LOSS = 0.02;
// À écart presque égal, la position où le joueur a le trait : c'est là qu'il a un choix à travailler.
const KEY_TIE = 0.9;
const MISTAKE_DROP = 0.1;
const MISTAKE_HOLD = 0.08;

export interface LinePoint {
  ply: number;
  games: number;
  score: number;
  /** Ce que vaut la position pour ce joueur : chances du moteur, recalées sur sa moyenne au départ. */
  worth: number | null;
}

export interface CostlyMove {
  ply: number;
  san: string;
  loss: number;
  best: string | null;
}

export interface LineDiagnosis {
  points: LinePoint[];
  /** Ce que coûtent les coups de la ligne, du départ à la position étudiée. */
  openingCost: number | null;
  /** Ce que vaut la position étudiée, moins ce que le joueur y marque. */
  playCost: number | null;
  /** Coups du joueur sur la ligne que le moteur juge coûteux, du plus cher au moins cher. */
  costlyMoves: CostlyMove[];
  key: number | null;
  /** Toutes les positions de la ligne sont évaluées. */
  complete: boolean;
}

interface StudiedPositions {
  positions: readonly LinePosition[];
  steps: readonly LineStep[];
  entry: number;
  average: number;
}

/**
 * Sépare ce que coûtent les coups d'ouverture (le moteur trouve la position moins bonne) de ce
 * qui se perd ensuite (le joueur marque moins que ce que vaut la position). `fens[ply]` est la
 * position atteinte après `ply` demi-coups de la ligne.
 */
export function diagnoseLine(
  { positions, steps, entry, average }: StudiedPositions,
  side: Side,
  evaluations: ReadonlyMap<string, Evaluation>,
  fens: readonly string[],
): LineDiagnosis {
  const pov = (cp: number) => (side === 'w' ? cp : -cp);
  const start = evaluations.get(fens[0]);
  const offset = start ? average - winChance(pov(start.cp)) : 0;

  const points = positions.map((position): LinePoint => {
    const evaluation = evaluations.get(fens[position.ply]);
    return {
      ply: position.ply,
      games: position.games,
      score: position.rate,
      worth: evaluation ? winChance(pov(evaluation.cp)) + offset : null,
    };
  });

  const costlyMoves = steps
    .filter((step) => step.byPlayer)
    .flatMap((step): CostlyMove[] => {
      const before = points[step.ply - 1].worth;
      const after = points[step.ply].worth;
      if (before === null || after === null || before - after < MOVE_LOSS) return [];
      return [{ ply: step.ply, san: step.san, loss: before - after, best: uciToSan(fens[step.ply - 1], evaluations.get(fens[step.ply - 1])?.best) }];
    })
    .sort((a, b) => b.loss - a.loss);

  const gapAt = (point: LinePoint) =>
    point.worth === null || point.games < MIN_KEY_GAMES ? 0 : (point.worth - point.score) * (point.games / (point.games + SMOOTHING_GAMES));
  let key: number | null = null;
  let widest = 0;
  for (const point of points.slice(1)) {
    if (gapAt(point) > widest) {
      widest = gapAt(point);
      key = point.ply;
    }
  }
  if (key !== null && key > 1 && !positions[key].playerToMove && gapAt(points[key - 1]) >= widest * KEY_TIE) key -= 1;

  const studied = points[entry];
  return {
    points,
    openingCost: studied.worth === null ? null : average - studied.worth,
    playCost: studied.worth === null ? null : studied.worth - studied.score,
    costlyMoves,
    key,
    complete: points.every((point) => point.worth !== null),
  };
}

export function uciToSan(fen: string, uci: string | undefined): string | null {
  if (!uci || uci === '(none)') return null;
  try {
    return new Chess(fen).move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] }).san;
  } catch {
    return null;
  }
}

/** Les positions d'une partie, de la position clé jusqu'à `plies` demi-coups plus loin. */
export function gameFens(moves: readonly string[], from: number, plies: number): string[] {
  const chess = new Chess();
  moves.slice(0, from).forEach((san) => chess.move(san));
  const fens = [chess.fen()];
  for (const san of moves.slice(from, from + plies)) {
    chess.move(san);
    fens.push(chess.fen());
  }
  return fens;
}

export interface DecisiveMistake {
  /** Rang du demi-coup fautif dans la partie. */
  ply: number;
  san: string;
  drop: number;
  best: string | null;
}

export interface GameCourse {
  /** Chances du joueur à chaque position, `null` tant qu'elle n'est pas évaluée. */
  chances: (number | null)[];
  mistake: DecisiveMistake | null;
}

/**
 * L'erreur décisive est le coup du joueur qui fait le plus chuter ses chances : la première
 * imprécision est souvent rattrapée. La référence est la plus basse des deux positions
 * précédentes : en pleine prise, l'évaluation à faible profondeur saute d'un demi-coup à
 * l'autre et ferait passer la reprise pour une faute.
 */
export function followGame(
  moves: readonly string[],
  from: number,
  fens: readonly string[],
  side: Side,
  evaluations: ReadonlyMap<string, Evaluation>,
): GameCourse {
  const chances = fens.map((fen) => {
    const evaluation = evaluations.get(fen);
    return evaluation ? winChance(side === 'w' ? evaluation.cp : -evaluation.cp) : null;
  });
  if (chances.includes(null)) return { chances, mistake: null };
  const known = chances as number[];
  const playerToMove = (index: number) => ((from + index) % 2 === 0) === (side === 'w');

  let mistake: DecisiveMistake | null = null;
  for (let index = 0; index + 1 < known.length; index++) {
    if (!playerToMove(index)) continue;
    const reference = Math.min(known[index], known[index - 1] ?? known[index]);
    const drop = reference - known[index + 1];
    const later = known[index + 2];
    if (drop < MISTAKE_DROP || (later !== undefined && reference - later < MISTAKE_HOLD) || (mistake && drop <= mistake.drop)) continue;
    mistake = { ply: from + index + 1, san: moves[from + index], drop, best: uciToSan(fens[index], evaluations.get(fens[index])?.best) };
  }
  return { chances, mistake };
}
