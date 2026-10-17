// PROTOTYPE — « fixer une ligne » : préparer, puis vérifier sur l'historique réel. Jetable.
import type { RawGame } from './chesscom';
import type { Color, Tree, TreeNode } from './tree';

/**
 * Une préparation n'est ni une séquence unique (l'adversaire bifurque) ni un
 * répertoire exhaustif (c'est le travail sans fin qui a tué la v1) : c'est un
 * coup choisi à chaque position où le joueur a la main, sur les seules
 * bifurcations adverses qui pèsent. Sa complétude se mesure en couverture des
 * parties réelles, pas en nombre de coups.
 */
export interface Frontier {
  path: string;
  ply: number;
  games: number;
  options: { san: string; games: number; rate: number }[];
}

export interface Prep {
  color: Color;
  /** Chemin de la position où le joueur a la main → le coup retenu. */
  choices: Record<string, string>;
  /** Tous les chemins atteints par la préparation. */
  covered: Set<string>;
  /** Positions où la ligne s'arrête faute d'habitude nette : à trancher. */
  frontier: Frontier[];
  maxPly: number;
}

export interface PrepOptions {
  maxPly: number;
  /** Part des parties adverses à couvrir avant de s'arrêter. */
  targetCoverage: number;
  /** Une réponse vue au moins ce nombre de fois est couverte quoi qu'il arrive. */
  minBranchGames: number;
  /** En dessous de ce volume, il n'y a plus rien à apprendre de l'historique : la ligne s'arrête. */
  minLineGames: number;
}

const pathOf = (node: TreeNode) => node.id.split('|')[1] ?? '';

/** Par défaut la préparation est la ligne de fait du joueur : ce qu'il joue le plus. */
function usualChild(tree: Tree, node: TreeNode): TreeNode | null {
  return node.children.map((id) => tree.nodes[id]).sort((a, b) => b.games - a.games)[0] ?? null;
}

/** Les réponses adverses à couvrir : les plus fréquentes jusqu'à la part visée. */
function coveredChildren(tree: Tree, node: TreeNode, opts: PrepOptions): TreeNode[] {
  const children = node.children.map((id) => tree.nodes[id]).sort((a, b) => b.games - a.games);
  const target = node.games * opts.targetCoverage;
  const out: TreeNode[] = [];
  let seen = 0;

  for (const child of children) {
    if (seen < target || child.games >= opts.minBranchGames) {
      out.push(child);
      seen += child.games;
    }
  }
  return out;
}

export function buildPrep(
  tree: Tree,
  lineId: string,
  opts: PrepOptions,
  overrides: Record<string, string> = {},
): Prep {
  const [color, path] = lineId.split('|') as [Color, string];
  const choices: Record<string, string> = {};
  const covered = new Set<string>(['']);
  const frontier: Frontier[] = [];

  const apply = (node: TreeNode) => {
    if (node.ply >= opts.maxPly) return;
    if (node.games < opts.minLineGames) return;

    if (node.userToMove) {
      const override = overrides[pathOf(node)];
      const child = override
        ? node.children.map((id) => tree.nodes[id]).find((c) => c.san === override) ?? usualChild(tree, node)
        : usualChild(tree, node);
      if (!child) return;

      // Une habitude, c'est au moins une partie sur deux : en dessous, mieux vaut
      // avouer qu'il n'y a pas de ligne ici que d'en inventer une.
      const settled = override !== undefined || child.games >= Math.max(4, node.games * 0.5);
      if (!settled) {
        frontier.push({
          path: pathOf(node),
          ply: node.ply,
          games: node.games,
          options: node.children
            .map((id) => tree.nodes[id])
            .sort((a, b) => b.games - a.games)
            .slice(0, 3)
            .map((c) => ({ san: c.san ?? '?', games: c.games, rate: c.score / c.games })),
        });
        return;
      }
      choices[pathOf(node)] = child.san ?? '';
      covered.add(pathOf(child));
      apply(child);
      return;
    }

    for (const child of coveredChildren(tree, node, opts)) {
      covered.add(pathOf(child));
      apply(child);
    }
  };

  // La ligne d'entrée est acquise : ses coups sont ceux que le joueur a joués.
  const sans = path ? path.split(' ') : [];
  let prefix = '';
  for (const san of sans) {
    const before = tree.nodes[`${color}|${prefix}`];
    const next = tree.nodes[`${color}|${prefix ? `${prefix} ${san}` : san}`];
    if (!before || !next) break;
    if (before.userToMove) choices[prefix] = overrides[prefix] ?? san;
    prefix = prefix ? `${prefix} ${san}` : san;
    covered.add(prefix);
  }

  const entry = tree.nodes[lineId];
  if (entry) apply(entry);

  return { color, choices, covered, frontier: frontier.sort((a, b) => b.games - a.games), maxPly: opts.maxPly };
}

