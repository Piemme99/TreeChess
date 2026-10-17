// PROTOTYPE JETABLE — logique de « game check » simplifiée, sans moteur : la préparation est
// simulée par les habitudes du joueur sur les positions très jouées (option B de l'ADR 0002).
import type { PlayedGame, Side } from '../../features/openings/domain/playedGame';

export const MAX_PLIES = 16;
const PREPARED_MIN_GAMES = 25;
const PROPOSED_MIN_GAMES = 3;
const SETTLED_ALTERNATIVE_SHARE = 0.25;

export interface MoveStat {
  san: string;
  games: number;
  points: number;
}

export interface PositionStat {
  total: number;
  moves: MoveStat[];
}

export type Stats = Map<string, PositionStat>;

const keyOf = (side: Side, path: readonly string[]) => `${side}|${path.join(' ')}`;

export const isPlayerTurn = (side: Side, ply: number) => (side === 'w') === (ply % 2 === 0);

export function buildStats(games: readonly PlayedGame[]): Stats {
  const counts = new Map<string, Map<string, MoveStat>>();
  for (const game of games) {
    const moves = game.moves.slice(0, MAX_PLIES);
    moves.forEach((san, ply) => {
      const key = keyOf(game.side, moves.slice(0, ply));
      const byMove = counts.get(key) ?? new Map<string, MoveStat>();
      const stat = byMove.get(san) ?? { san, games: 0, points: 0 };
      stat.games += 1;
      stat.points += game.score;
      byMove.set(san, stat);
      counts.set(key, byMove);
    });
  }
  const stats: Stats = new Map();
  for (const [key, byMove] of counts) {
    const moves = [...byMove.values()].sort((a, b) => b.games - a.games);
    stats.set(key, { total: moves.reduce((sum, m) => sum + m.games, 0), moves });
  }
  return stats;
}

export function positionStat(stats: Stats, side: Side, path: readonly string[]) {
  return stats.get(keyOf(side, path)) ?? { total: 0, moves: [] };
}

export function preparedMove(stats: Stats, side: Side, path: readonly string[]): MoveStat | null {
  const stat = positionStat(stats, side, path);
  return stat.total >= PREPARED_MIN_GAMES ? stat.moves[0] : null;
}

export type GameCheck =
  | { kind: 'followed' }
  | { kind: 'left-preparation'; ply: number; played: MoveStat; expected: MoveStat; total: number }
  | { kind: 'no-preparation'; ply: number; played: string };

export function checkGame(game: PlayedGame, stats: Stats): GameCheck {
  const moves = game.moves.slice(0, MAX_PLIES);
  for (let ply = 0; ply < moves.length; ply++) {
    if (!isPlayerTurn(game.side, ply)) continue;
    const path = moves.slice(0, ply);
    const expected = preparedMove(stats, game.side, path);
    if (!expected) return { kind: 'no-preparation', ply, played: moves[ply] };
    if (expected.san !== moves[ply]) {
      const stat = positionStat(stats, game.side, path);
      const played = stat.moves.find((m) => m.san === moves[ply]) ?? { san: moves[ply], games: 1, points: game.score };
      // Une alternative jouée souvent est un second système, pas un écart à signaler.
      if (played.games / stat.total >= SETTLED_ALTERNATIVE_SHARE) continue;
      return { kind: 'left-preparation', ply, played, expected, total: stat.total };
    }
  }
  return { kind: 'followed' };
}

export interface ProposedPreparation {
  side: Side;
  start: readonly string[];
  moves: string[];
  coverage: number;
  alternatives: MoveStat[];
}

export function proposePreparation(stats: Stats, side: Side, start: readonly string[]): ProposedPreparation {
  const moves: string[] = [];
  for (let ply = start.length; ply < MAX_PLIES; ply++) {
    const stat = positionStat(stats, side, [...start, ...moves]);
    if (stat.total < PROPOSED_MIN_GAMES) break;
    moves.push(stat.moves[0].san);
  }
  const first = positionStat(stats, side, start);
  return { side, start, moves, coverage: first.total, alternatives: first.moves.slice(0, 3) };
}

export interface ReviewCard {
  side: Side;
  path: string[];
  expected: MoveStat;
  share: number;
}

export function spacedRepetitionQueue(stats: Stats, size: number): ReviewCard[] {
  const cards: ReviewCard[] = [];
  for (const [key, stat] of stats) {
    const [side, rawPath] = key.split('|') as [Side, string];
    const path = rawPath ? rawPath.split(' ') : [];
    if (path.length < 4 || !isPlayerTurn(side, path.length)) continue;
    if (stat.total < PREPARED_MIN_GAMES) continue;
    const share = stat.moves[0].games / stat.total;
    if (share < 0.85) cards.push({ side, path, expected: stat.moves[0], share });
  }
  return cards.sort((a, b) => a.share - b.share).slice(0, size);
}

export interface Scenario {
  game: PlayedGame;
  check: Exclude<GameCheck, { kind: 'followed' }>;
}

export function findScenario(
  games: readonly PlayedGame[],
  stats: Stats,
  kind: Scenario['check']['kind'],
): Scenario {
  for (let i = games.length - 1; i >= 0; i--) {
    const game = games[i];
    if (game.score !== 0) continue;
    const check = checkGame(game, stats);
    if (check.kind !== kind || check.ply < 6) continue;
    // Sans moteur, on ne montre un écart que s'il coûte vraiment des points au joueur.
    if (check.kind === 'left-preparation' && !isCostlyDeviation(check)) continue;
    return { game, check };
  }
  throw new Error(`Aucune partie pour le scénario ${kind}`);
}

function isCostlyDeviation(check: Extract<GameCheck, { kind: 'left-preparation' }>) {
  return check.played.games >= 3 && scoreRate(check.expected) - scoreRate(check.played) >= 15;
}

export function scoreRate(stat: MoveStat) {
  return Math.round((stat.points / stat.games) * 100);
}

export type ScenarioKey = 'left' | 'none' | 'quiet';

export const SCENARIOS: { key: ScenarioKey; label: string }[] = [
  { key: 'left', label: 'Left prep' },
  { key: 'none', label: 'No prep' },
  { key: 'quiet', label: 'No game today' },
];

export interface MobileData {
  stats: Stats;
  left: Scenario & { check: { kind: 'left-preparation' } };
  none: Scenario & { check: { kind: 'no-preparation' } };
  recent: { game: PlayedGame; check: GameCheck }[];
  review: ReviewCard[];
}

export function buildMobileData(games: readonly PlayedGame[]): MobileData {
  const stats = buildStats(games);
  return {
    stats,
    left: findScenario(games, stats, 'left-preparation') as MobileData['left'],
    none: findScenario(games, stats, 'no-preparation') as MobileData['none'],
    recent: games.slice(-6).reverse().map((game) => ({ game, check: checkGame(game, stats) })),
    review: spacedRepetitionQueue(stats, 5),
  };
}

export function preparedContinuation(stats: Stats, side: Side, start: readonly string[]): string[] {
  const line = [...start];
  while (line.length < MAX_PLIES) {
    const stat = positionStat(stats, side, line);
    const next = isPlayerTurn(side, line.length) ? preparedMove(stats, side, line) : stat.moves[0];
    if (!next || stat.total < PREPARED_MIN_GAMES) break;
    line.push(next.san);
  }
  return line;
}
