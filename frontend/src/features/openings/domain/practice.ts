import { Chess } from 'chess.js';
import type { GameCheck } from './gameCheck';
import { isPlayerMove } from './openingTree';
import type { Side } from './playedGame';
import { positionKey } from './repertoire';
import type { Judgement } from './judgement';
import type { ExplorerStats } from './preparation';

// Une réponse jouée dans moins de 5 % des parties n'est pas celle qu'on rencontrera : elle n'est jamais tirée.
const MIN_SHARE = 0.05;
// Plus rare que ça à ce niveau, la position ne vaut pas qu'on s'y prépare : la partie s'arrête.
const MIN_GAMES = 100;
const LAST_PLY = 30;

/** Pourquoi une partie d'entraînement s'arrête : position trop rare au niveau du joueur, coup 15 joué, mat ou pat, ou « End ». */
export type PracticeEnd = 'rare' | 'move-15' | 'over' | 'stopped';

export type OpponentTurn = { reply: string; end: PracticeEnd | null } | { reply: null; end: PracticeEnd };

const gamesOf = (tally: { white: number; draws: number; black: number }) => tally.white + tally.draws + tally.black;

export const pastLastMove = (plies: number) => plies >= LAST_PLY;

/**
 * Le coup de l'adversaire, tiré au hasard parmi ceux que jouent les joueurs de son niveau, aussi souvent qu'ils le
 * jouent ; `random` est dans [0, 1). `end` dit si la partie s'arrête sur cette réponse.
 */
export function opponentTurn(stats: ExplorerStats, plies: number, random: number): OpponentTurn {
  if (pastLastMove(plies)) return { reply: null, end: 'move-15' };
  const games = gamesOf(stats);
  const replies = stats.moves.filter((move) => gamesOf(move) >= MIN_SHARE * games);
  if (games < MIN_GAMES || !replies.length) return { reply: null, end: 'rare' };
  let left = random * replies.reduce((sum, move) => sum + gamesOf(move), 0);
  const reply = replies.find((move) => (left -= gamesOf(move)) < 0) ?? replies[replies.length - 1];
  const end = pastLastMove(plies + 1) ? 'move-15' : gamesOf(reply) < MIN_GAMES ? 'rare' : null;
  return { reply: reply.san, end };
}

/** La position où s'ouvre la relecture, en demi-coups : juste après le premier coup que le répertoire ne prévoyait pas. */
export function reviewStart(check: GameCheck, plies: number): number {
  return check.kind === 'followed' ? Math.min(check.plies + 1, plies) : check.ply + 1;
}

/** L'avis du moteur sur un écart du joueur : `judging` tant qu'il calcule, `blind` s'il ne répondra pas. */
export type DepartureVerdict = Judgement | null | 'judging' | 'blind';

/**
 * La marque du premier écart, comme sur Home : ? une réponse adverse sans parade, ! un coup du joueur que le moteur
 * trouve moins bon, · un coup sain, … tant que le moteur calcule.
 */
export function departureMark(kind: 'left' | 'uncovered', verdict: DepartureVerdict): '?' | '!' | '·' | '…' {
  // À l'entraînement, la réponse adverse est là pour qu'on la prépare : pas besoin de la croiser deux fois.
  if (kind === 'uncovered') return '?';
  if (verdict === 'judging') return '…';
  // Sans moteur on ne saura pas : mieux vaut signaler l'écart que le taire, comme dans Check.
  return verdict ? '!' : '·';
}

/**
 * Ce que la partie laisse à trancher : `left` un coup du joueur à la place de celui du répertoire, `uncovered` une
 * réponse adverse sans parade, `past` un coup du joueur là où le répertoire n'a plus rien.
 */
export interface PracticeStep {
  kind: 'left' | 'uncovered' | 'past';
  ply: number;
  played: string;
  planned: readonly string[];
  position: string;
}

/** Le premier écart de la partie, ou son premier coup après la fin de la préparation ; `null` si elle n'a rien quitté. */
export function practiceStep(check: GameCheck, path: readonly string[], side: Side): PracticeStep | null {
  if (check.kind !== 'followed') return check;
  if (check.plies >= path.length) return null;
  const chess = new Chess();
  for (const san of path.slice(0, check.plies)) chess.move(san);
  // Au bout de la préparation, la réponse adverse attend sa parade comme celle qui en sort.
  const kind = isPlayerMove(side, check.plies + 1) ? 'past' : 'uncovered';
  return { kind, ply: check.plies, played: path[check.plies], planned: [], position: positionKey(chess.fen()) };
}

/** Un coup du répertoire manqué à l'entraînement revient en révision, comme un oubli en partie. */
export const lapseOf = (step: PracticeStep | null): string | null => (step?.kind === 'left' ? step.position : null);