export type Outcome = 'left' | 'uncovered' | 'followed';

export interface Verdict {
  game: RawGame;
  outcome: Outcome;
  ply: number;
  expected?: string;
  played?: string;
}

export interface PrepReport {
  verdicts: Verdict[];
  counts: Record<Outcome, number>;
  scores: Record<Outcome, number>;
  /** Réponses adverses non couvertes, par fréquence. */
  holes: { san: string; path: string; games: number; score: number }[];
  coverage: number;
  /** Demi-coup auquel le joueur s'écarte de sa propre ligne, et ce que ça donne. */
  driftByPly: { ply: number; games: number; score: number }[];
  /** Jusqu'où la ligne porte, en coups entiers. */
  reach: number;
}

/** Rejoue les parties déjà jouées contre la préparation : elle aurait servi, ou pas. */
export function verifyPrep(prep: Prep, games: RawGame[]): PrepReport {
  const verdicts: Verdict[] = [];
  const counts: Record<Outcome, number> = { left: 0, uncovered: 0, followed: 0 };
  const scores: Record<Outcome, number> = { left: 0, uncovered: 0, followed: 0 };
  const holes = new Map<string, { san: string; path: string; games: number; score: number }>();

  for (const game of games) {
    const moves = game.moves ?? [];
    let path = '';
    let verdict: Verdict = { game, outcome: 'followed', ply: moves.length };

    for (let i = 0; i < Math.min(moves.length, prep.maxPly); i++) {
      const san = moves[i];
      const mine = (i % 2 === 0) === (prep.color === 'white');

      if (mine) {
        const expected = prep.choices[path];
        if (!expected) {
          verdict = { game, outcome: 'followed', ply: i };
          break;
        }
        if (expected !== san) {
          verdict = { game, outcome: 'left', ply: i, expected, played: san };
          break;
        }
      } else {
        const next = path ? `${path} ${san}` : san;
        if (!prep.covered.has(next)) {
          verdict = { game, outcome: 'uncovered', ply: i, played: san };
          const key = `${path}|${san}`;
          const hole = holes.get(key) ?? { san, path, games: 0, score: 0 };
          hole.games++;
          hole.score += game.score;
          holes.set(key, hole);
          break;
        }
      }

      path = path ? `${path} ${san}` : san;
    }

    verdicts.push(verdict);
    counts[verdict.outcome]++;
    scores[verdict.outcome] += game.score;
  }

  const drift = new Map<number, { ply: number; games: number; score: number }>();
  for (const v of verdicts) {
    if (v.outcome !== 'left') continue;
    const entry = drift.get(v.ply) ?? { ply: v.ply, games: 0, score: 0 };
    entry.games++;
    entry.score += v.game.score;
    drift.set(v.ply, entry);
  }

  const followed = verdicts.filter((v) => v.outcome === 'followed');
  const reach = followed.length
    ? Math.ceil(followed.reduce((sum, v) => sum + v.ply, 0) / followed.length / 2)
    : 0;

  const total = games.length || 1;
  return {
    verdicts,
    reach,
    counts,
    scores,
    holes: [...holes.values()].sort((a, b) => b.games - a.games),
    coverage: (counts.followed + counts.left) / total,
    driftByPly: [...drift.values()].sort((a, b) => b.games - a.games),
  };
}
