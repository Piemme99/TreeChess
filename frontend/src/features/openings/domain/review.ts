import { Chess } from 'chess.js';
import type { OpeningNode, OpeningTree } from './openingTree';
import { positionKey, repertoireMovesAt, type Repertoire } from './repertoire';

/** Où en est une position du joueur dans la révision : sa boîte de Leitner et le jour où elle revient. */
export interface ReviewCard {
  box: number;
  due: string;
  reviewedAt: string;
  /** Dernière réponse fausse, en révision ou en partie : la position ne compte plus comme sue. */
  missed?: true;
}

export type ReviewState = ReadonlyMap<string, ReviewCard>;

const INTERVALS = [1, 7, 30];
const MAX_PLIES = 40;
// Un coup joué presque toujours, sur assez de parties, est su : il ne revient qu'au bout d'un mois.
const KNOWN_SHARE = 0.9;
const KNOWN_GAMES = 10;
// Les deux derniers coups du joueur avant la position révisée, pour la retrouver dans son contexte.
const LEAD_IN = 2;
// Une séance se compte en positions dues, pas en lignes : une ligne en révise ~1,5 quelle que soit sa longueur (#261).
export const SESSION_POSITIONS = 15;
export const REVIEW_START = new Chess().fen();

export const addDays = (day: string, days: number) => new Date(Date.parse(`${day}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

const turnOf = (fen: string) => fen.split(' ')[1];

const after = (fen: string, san: string) => {
  const chess = new Chess(fen);
  chess.move(san);
  return chess.fen();
};

/** Ce que révise une séance : 15 positions dues, ou toutes s'il y en a moins. */
export const sessionPositions = (due: number) => Math.min(due, SESSION_POSITIONS);

/** La séance s'arrête au bout de la ligne où le compte est atteint, jamais au milieu d'une ligne. */
export const sessionDone = (answered: number, planned: number, lineDone: boolean) => lineDone && answered >= planned;

/** Une position jamais révisée est due. */
export function isDue(state: ReviewState, key: string, today: string): boolean {
  const card = state.get(key);
  return !card || card.due <= today;
}

/** Une bonne réponse sur une position qui n'était pas due ne change rien : seul un oubli compte. */
export function answered(state: ReviewState, key: string, right: boolean, today: string): ReviewState {
  if (right && !isDue(state, key, today)) return state;
  const box = right ? Math.min((state.get(key)?.box ?? 0) + 1, INTERVALS.length) : 1;
  const next = new Map(state);
  next.set(key, { box, due: addDays(today, INTERVALS[box - 1]), reviewedAt: today, ...(right ? {} : { missed: true as const }) });
  return next;
}

/**
 * À la création du répertoire, ce que le joueur joue déjà presque toujours part dans la dernière boîte, son
 * retour étalé sur le mois pour ne pas tout rendre dû le même jour. Le reste est dû tout de suite.
 */
export function seededState(repertoire: Repertoire, habits: OpeningTree, today: string): ReviewState {
  const counts = new Map<string, { games: number; hits: number }>();
  const walk = (node: OpeningNode, fen: string) => {
    const planned = repertoireMovesAt(repertoire, fen);
    if (planned.length && turnOf(fen) === repertoire.side) {
      const key = positionKey(fen);
      const known = counts.get(key) ?? { games: 0, hits: 0 };
      const hits = node.children.filter((child) => planned.some((move) => move.san === child.san)).reduce((sum, child) => sum + child.games, 0);
      counts.set(key, { games: known.games + node.games, hits: known.hits + hits });
    }
    for (const child of node.children) if (planned.some((move) => move.san === child.san)) walk(child, after(fen, child.san!));
  };
  walk(habits.root, REVIEW_START);
  const state = new Map<string, ReviewCard>();
  let spread = 0;
  for (const [key, { games, hits }] of counts) {
    if (games < KNOWN_GAMES || hits / games < KNOWN_SHARE) continue;
    state.set(key, { box: INTERVALS.length, due: addDays(today, 7 + (spread++ % 24)), reviewedAt: today });
  }
  return state;
}

/** Une position jouée en partie, juste (un coup du répertoire) ou manquée (le joueur en est sorti). */
export interface GameAnswer {
  key: string;
  day: string;
  right: boolean;
}

/**
 * Les parties révisent aussi, dans l'ordre où elles ont été jouées : un coup du répertoire joué sur une position due la
 * fait avancer comme une bonne réponse, une position manquée après sa dernière révision redevient due ce jour-là, en
 * boîte 1. Jouée juste puis manquée le même jour, elle compte comme manquée.
 */
export function withGames(state: ReviewState, answers: readonly GameAnswer[]): ReviewState {
  // L'ordre d'insertion garde celui des jours : une Map, pas un objet.
  const days = new Map<string, GameAnswer>();
  for (const answer of answers) {
    const id = `${answer.day} ${answer.key}`;
    days.set(id, { ...answer, right: (days.get(id)?.right ?? true) && answer.right });
  }
  const next = new Map(state);
  for (const { key, day, right } of days.values()) {
    const card = next.get(key);
    // Une position révisée ce jour-là ou après a déjà sa réponse : rejouer les parties ne la déplace plus.
    if (card && card.reviewedAt >= day) continue;
    if (!right) {
      // Le jour de révision reste l'ancien : la position redevient due, sans compter comme révisée.
      if (card) next.set(key, { box: 1, due: day, reviewedAt: card.reviewedAt, missed: true });
    } else if (isDue(next, key, day)) {
      const box = Math.min((card?.box ?? 0) + 1, INTERVALS.length);
      next.set(key, { box, due: addDays(day, INTERVALS[box - 1]), reviewedAt: day });
    }
  }
  return next;
}

/**
 * Une réponse en révision, sur l'état gardé : seule la position répondue y entre avec ce que les parties lui ont fait.
 * Les autres restent relues des parties à chaque fois, sans quoi une partie jouée juste gardée là masquerait un oubli
 * du même jour importé plus tard.
 */
export function answeredAfterGames(stored: ReviewState, games: readonly GameAnswer[], key: string, right: boolean, today: string): ReviewState {
  const lived = withGames(stored, games);
  const after = answered(lived, key, right, today);
  if (after === lived) return stored;
  const next = new Map(stored);
  next.set(key, after.get(key)!);
  return next;
}

/** Un coup du répertoire manqué à l'entraînement : comme un oubli en partie, la position revient le jour même, en boîte 1. */
export function missedInPractice(state: ReviewState, key: string, today: string): ReviewState {
  const next = new Map(state);
  next.set(key, { box: 1, due: today, reviewedAt: state.get(key)?.reviewedAt ?? today, missed: true });
  return next;
}

type PlayerPosition = { readonly key: string; readonly path: readonly string[] };

// Un répertoire n'est jamais modifié, seulement remplacé : le parcours (chess.js à chaque coup) se fait une fois par
// répertoire au lieu d'une fois par réponse en révision.
const positionsOf = new WeakMap<Repertoire, readonly PlayerPosition[]>();

/** Les positions où le joueur a un coup prévu, atteignables depuis le début, chacune avec le premier chemin qui y mène. */
export function playerPositions(repertoire: Repertoire): readonly PlayerPosition[] {
  let positions = positionsOf.get(repertoire);
  if (!positions) {
    positions = walkPlayerPositions(repertoire);
    positionsOf.set(repertoire, positions);
  }
  return positions;
}

function walkPlayerPositions(repertoire: Repertoire): PlayerPosition[] {
  const seen = new Set<string>();
  const found: PlayerPosition[] = [];
  // En largeur : le chemin gardé est le plus court, celui qu'on rejouera.
  let level: { fen: string; path: string[] }[] = [{ fen: REVIEW_START, path: [] }];
  while (level.length) {
    const next: typeof level = [];
    for (const { fen, path } of level) {
      const key = positionKey(fen);
      if (seen.has(key) || path.length > MAX_PLIES) continue;
      seen.add(key);
      const moves = repertoireMovesAt(repertoire, fen);
      if (moves.length && turnOf(fen) === repertoire.side) found.push({ key, path });
      for (const move of moves) next.push({ fen: after(fen, move.san), path: [...path, move.san] });
    }
    level = next;
  }
  return found;
}

export function dueCount(repertoire: Repertoire, state: ReviewState, today: string): number {
  return playerPositions(repertoire).filter(({ key }) => isDue(state, key, today)).length;
}

/**
 * Ce que le joueur sait de son répertoire : chaque position compte sa boîte sur trois, une boîte de moins tant que sa
 * révision est en retard ; jamais révisée ou manquée, zéro, sans quoi rater une position neuve ferait monter le chiffre.
 * `known` / `positions` donne la part sue.
 */
export function mastery(repertoire: Repertoire, state: ReviewState, today: string): { known: number; positions: number } {
  const positions = playerPositions(repertoire);
  let known = 0;
  for (const { key } of positions) {
    const card = state.get(key);
    if (card && !card.missed) known += Math.max(card.box - (card.due < today ? 1 : 0), 0) / INTERVALS.length;
  }
  return { known, positions: positions.length };
}

/**
 * La ligne à réviser : la position due qui pèse le plus, et ce que l'application joue seule avant d'y arriver. Une ligne
 * qui reprend le début d'une ligne déjà jouée dans la séance (`played`) part de là où elle s'en sépare ; là où le
 * répertoire a plusieurs coups, l'application joue celui qui mène à la position visée.
 */
export function planLine(
  repertoire: Repertoire,
  state: ReviewState,
  today: string,
  weight: (key: string) => number = () => 1,
  played: readonly (readonly string[])[] = [],
) {
  let best: (PlayerPosition & { weight: number }) | undefined;
  for (const position of playerPositions(repertoire)) {
    if (!isDue(state, position.key, today)) continue;
    const found = weight(position.key);
    if (!best || found > best.weight) best = { ...position, weight: found };
  }
  if (!best) return undefined;
  const chess = new Chess();
  const turns: number[] = [];
  const due: number[] = [];
  let choice = 0;
  for (const [index, san] of best.path.entries()) {
    if (chess.turn() === repertoire.side) {
      turns.push(index);
      if (isDue(state, positionKey(chess.fen()), today)) due.push(index);
      // Entre plusieurs coups du répertoire, le joueur ne peut pas deviner celui qui mène à la position visée.
      else if (repertoireMovesAt(repertoire, chess.fen()).length > 1) choice = index + 1;
    }
    chess.move(san);
  }
  const lead = turns.length >= LEAD_IN ? turns[turns.length - LEAD_IN] : 0;
  const fork = Math.max(choice, ...played.map((line) => sharedPlies(line, best.path)));
  // Le début d'une ligne jouée, l'application l'a souvent joué seule : une position due y reste à jouer.
  const from = Math.max(lead, Math.min(fork, ...due.filter((ply) => ply >= lead)));
  return { target: best.key, path: best.path, autoplayed: best.path.slice(0, from), weight: best.weight };
}

function sharedPlies(a: readonly string[], b: readonly string[]): number {
  let plies = 0;
  while (plies < a.length && plies < b.length && a[plies] === b[plies]) plies++;
  return plies;
}

/** Ce que la suite a encore à réviser, pondéré ; une transposition n'est comptée qu'une fois. */
function dueWeight(repertoire: Repertoire, fen: string, state: ReviewState, today: string, weight: (key: string) => number): number {
  const seen = new Set<string>();
  let total = 0;
  const walk = (at: string, ply: number) => {
    const key = positionKey(at);
    if (seen.has(key) || ply > MAX_PLIES) return;
    seen.add(key);
    const moves = repertoireMovesAt(repertoire, at);
    if (moves.length && turnOf(at) === repertoire.side && isDue(state, key, today)) total += weight(key);
    for (const move of moves) walk(after(at, move.san), ply + 1);
  };
  walk(fen, 0);
  return total;
}

/** Les coups justes au tour du joueur : n'importe lequel de son répertoire. */
export function acceptedMoves(repertoire: Repertoire, fen: string): string[] {
  return repertoireMovesAt(repertoire, fen).map((move) => move.san);
}

/**
 * Le coup que l'application joue pour l'adversaire : la réponse prévue qui mène au plus de révisions
 * dues, ou rien quand la suite n'a plus rien à réviser (la ligne s'arrête là).
 */
export function nextReply(repertoire: Repertoire, fen: string, state: ReviewState, today: string, weight: (key: string) => number = () => 1): string | undefined {
  let best: { san: string; weight: number } | undefined;
  for (const move of repertoireMovesAt(repertoire, fen)) {
    const found = dueWeight(repertoire, after(fen, move.san), state, today, weight);
    if (found > 0 && (!best || found > best.weight)) best = { san: move.san, weight: found };
  }
  return best?.san;
}

export function hasDueAhead(repertoire: Repertoire, fen: string, state: ReviewState, today: string): boolean {
  return dueWeight(repertoire, fen, state, today, () => 1) > 0;
}
