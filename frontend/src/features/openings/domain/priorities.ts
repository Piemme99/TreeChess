import { forEachLine, isPlayerMove, type OpeningNode, type OpeningTree } from './openingTree';
import { deficit, playerAverage, scoreRate } from './performance';
import type { Side } from './playedGame';

export type PriorityKind = 'weak-line' | 'unsettled';

export interface Priority {
  kind: PriorityKind;
  side: Side;
  path: readonly string[];
  games: number;
  pointsAtStake: number;
}

const MIN_GAMES = 40;

export function findPriorities(trees: readonly OpeningTree[], limit: number): Priority[] {
  return trees
    .flatMap((tree) => [...weakLines(tree), ...unsettledPositions(tree)])
    .sort((a, b) => b.pointsAtStake - a.pointsAtStake)
    .slice(0, limit);
}

/**
 * Lines ending on one of the player's moves where they score significantly
 * below their average. A line and its sub-lines tell the same story: only the
 * heaviest one is kept.
 */
export function weakLines(tree: OpeningTree): Priority[] {
  const average = playerAverage(tree);
  const candidates: Priority[] = [];

  forEachLine(tree, (node, path) => {
    if (!isPlayerMove(tree.side, path.length) || node.games < MIN_GAMES) return;
    if (!isSignificantlyBelow(node, average)) return;
    candidates.push({
      kind: 'weak-line',
      side: tree.side,
      path,
      games: node.games,
      pointsAtStake: deficit(node, average) * node.games,
    });
  });

  return keepHeaviestPerBranch(candidates.sort((a, b) => b.pointsAtStake - a.pointsAtStake));
}

function isSignificantlyBelow(node: OpeningNode, average: number): boolean {
  const standardError = Math.sqrt((average * (1 - average)) / node.games);
  return average - scoreRate(node) > standardError;
}

function keepHeaviestPerBranch(sorted: Priority[]): Priority[] {
  const kept: Priority[] = [];
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
// cent cinquante : la meilleure réponse doit peser face à ce qu'elle remplacerait.
const MIN_BEST_REPLY_WEIGHT = 0.25;

/**
 * Positions where the player alternates between replies that do not score the
 * same. Two systems that work equally well are a choice, not a gap: only the
 * spread between their own replies counts.
 */
export function unsettledPositions(tree: OpeningTree): Priority[] {
  const found: Priority[] = [];

  forEachLine(tree, (node, path) => {
    if (!isPlayerMove(tree.side, path.length + 1) || node.games < MIN_GAMES) return;

    const localRate = scoreRate(node);
    const replies = node.children
      .filter((reply) => reply.games >= MIN_REPLY_GAMES && reply.games >= node.games * MIN_REPLY_SHARE)
      .map((reply) => ({
        games: reply.games,
        rate: (reply.score + localRate * REPLY_SMOOTHING_GAMES) / (reply.games + REPLY_SMOOTHING_GAMES),
      }));
    if (replies.length < 2) return;

    const best = replies.reduce((a, b) => (b.rate > a.rate ? b : a));
    const others = replies.filter((reply) => reply !== best);
    const otherGames = others.reduce((sum, reply) => sum + reply.games, 0);
    const otherRate = others.reduce((sum, reply) => sum + reply.rate * reply.games, 0) / otherGames;

    const gap = best.rate - otherRate;
    const noise = Math.sqrt(0.25 * (1 / best.games + 1 / otherGames));
    const weighty = best.games >= otherGames * MIN_BEST_REPLY_WEIGHT;
    if (gap < MIN_GAP || gap <= noise || !weighty) return;

    found.push({
      kind: 'unsettled',
      side: tree.side,
      path,
      games: node.games,
      pointsAtStake: (gap - noise) * otherGames,
    });
  });

  return found;
}
