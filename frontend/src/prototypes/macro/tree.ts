// PROTOTYPE — agrégation des parties en un arbre d'ouvertures. Jetable.
import { Chess } from 'chess.js';
import type { RawGame } from './chesscom';

export type Color = 'white' | 'black';

export interface TreeNode {
  id: string;
  color: Color;
  /** FEN complète de la position (sert de clé de cache moteur via son EPD). */
  fen: string;
  epd: string;
  ply: number;
  san: string | null;
  parent: string | null;
  children: string[];
  games: number;
  /** Somme des résultats du joueur (1 / 0.5 / 0) sur les parties passant ici. */
  score: number;
  userToMove: boolean;
  evalCp?: number;
}

export interface Tree {
  nodes: Record<string, TreeNode>;
  roots: Record<Color, string>;
  gamesByColor: Record<Color, number>;
  parsed: number;
  skipped: number;
}

const epdOf = (fen: string) => fen.split(' ').slice(0, 4).join(' ');

function movetext(pgn: string): string[] {
  const body = pgn
    .replace(/\[[^\]]*\]/g, '')
    .replace(/\{[^}]*\}/g, '')
    .replace(/\$\d+/g, '')
    .replace(/\([^)]*\)/g, '');
  return body
    .split(/\s+/)
    .filter((t) => t && !/^\d+\.+$/.test(t) && !/^(1-0|0-1|1\/2-1\/2|\*)$/.test(t));
}

export function buildTree(games: RawGame[], maxPly: number): Tree {
  const start = new Chess();
  const nodes: Record<string, TreeNode> = {};
  const roots: Record<Color, string> = { white: 'white|', black: 'black|' };
  const gamesByColor: Record<Color, number> = { white: 0, black: 0 };

  for (const color of ['white', 'black'] as Color[]) {
    nodes[roots[color]] = {
      id: roots[color], color, fen: start.fen(), epd: epdOf(start.fen()),
      ply: 0, san: null, parent: null, children: [], games: 0, score: 0,
      userToMove: color === 'white',
    };
  }

  let parsed = 0;
  let skipped = 0;

  for (const game of games) {
    const color: Color = game.userIsWhite ? 'white' : 'black';
    const chess = new Chess();
    const tokens = movetext(game.pgn);
    if (tokens.length === 0) { skipped++; continue; }

    let parentId = roots[color];
    nodes[parentId].games++;
    nodes[parentId].score += game.score;
    let path = '';
    const sans: string[] = [];

    for (let i = 0; i < tokens.length && i < maxPly; i++) {
      let san: string;
      try {
        san = chess.move(tokens[i]).san;
      } catch {
        break;
      }
      path += (path ? ' ' : '') + san;
      sans.push(san);
      const id = `${color}|${path}`;
      let node = nodes[id];
      if (!node) {
        const fen = chess.fen();
        const sideToMove = fen.split(' ')[1] === 'w' ? 'white' : 'black';
        node = nodes[id] = {
          id, color, fen, epd: epdOf(fen), ply: i + 1, san,
          parent: parentId, children: [], games: 0, score: 0,
          userToMove: sideToMove === color,
        };
        nodes[parentId].children.push(id);
      }
      node.games++;
      node.score += game.score;
      parentId = id;
    }

    game.moves = sans;
    gamesByColor[color]++;
    parsed++;
  }

  return { nodes, roots, gamesByColor, parsed, skipped };
}

/** Positions à évaluer : assez jouées pour ne pas être du bruit. */
export function selectForEval(tree: Tree, minGames: number, maxPly: number): TreeNode[] {
  return Object.values(tree.nodes)
    .filter((n) => n.games >= minGames && n.ply <= maxPly)
    .sort((a, b) => a.ply - b.ply || b.games - a.games);
}

/** Évaluation ramenée au point de vue du joueur. */
export function evalForUser(node: TreeNode): number | undefined {
  if (node.evalCp === undefined) return undefined;
  const sideToMove = node.fen.split(' ')[1] === 'w' ? 'white' : 'black';
  return sideToMove === node.color ? node.evalCp : -node.evalCp;
}

/** Taux de points moyen du joueur sur cette couleur — la référence à battre. */
export function baseline(tree: Tree, color: Color): number {
  const root = tree.nodes[tree.roots[color]];
  return root.games ? root.score / root.games : 0.5;
}

