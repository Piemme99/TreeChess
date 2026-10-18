// PROTOTYPE — moteur contre résultats sur une ligne étudiée. À jeter avec le dossier.
import { Chess } from 'chess.js';
import type { Side } from '../domain/playedGame';
import type { Evaluation } from './engine';
import type { LineStudy } from './study';

// Formule de Lichess : chances de gain à partir des centipions, calibrée sur ses parties tous niveaux.
export const winChance = (cp: number) => 1 / (1 + Math.exp(-0.00368208 * cp));

const SMOOTHING_GAMES = 12;
const MIN_KEY_GAMES = 5;
/** Perte de chances au-delà de laquelle un coup du joueur compte comme une erreur d'ouverture. */
export const OPENING_LOSS = 0.05;
const TURN_DROP = 0.1;
const TURN_HOLD = 0.08;

export interface LinePoint {
  ply: number;
  games: number;
  score: number;
  /** Ce que vaut la position pour ce joueur : chances du moteur, recalées sur sa moyenne au départ. */
  worth: number | null;
  cp: number | null;
}

export interface OpeningLoss {
  ply: number;
  san: string;
  loss: number;
  best: string | null;
}

export interface Diagnosis {
  points: LinePoint[];
  /** Chances perdues par les coups de la ligne, de la position de départ à l'entrée. */
  openingCost: number | null;
  /** Ce que la position d'entrée vaut, moins ce que le joueur y marque. */
  playCost: number | null;
  losses: OpeningLoss[];
  /** Position où le joueur marque le plus en dessous de ce qu'elle vaut. */
  key: number | null;
  evaluated: number;
}

export function diagnose(study: LineStudy, side: Side, evaluations: Map<string, Evaluation>, fens: readonly string[]): Diagnosis {
  const pov = (cp: number) => (side === 'w' ? cp : -cp);
  const start = evaluations.get(fens[0]);
  const offset = start ? study.average - winChance(pov(start.cp)) : 0;

  const points = study.positions.map((position, ply) => {
    const evaluation = evaluations.get(fens[ply]);
    return {
      ply,
      games: position.games,
      score: position.rate,
      worth: evaluation ? winChance(pov(evaluation.cp)) + offset : null,
      cp: evaluation ? pov(evaluation.cp) : null,
    };
  });

  const losses: OpeningLoss[] = [];
  for (const step of study.steps) {
    if (!step.byPlayer) continue;
    const before = points[step.ply - 1].worth;
    const after = points[step.ply].worth;
    if (before === null || after === null || before - after < OPENING_LOSS) continue;
    losses.push({ ply: step.ply, san: step.san, loss: before - after, best: sanOf(fens[step.ply - 1], evaluations.get(fens[step.ply - 1])?.best) });
  }

  const entry = points[study.entry];
  let key: number | null = null;
  let worst = 0;
  for (const point of points.slice(1)) {
    if (point.worth === null || point.games < MIN_KEY_GAMES) continue;
    const gap = (point.worth - point.score) * (point.games / (point.games + SMOOTHING_GAMES));
    if (gap > worst) {
      worst = gap;
      key = point.ply;
    }
  }

  return {
    points,
    openingCost: entry.worth === null ? null : study.average - entry.worth,
    playCost: entry.worth === null ? null : entry.worth - entry.score,
    losses,
    key,
    evaluated: points.filter((point) => point.worth !== null).length,
  };
}

export function sanOf(fen: string, uci: string | undefined): string | null {
  if (!uci || uci === '(none)') return null;
  try {
    return new Chess(fen).move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] }).san;
  } catch {
    return null;
  }
}

export interface GameTurn {
  /** Rang du demi-coup fautif dans la partie. */
  ply: number;
  san: string;
  drop: number;
  best: string | null;
  fenBefore: string;
}

export interface AnalysedGame {
  chances: (number | null)[];
  turn: GameTurn | null;
}

/** Positions d'une partie à partir de la position clé, pour le moteur. */
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

/**
 * Le coup du joueur qui fait le plus chuter ses chances : la première imprécision est souvent
 * rattrapée, la chute la plus forte décide de la partie. La référence est la plus basse des deux
 * positions précédentes : en pleine prise, l'évaluation à faible profondeur saute d'un demi-coup
 * à l'autre et ferait passer la reprise pour une faute.
 */
export function analyseGame(moves: readonly string[], from: number, fens: readonly string[], side: Side, evaluations: Map<string, Evaluation>): AnalysedGame {
  const chances = fens.map((fen) => {
    const evaluation = evaluations.get(fen);
    return evaluation ? winChance(side === 'w' ? evaluation.cp : -evaluation.cp) : null;
  });
  if (chances.some((chance) => chance === null)) return { chances, turn: null };
  const known = chances as number[];
  const playerToMove = (index: number) => ((from + index) % 2 === 0) === (side === 'w');

  let turn: GameTurn | null = null;
  for (let index = 0; index + 1 < known.length; index++) {
    if (!playerToMove(index)) continue;
    const reference = Math.min(known[index], known[index - 1] ?? known[index]);
    const drop = reference - known[index + 1];
    const later = known[index + 2];
    if (drop < TURN_DROP || (later !== undefined && reference - later < TURN_HOLD) || (turn && drop <= turn.drop)) continue;
    turn = {
      ply: from + index + 1,
      san: moves[from + index],
      drop,
      best: sanOf(fens[index], evaluations.get(fens[index])?.best),
      fenBefore: fens[index],
    };
  }
  return { chances, turn };
}
