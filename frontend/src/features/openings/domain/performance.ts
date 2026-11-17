import type { OpeningNode, OpeningTree } from './openingTree';

export function scoreRate(node: OpeningNode): number {
  return node.games === 0 ? 0 : node.score / node.games;
}

export function playerAverage(tree: OpeningTree): number {
  return scoreRate(tree.root);
}

// Ramène l'écart vers 0 sur les petits échantillons : sans ça, une ligne jouée
// 7 fois domine le classement sur du bruit.
const SMOOTHING_GAMES = 12;

export function deficit(node: OpeningNode, average: number): number {
  if (node.games === 0) return 0;
  const confidence = node.games / (node.games + SMOOTHING_GAMES);
  return (average - scoreRate(node)) * confidence;
}

// Un fil qui coûte doit peser : sous ce nombre de parties, l'écart ne désigne rien.
const MIN_LEAK_GAMES = 5;
const LEAK_GAP = 0.03;

/** La suite où une priorité perd nettement plus qu'en moyenne sur sa ligne, s'il y en a une. */
export function leakOf(here: OpeningNode | undefined): OpeningNode | undefined {
  if (!here) return undefined;
  return here.children
    .filter((child) => child.games >= MIN_LEAK_GAMES && scoreRate(child) < scoreRate(here) - LEAK_GAP)
    .sort((a, b) => scoreRate(a) - scoreRate(b))[0];
}