/**
 * Déficit de points par partie, ramené vers 0 quand l'échantillon est maigre.
 * Sans ce lissage, une ligne jouée 7 fois domine le classement sur du bruit.
 */
const SHRINK = 12;
export function deficit(node: TreeNode, base: number): number {
  const rate = node.score / node.games;
  return (base - rate) * (node.games / (node.games + SHRINK));
}

export type FindingKind = 'leak' | 'weak';

export interface Finding {
  node: TreeNode;
  parent: TreeNode;
  kind: FindingKind;
  /** Centipions lâchés par ce coup précis. */
  lossCp: number;
  games: number;
  rate: number;
  /** Points réellement perdus par rapport à la moyenne du joueur. */
  pointsLost: number;
  /** L'écart dépasse-t-il le bruit d'échantillonnage ? */
  confident: boolean;
}

export interface FindingOptions {
  minGames: number;
  floorCp: number;
  minWeakGames: number;
}

/**
 * Deux signaux distincts, pas un seul :
 * - `leak` : le moteur pointe une erreur précise sur ce coup → préparable.
 * - `weak` : résultats en dessous de la moyenne sans erreur d'ouverture identifiable
 *   → travailler l'ouverture n'y changera rien, c'est la suite qui pêche.
 */
export function findFindings(tree: Tree, color: Color, opts: FindingOptions): Finding[] {
  const base = baseline(tree, color);
  const out: Finding[] = [];

  for (const node of Object.values(tree.nodes)) {
    if (node.color !== color || !node.parent || node.games < opts.minGames) continue;
    const parent = tree.nodes[node.parent];
    if (!parent?.userToMove) continue;

    const before = evalForUser(parent);
    const after = evalForUser(node);
    if (before === undefined || after === undefined) continue;

    const shrunk = deficit(node, base);
    if (shrunk <= 0) continue;

    const lossCp = before - after;
    const kind: FindingKind = lossCp >= opts.floorCp ? 'leak' : 'weak';
    if (kind === 'weak' && node.games < opts.minWeakGames) continue;

    const rate = node.score / node.games;
    const standardError = Math.sqrt((base * (1 - base)) / node.games);
    const confident = base - rate > standardError;

    // Sans signal moteur pour corroborer, un écart dans le bruit ne vaut rien.
    if (kind === 'weak' && !confident) continue;

    out.push({
      node, parent, kind, lossCp, games: node.games, rate,
      pointsLost: shrunk * node.games, confident,
    });
  }

  out.sort((a, b) => b.pointsLost - a.pointsLost);
  return keepShallowest(out);
}

/**
 * Une ligne et sa sous-ligne racontent la même histoire : on garde celle qui pèse
 * le plus lourd et on écarte ses descendantes.
 */
function keepShallowest(findings: Finding[]): Finding[] {
  const kept: Finding[] = [];
  const keptIds = new Set<string>();

  for (const finding of findings) {
    const path = finding.node.id;
    const hasKeptAncestor = [...keptIds].some((id) => path.startsWith(`${id} `));
    if (hasKeptAncestor) continue;
    kept.push(finding);
    keptIds.add(path);
  }
  return kept;
}

export interface Reply {
  san: string;
  games: number;
  rate: number;
  /** Taux lissé vers la moyenne locale : une réponse jouée 10 fois ne fait pas la loi. */
  adjusted: number;
}

export interface Dispersion {
  node: TreeNode;
  games: number;
  replies: Reply[];
  best: Reply;
  /** Écart de la meilleure réponse au reste, en points par partie. */
  gap: number;
  /** Parties jouées avec autre chose que la meilleure réponse. */
  otherGames: number;
  /** L'écart survit-il à l'incertitude d'échantillonnage ? */
  confident: boolean;
}

const REPLY_SHRINK = 20;
const MIN_REPLY_GAMES = 10;
const MIN_REPLY_SHARE = 0.05;
const MIN_GAP = 0.04;

/**
 * Une position sans réponse arrêtée ne pose problème que si les réponses ne se
 * valent pas : jouer deux systèmes qui marchent aussi bien est un choix, pas un trou.
 */
