import { forEachLine, isPlayerMove, nodeAt, type OpeningNode, type OpeningTree } from './openingTree';
import { deficit, playerAverage, scoreRate } from './performance';
import type { Side } from './playedGame';

export type Signal = 'weak-line' | 'better-reply';

/** A line ending on one of the player's moves, flagged by one signal. */
export interface Finding {
  signal: Signal;
  side: Side;
  path: readonly string[];
  games: number;
  pointsToGain: number;
  betterReply: string | null;
}

/** A line to work on, with every signal that flagged it. */
export interface Priority {
  side: Side;
  path: readonly string[];
  games: number;
  pointsToGain: number;
  signals: Signal[];
  betterReply: string | null;
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
  const findings = [
    ...findingsOf(history).filter((finding) => isStillCurrent(finding, recent[finding.side])),
    ...findingsOf(recent),
  ];
  const weighed = mergeByLine(findings)
    .map((priority) => ({ ...priority, ...recentCost(priority, recent[priority.side]) }))
    .sort((a, b) => b.pointsToGain - a.pointsToGain);
  return keepHeaviestPerBranch(weighed).slice(0, limit);
}

function findingsOf(trees: Record<Side, OpeningTree>): Finding[] {
  return [trees.w, trees.b].flatMap((tree) => [...weakLines(tree), ...betterReplies(tree)]);
}

// Peu de parties récentes suffisent à écarter une priorité, jamais à en créer une :
// au pire on perd une vraie priorité, on n'en invente pas de fausse.
function isStillCurrent(finding: Finding, recent: OpeningTree): boolean {
  const line = nodeAt(recent, finding.path);
  return line !== undefined && scoreRate(line) < playerAverage(recent);
}

function recentCost(priority: Priority, recent: OpeningTree): Pick<Priority, 'games' | 'pointsToGain'> {
  const line = nodeAt(recent, priority.path);
  if (!line) return { games: 0, pointsToGain: 0 };
  return { games: line.games, pointsToGain: deficit(line, playerAverage(recent)) * line.games };
}

function mergeByLine(findings: Finding[]): Priority[] {
  const byLine = new Map<string, Priority>();
  for (const finding of findings) {
    const key = `${finding.side}:${finding.path.join(' ')}`;
    const known = byLine.get(key);
    if (!known) {
      byLine.set(key, {
        side: finding.side,
        path: finding.path,
        games: finding.games,
        pointsToGain: finding.pointsToGain,
        signals: [finding.signal],
        betterReply: finding.betterReply,
      });
      continue;
    }
    if (!known.signals.includes(finding.signal)) known.signals.push(finding.signal);
    known.betterReply ??= finding.betterReply;
  }
  return [...byLine.values()];
}

/**
 * Lines ending on one of the player's moves where they score significantly
 * below their average, the heaviest one per branch.
 */
export function weakLines(tree: OpeningTree): Finding[] {
  const average = playerAverage(tree);
  const candidates: Finding[] = [];

  forEachLine(tree, (node, path) => {
    if (!isPlayerMove(tree.side, path.length) || node.games < MIN_GAMES) return;
    if (!isSignificantlyBelow(node, average)) return;
    candidates.push({
      signal: 'weak-line',
      side: tree.side,
      path,
      games: node.games,
      pointsToGain: deficit(node, average) * node.games,
      betterReply: null,
    });
  });

  return keepHeaviestPerBranch(candidates.sort((a, b) => b.pointsToGain - a.pointsToGain));
}

function isSignificantlyBelow(node: OpeningNode, average: number): boolean {
  const standardError = Math.sqrt((average * (1 - average)) / node.games);
  return average - scoreRate(node) > standardError;
}

// Une ligne et sa sous-ligne racontent la même histoire : on garde la plus lourde.
function keepHeaviestPerBranch<T extends { side: Side; path: readonly string[] }>(heaviestFirst: T[]): T[] {
  const kept: T[] = [];
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

// Un coup joué trois fois n'est pas un système : en dessous, ni référence ni alternative.
const MIN_REPLY_GAMES = 10;
const MIN_REPLY_SHARE = 0.05;
const REPLY_SMOOTHING_GAMES = 20;
const MIN_GAP = 0.04;
// On ne recommande pas de changer une habitude de mille parties sur la foi de
// cent cinquante : la meilleure réponse doit peser face à celle qu'elle remplacerait.
const MIN_BETTER_REPLY_WEIGHT = 0.25;

/**
 * Replies of the player that score clearly worse than another reply they also
 * play in the same position. Two systems that work equally well are a choice,
 * not a gap: only the spread between their own replies counts.
 */
export function betterReplies(tree: OpeningTree): Finding[] {
  const found: Finding[] = [];

  forEachLine(tree, (node, path) => {
    if (!isPlayerMove(tree.side, path.length + 1) || node.games < MIN_GAMES) return;

    const localRate = scoreRate(node);
    const replies = node.children
      .filter((reply) => reply.games >= MIN_REPLY_GAMES && reply.games >= node.games * MIN_REPLY_SHARE)
      .map((reply) => ({
        san: reply.san!,
        games: reply.games,
        rate: (reply.score + localRate * REPLY_SMOOTHING_GAMES) / (reply.games + REPLY_SMOOTHING_GAMES),
      }));
    if (replies.length < 2) return;

    const best = replies.reduce((a, b) => (b.rate > a.rate ? b : a));
    for (const reply of replies) {
      if (reply === best || best.games < reply.games * MIN_BETTER_REPLY_WEIGHT) continue;
      const gap = best.rate - reply.rate;
      const noise = Math.sqrt(0.25 * (1 / best.games + 1 / reply.games));
      if (gap < MIN_GAP || gap <= noise) continue;

      found.push({
        signal: 'better-reply',
        side: tree.side,
        path: [...path, reply.san],
        games: reply.games,
        pointsToGain: (gap - noise) * reply.games,
        betterReply: best.san,
      });
    }
  });

  return found;
}
