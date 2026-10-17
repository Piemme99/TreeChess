import { forEachLine, isPlayerMove, type OpeningNode, type OpeningTree } from './openingTree';
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

const MIN_GAMES = 40;

export function findPriorities(trees: readonly OpeningTree[], limit: number): Priority[] {
  const findings = trees.flatMap((tree) => [...weakLines(tree), ...betterReplies(tree)]);
  return mergeByLine(findings)
    .sort((a, b) => b.pointsToGain - a.pointsToGain)
    .slice(0, limit);
}

// Deux signaux sur une même ligne mesurent la même perte sous deux angles : on
// garde la plus forte estimation, pas leur somme.
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
    known.pointsToGain = Math.max(known.pointsToGain, finding.pointsToGain);
    known.signals.push(finding.signal);
    known.betterReply ??= finding.betterReply;
  }
  return [...byLine.values()];
}

/**
 * Lines ending on one of the player's moves where they score significantly
 * below their average. A line and its sub-lines tell the same story: only the
 * heaviest one is kept.
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

function keepHeaviestPerBranch(sorted: Finding[]): Finding[] {
  const kept: Finding[] = [];
  for (const candidate of sorted) {
    if (!kept.some((line) => sameBranch(line.path, candidate.path))) kept.push(candidate);
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