export function findDispersions(tree: Tree, color: Color, minGames: number): Dispersion[] {
  const out: Dispersion[] = [];

  for (const node of Object.values(tree.nodes)) {
    if (node.color !== color || !node.userToMove || node.games < minGames) continue;
    if (node.children.length < 2) continue;

    const localRate = node.score / node.games;
    const replies: Reply[] = node.children
      .map((id) => tree.nodes[id])
      .map((child) => ({
        san: child.san ?? '?',
        games: child.games,
        rate: child.score / child.games,
        adjusted: (child.score + localRate * REPLY_SHRINK) / (child.games + REPLY_SHRINK),
      }))
      .sort((a, b) => b.games - a.games);

    // Un coup joué trois fois n'est pas un système : ni référence, ni dispersion.
    const candidates = replies.filter(
      (r) => r.games >= MIN_REPLY_GAMES && r.games >= node.games * MIN_REPLY_SHARE,
    );
    if (candidates.length < 2) continue;

    const best = candidates.reduce((a, b) => (b.adjusted > a.adjusted ? b : a));
    const others = candidates.filter((r) => r.san !== best.san);
    const otherGames = others.reduce((sum, r) => sum + r.games, 0);
    const otherRate = others.reduce((sum, r) => sum + r.adjusted * r.games, 0) / otherGames;

    const gap = best.adjusted - otherRate;
    if (gap < MIN_GAP) continue;

    const spread = Math.sqrt(0.25 * (1 / best.games + 1 / otherGames));

    out.push({
      node, games: node.games, replies: candidates.slice(0, 4), best, gap, otherGames,
      confident: gap > spread,
    });
  }

  return out.sort((a, b) => Number(b.confident) - Number(a.confident) || b.gap * b.otherGames - a.gap * a.otherGames);
}

export interface LineStep {
  node: TreeNode;
  san: string;
  ply: number;
  rate: number;
  games: number;
  evalUser: number | undefined;
  /** Le joueur a-t-il la main dans la position *avant* ce coup ? */
  byUser: boolean;
}

export function lineSteps(tree: Tree, nodeId: string): LineStep[] {
  const [color, path] = nodeId.split('|');
  const sans = path ? path.split(' ') : [];
  const steps: LineStep[] = [];

  let prefix = '';
  for (const san of sans) {
    prefix = prefix ? `${prefix} ${san}` : san;
    const node = tree.nodes[`${color}|${prefix}`];
    if (!node) break;
    steps.push({
      node, san, ply: node.ply,
      rate: node.score / node.games,
      games: node.games,
      evalUser: evalForUser(node),
      byUser: node.ply % 2 === (color === 'white' ? 1 : 0),
    });
  }
  return steps;
}

/** Prolonge la ligne par la suite la plus fréquente : la ligne vaut mieux que son point d'entrée. */
export function dominantContinuation(tree: Tree, nodeId: string, maxPly: number): LineStep[] {
  let node = tree.nodes[nodeId];
  if (!node) return [];
  const floor = Math.max(5, node.games * 0.1);
  const out: LineStep[] = [];

  while (node.ply < maxPly) {
    const next = node.children
      .map((id) => tree.nodes[id])
      .sort((a, b) => b.games - a.games)[0];
    if (!next || next.games < floor) break;
    out.push({
      node: next, san: next.san ?? '?', ply: next.ply,
      rate: next.score / next.games,
      games: next.games,
      evalUser: evalForUser(next),
      byUser: next.ply % 2 === (next.color === 'white' ? 1 : 0),
    });
    node = next;
  }
  return out;
}

export interface Branch {
  san: string;
  games: number;
  rate: number;
  evalUser: number | undefined;
  onLine: boolean;
}

/** Les suites possibles depuis une position, et ce qu'elles rapportent au joueur. */
export function branches(tree: Tree, node: TreeNode, onLineId?: string): Branch[] {
  return node.children
    .map((id) => tree.nodes[id])
    .map((child) => ({
      san: child.san ?? '?',
      games: child.games,
      rate: child.score / child.games,
      evalUser: evalForUser(child),
      onLine: child.id === onLineId,
    }))
    .sort((a, b) => b.games - a.games);
}

/** Les parties qui passent par cette ligne. */
export function gamesOnLine(games: RawGame[], nodeId: string): RawGame[] {
  const [color, path] = nodeId.split('|');
  if (!path) return [];
  const sans = path.split(' ');
  const wantWhite = color === 'white';

  return games.filter(
    (game) => game.userIsWhite === wantWhite && sans.every((san, i) => game.moves?.[i] === san),
  );
}
