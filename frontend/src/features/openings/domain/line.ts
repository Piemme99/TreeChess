import { isPlayerMove, nodeAt, type OpeningNode, type OpeningTree } from './openingTree';
import { scoreRate } from './performance';

export interface LineStep {
  san: string;
  /** Rang du demi-coup, à partir de 1. */
  ply: number;
  games: number;
  rate: number;
  byPlayer: boolean;
}

export interface StudiedLine {
  steps: LineStep[];
  /** Nombre de demi-coups de la ligne demandée ; les suivants en sont la suite la plus jouée. */
  entry: number;
}

export interface PlayedMove {
  san: string;
  games: number;
  /** Part des parties de la position qui ont pris ce coup. */
  share: number;
  rate: number;
  onLine: boolean;
}

const CONTINUATION_MIN_GAMES = 5;
const CONTINUATION_MIN_SHARE = 0.1;
const MIN_SHOWN_GAMES = 3;

/**
 * La ligne est prolongée par sa suite la plus jouée : le point d'entrée identifie
 * le problème, il ne délimite pas le travail.
 */
export function studyLine(tree: OpeningTree, path: readonly string[]): StudiedLine {
  const steps: LineStep[] = [];
  let node: OpeningNode | undefined = tree.root;
  for (const san of path) {
    node = node.children.find((child) => child.san === san);
    if (!node) return { steps, entry: steps.length };
    steps.push(stepOf(tree, node, steps.length + 1));
  }

  const entry = steps.length;
  const floor = Math.max(CONTINUATION_MIN_GAMES, node.games * CONTINUATION_MIN_SHARE);
  for (let next = node.children[0]; next && next.games >= floor; next = next.children[0]) {
    steps.push(stepOf(tree, next, steps.length + 1));
  }
  return { steps, entry };
}

// Un coup vu deux fois n'est pas une habitude, ni de l'adversaire ni du joueur : il brouille la lecture.
export function movesAt(
  tree: OpeningTree,
  path: readonly string[],
  onLineSan: string | undefined,
): { shown: PlayedMove[]; hidden: number } {
  const node = nodeAt(tree, path);
  if (!node) return { shown: [], hidden: 0 };
  const moves = node.children.map((child) => ({
    san: child.san!,
    games: child.games,
    share: child.games / node.games,
    rate: scoreRate(child),
    onLine: child.san === onLineSan,
  }));
  const shown = moves.filter((move) => move.games >= MIN_SHOWN_GAMES || move.onLine);
  return { shown, hidden: moves.length - shown.length };
}

function stepOf(tree: OpeningTree, node: OpeningNode, ply: number): LineStep {
  return {
    san: node.san!,
    ply,
    games: node.games,
    rate: scoreRate(node),
    byPlayer: isPlayerMove(tree.side, ply),
  };
}

export interface LinePosition {
  /** Demi-coups joués pour atteindre la position (0 = départ). */
  ply: number;
  path: readonly string[];
  /** Score des parties qui atteignent la position. */
  rate: number;
  games: number;
  playerToMove: boolean;
  moves: PlayedMove[];
  hidden: number;
}

/** Chaque position de la ligne, du départ au bout de sa suite la plus jouée. */
export function linePositions(tree: OpeningTree, { steps }: StudiedLine): LinePosition[] {
  return [tree.root, ...steps].map((_, ply) => {
    const path = steps.slice(0, ply).map((step) => step.san);
    const { shown, hidden } = movesAt(tree, path, steps[ply]?.san);
    return {
      ply,
      path,
      rate: ply === 0 ? scoreRate(tree.root) : steps[ply - 1].rate,
      games: ply === 0 ? tree.root.games : steps[ply - 1].games,
      playerToMove: isPlayerMove(tree.side, ply + 1),
      moves: shown,
      hidden,
    };
  });
}
