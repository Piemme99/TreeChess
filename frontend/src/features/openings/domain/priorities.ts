import { forEachLine, isPlayerMove, nodeAt, type OpeningNode, type OpeningTree } from './openingTree';
import { deficit, playerAverage, scoreRate } from './performance';
import type { Side } from './playedGame';

/** A line ending on one of the player's moves, where they score significantly below their average. */
export interface Priority {
  side: Side;
  path: readonly string[];
  games: number;
  pointsToGain: number;
}

const MIN_GAMES = 20;

/**
 * Two kinds of problems, each visible on one time scale only: an old one still
 * there but rarely played needs the whole history to be proven; a recent one is
 * drowned in the good old games and only shows on the recent ones. A line proven
 * on the whole history is kept only while still current: played recently, and not
 * scoring back at the recent average there.
 *
 * Whatever proved it, a priority weighs what it costs now: the points lost on it
 * over the recent games.
 */
export function findPriorities(
  history: Record<Side, OpeningTree>,
  recent: Record<Side, OpeningTree>,
  limit: number,
): Priority[] {
  const proven = [
    ...weakLinesOf(history).filter((line) => isStillCurrent(line, recent[line.side])),
    ...weakLinesOf(recent),
  ];
  const weighed = proven
    .map((line) => recentCost(line, recent[line.side]))
    .sort((a, b) => b.pointsToGain - a.pointsToGain);
  return keepHeaviestPerBranch(weighed).slice(0, limit);
}

function weakLinesOf(trees: Record<Side, OpeningTree>): Priority[] {
  return [...weakLines(trees.w), ...weakLines(trees.b)];
}

// Peu de parties récentes suffisent à écarter une priorité, jamais à en créer une :
// au pire on perd une vraie priorité, on n'en invente pas de fausse.
function isStillCurrent(line: Priority, recent: OpeningTree): boolean {
  const recentLine = nodeAt(recent, line.path);
  return recentLine !== undefined && scoreRate(recentLine) < playerAverage(recent);
}

function recentCost(line: Priority, recent: OpeningTree): Priority {
  const recentLine = nodeAt(recent, line.path);
  if (!recentLine) return { ...line, games: 0, pointsToGain: 0 };
  return {
    ...line,
    games: recentLine.games,
    pointsToGain: deficit(recentLine, playerAverage(recent)) * recentLine.games,
  };
}

/** Lines of the player scoring significantly below their average, the heaviest one per branch. */
export function weakLines(tree: OpeningTree): Priority[] {
  const average = playerAverage(tree);
  const candidates: Priority[] = [];

  forEachLine(tree, (node, path) => {
    if (!isPlayerMove(tree.side, path.length) || node.games < MIN_GAMES) return;
    if (!isSignificantlyBelow(node, average)) return;
    candidates.push({
      side: tree.side,
      path,
      games: node.games,
      pointsToGain: deficit(node, average) * node.games,
    });
  });

  return keepHeaviestPerBranch(candidates.sort((a, b) => b.pointsToGain - a.pointsToGain));
}

function isSignificantlyBelow(node: OpeningNode, average: number): boolean {
  const standardError = Math.sqrt((average * (1 - average)) / node.games);
  return average - scoreRate(node) > standardError;
}

// Une ligne et sa sous-ligne racontent la même histoire : on garde la plus lourde.
function keepHeaviestPerBranch(heaviestFirst: Priority[]): Priority[] {
  const kept: Priority[] = [];
  for (const candidate of heaviestFirst) {
    const told = kept.some((line) => line.side === candidate.side && sameBranch(line.path, candidate.path));
    if (!told) kept.push(candidate);
  }
  return kept;
}

function sameBranch(a: readonly string[], b: readonly string[]): boolean {
  const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a];
  return shorter.every((san, index) => longer[index] === san);
}
